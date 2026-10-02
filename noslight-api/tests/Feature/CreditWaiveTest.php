<?php

namespace Tests\Feature;

use App\Models\Credit;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CreditWaiveTest extends TestCase
{
    use RefreshDatabase;

    public function test_pending_credit_is_waived_without_creating_a_payment_or_changing_related_sales(): void
    {
        [$customer, $credit, $sale, $saleItem] = $this->createCreditWithSale(250, 0, 'pending');
        $otherCredit = Credit::create([
            'customer_id' => $customer->id,
            'sale_id' => null,
            'total_amount' => 100,
            'paid_amount' => 0,
            'remaining_amount' => 100,
            'due_date' => now()->addDays(30),
            'status' => 'pending',
            'notes' => 'OTRO-LOTE',
        ]);
        $customer->update(['credit_balance' => 999]);
        $saleSnapshot = $sale->fresh()->toArray();
        $saleItemSnapshot = $saleItem->fresh()->toArray();
        $creditSalesSnapshot = DB::table('credit_sales')
            ->where('credit_id', $credit->id)
            ->get()
            ->map(fn ($row) => (array) $row)
            ->values()
            ->toArray();
        $creditBeforeWaive = $credit->fresh();
        $creditSnapshot = $credit->fresh()->only([
            'sale_id',
            'customer_id',
            'total_amount',
            'paid_amount',
        ]);
        $creditSnapshot['due_date'] = $creditBeforeWaive->due_date->toDateString();
        $stockMovementCount = DB::table('stock_movements')->count();
        $salePaymentCount = DB::table('sale_payments')->count();

        $admin = User::factory()->create();
        Sanctum::actingAs($admin);
        $response = $this->postJson("/api/admin/credits/{$credit->id}/waive");

        $response->assertOk();
        $this->assertDatabaseHas('credits', [
            'id' => $credit->id,
            'total_amount' => 250,
            'paid_amount' => 0,
            'remaining_amount' => 0,
            'status' => 'waived',
        ]);
        $waivedCredit = $credit->fresh();
        $this->assertNotNull($waivedCredit->waived_at);
        $this->assertSame($admin->id, $waivedCredit->waived_by);
        $creditAfterWaive = $credit->fresh();
        $creditAfterSnapshot = $creditAfterWaive->only([
            'sale_id',
            'customer_id',
            'total_amount',
            'paid_amount',
        ]);
        $creditAfterSnapshot['due_date'] = $creditAfterWaive->due_date->toDateString();
        $this->assertSame($creditSnapshot, $creditAfterSnapshot);
        $this->assertStringContainsString(
            'Condonación administrativa sin pago',
            (string) $credit->fresh()->notes
        );
        $this->assertSame($saleSnapshot, $sale->fresh()->toArray());
        $this->assertSame($saleItemSnapshot, $saleItem->fresh()->toArray());
        $creditSalesAfterWaive = DB::table('credit_sales')
            ->where('credit_id', $credit->id)
            ->get()
            ->map(fn ($row) => (array) $row)
            ->values()
            ->toArray();
        $this->assertSame($creditSalesSnapshot, $creditSalesAfterWaive);
        $this->assertSame($stockMovementCount, DB::table('stock_movements')->count());
        $this->assertSame($salePaymentCount, DB::table('sale_payments')->count());
        $this->assertDatabaseCount('credit_payments', 0);
        $this->assertDatabaseCount('cash_movements', 0);
        $this->assertSame(100.0, (float) $customer->fresh()->credit_balance);
        $this->assertSame(100.0, (float) $otherCredit->fresh()->remaining_amount);
    }

    public function test_partial_credit_is_waived_without_changing_paid_amount(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(250, 75, 'partial');
        $customer->update(['credit_balance' => 175]);

        Sanctum::actingAs(User::factory()->create());
        $response = $this->postJson("/api/admin/credits/{$credit->id}/waive");

        $response->assertOk();
        $this->assertDatabaseHas('credits', [
            'id' => $credit->id,
            'total_amount' => 250,
            'paid_amount' => 75,
            'remaining_amount' => 0,
            'status' => 'waived',
        ]);
        $this->assertSame(0.0, (float) $customer->fresh()->credit_balance);
    }

    public function test_overdue_credit_with_balance_can_be_waived(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(250, 0, 'overdue');
        $customer->update(['credit_balance' => 250]);

        Sanctum::actingAs(User::factory()->create());
        $response = $this->postJson("/api/admin/credits/{$credit->id}/waive");

        $response->assertOk();
        $this->assertDatabaseHas('credits', [
            'id' => $credit->id,
            'remaining_amount' => 0,
            'status' => 'waived',
        ]);
        $this->assertSame(0.0, (float) $customer->fresh()->credit_balance);
    }

    public function test_paid_and_waived_credits_cannot_be_waived_again(): void
    {
        [$customer, $paidCredit] = $this->createCreditWithSale(250, 250, 'paid');
        $waivedCredit = Credit::create([
            'customer_id' => $customer->id,
            'sale_id' => null,
            'total_amount' => 100,
            'paid_amount' => 0,
            'remaining_amount' => 0,
            'due_date' => now()->addDays(30),
            'status' => 'waived',
            'notes' => 'Condonación administrativa sin pago',
        ]);

        Sanctum::actingAs(User::factory()->create());
        $this->postJson("/api/admin/credits/{$paidCredit->id}/waive")->assertStatus(422);
        $this->postJson("/api/admin/credits/{$waivedCredit->id}/waive")->assertStatus(422);

        $this->assertSame('paid', $paidCredit->fresh()->status);
        $this->assertSame('waived', $waivedCredit->fresh()->status);
    }

    public function test_waived_credit_is_excluded_from_accounts_debt_and_remains_in_statement_history(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(250, 0, 'pending');
        $customer->update(['credit_balance' => 250]);

        Sanctum::actingAs(User::factory()->create());
        $this->postJson("/api/admin/credits/{$credit->id}/waive")->assertOk();

        $accounts = $this->getJson('/api/credits/accounts')->assertOk()->json();
        $account = collect($accounts)->firstWhere('id', $customer->id);
        $this->assertSame(0.0, (float) $account['credit_balance']);

        $statement = $this->getJson("/api/credits/customers/{$customer->id}/statement")->assertOk()->json();
        $waived = collect($statement['paid_lotes'])->firstWhere('id', 'lote_' . $credit->id);
        $this->assertNotNull($waived);
        $this->assertSame('waived', $waived['real_status']);
        $this->assertSame(0.0, (float) $waived['pending_balance']);
        $this->assertTrue(collect($statement['history'])->pluck('movements')->flatten(1)->contains(function (array $movement) {
            return $movement['type'] === 'CONDONACIÓN';
        }));
    }

    public function test_partial_payment_can_be_followed_by_a_second_payment(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(2769, 0, 'pending');
        $customer->update(['credit_balance' => 2769]);
        Sanctum::actingAs($user = User::factory()->create());

        $this->postJson("/api/credits/customers/{$customer->id}/payments", [
            'sale_ids' => [$credit->id],
            'payments' => [['amount' => 2069, 'method' => 'efectivo']],
        ])->assertOk();

        $this->assertDatabaseHas('credits', [
            'id' => $credit->id,
            'paid_amount' => 2069,
            'remaining_amount' => 700,
            'status' => 'partial',
        ]);

        $this->postJson("/api/credits/customers/{$customer->id}/payments", [
            'sale_ids' => [$credit->id],
            'payments' => [['amount' => 700, 'method' => 'transferencia']],
        ])->assertOk();

        $this->assertDatabaseHas('credits', [
            'id' => $credit->id,
            'paid_amount' => 2769,
            'remaining_amount' => 0,
            'status' => 'paid',
        ]);
        $this->assertDatabaseCount('credit_payments', 2);
        $this->assertSame(2769.0, (float) DB::table('credit_payments')->where('credit_id', $credit->id)->sum('amount'));
        $this->assertSame($user->id, (int) DB::table('credit_payments')->where('credit_id', $credit->id)->value('user_id'));
    }

    public function test_mixed_payment_lines_preserve_each_destination_without_changing_financial_values(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(300, 0, 'pending');
        $customer->update(['credit_balance' => 300]);
        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/credits/customers/{$customer->id}/payments", [
            'sale_ids' => [$credit->id],
            'payments' => [
                ['amount' => 100, 'method' => 'efectivo'],
                ['amount' => 100, 'method' => 'yape', 'yape_account' => 'JOSE YAPE'],
                ['amount' => 100, 'method' => 'transferencia', 'bank_account' => 'HERMELINDA BCP'],
            ],
        ])->assertOk();

        $payments = DB::table('credit_payments')
            ->where('credit_id', $credit->id)
            ->orderBy('id')
            ->get(['payment_method', 'payment_destination', 'amount']);

        $this->assertSame([
            ['payment_method' => 'efectivo', 'payment_destination' => null, 'amount' => 100.0],
            ['payment_method' => 'yape', 'payment_destination' => 'JOSE YAPE', 'amount' => 100.0],
            ['payment_method' => 'transferencia', 'payment_destination' => 'HERMELINDA BCP', 'amount' => 100.0],
        ], $payments->map(fn ($payment) => [
            'payment_method' => $payment->payment_method,
            'payment_destination' => $payment->payment_destination,
            'amount' => (float) $payment->amount,
        ])->toArray());

        $this->assertDatabaseHas('credits', [
            'id' => $credit->id,
            'paid_amount' => 300,
            'remaining_amount' => 0,
            'status' => 'paid',
        ]);
    }

    public function test_statement_returns_payment_destination_and_preserves_old_null_destinations(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(300, 0, 'pending');
        $user = User::factory()->create();
        $createdAt = now();

        DB::table('credit_payments')->insert([
            [
                'credit_id' => $credit->id,
                'customer_id' => $customer->id,
                'user_id' => $user->id,
                'amount' => 100,
                'payment_method' => 'yape',
                'payment_destination' => 'JOSE YAPE',
                'payment_date' => $createdAt->toDateString(),
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ],
            [
                'credit_id' => $credit->id,
                'customer_id' => $customer->id,
                'user_id' => $user->id,
                'amount' => 100,
                'payment_method' => 'transferencia',
                'payment_destination' => null,
                'payment_date' => $createdAt->toDateString(),
                'created_at' => $createdAt->copy()->addMinute(),
                'updated_at' => $createdAt->copy()->addMinute(),
            ],
        ]);

        Sanctum::actingAs(User::factory()->create());
        $statement = $this->getJson("/api/credits/customers/{$customer->id}/statement")
            ->assertOk()
            ->json();

        $lote = collect($statement['customer']['sales'])->firstWhere('id', 'lote_' . $credit->id);
        $this->assertNotNull($lote);
        $this->assertSame('JOSE YAPE', $lote['payments'][0]['payment_destination']);
        $this->assertNull($lote['payments'][1]['payment_destination']);
    }

    public function test_statement_keeps_all_lot_payments_outside_the_general_date_range(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(2769, 2769, 'paid');
        $user = User::factory()->create();
        $oldDate = now()->subMonth();

        DB::table('credit_payments')->insert([
            [
                'credit_id' => $credit->id,
                'customer_id' => $customer->id,
                'user_id' => $user->id,
                'amount' => 2069,
                'payment_method' => 'efectivo',
                'payment_date' => $oldDate->toDateString(),
                'created_at' => $oldDate,
                'updated_at' => $oldDate,
            ],
            [
                'credit_id' => $credit->id,
                'customer_id' => $customer->id,
                'user_id' => $user->id,
                'amount' => 700,
                'payment_method' => 'transferencia',
                'payment_date' => $oldDate->toDateString(),
                'created_at' => $oldDate->copy()->addMinutes(5),
                'updated_at' => $oldDate->copy()->addMinutes(5),
            ],
        ]);

        Sanctum::actingAs(User::factory()->create());
        $statement = $this->getJson("/api/credits/customers/{$customer->id}/statement?start_date=" . now()->toDateString() . "&end_date=" . now()->toDateString())
            ->assertOk()
            ->json();

        $lote = collect($statement['paid_lotes'])->firstWhere('id', 'lote_' . $credit->id);
        $this->assertNotNull($lote);
        $this->assertCount(2, $lote['payments']);
        $this->assertSame([2069.0, 700.0], array_map('floatval', array_column($lote['payments'], 'amount')));
        $this->assertSame($user->id, $lote['payments'][0]['user_id']);
        $this->assertSame($user->name, $lote['payments'][0]['user_name']);
    }

    public function test_waived_statement_shows_previous_payments_and_condoned_amount(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(2769, 2069, 'partial');
        $user = User::factory()->create();
        $admin = User::factory()->create();
        $oldDate = now()->subMonth();

        DB::table('credit_payments')->insert([
            'credit_id' => $credit->id,
            'customer_id' => $customer->id,
            'user_id' => $user->id,
            'amount' => 2069,
            'payment_method' => 'efectivo',
            'payment_date' => $oldDate->toDateString(),
            'created_at' => $oldDate,
            'updated_at' => $oldDate,
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/admin/credits/{$credit->id}/waive")->assertOk();

        $statement = $this->getJson("/api/credits/customers/{$customer->id}/statement?start_date=" . now()->toDateString() . "&end_date=" . now()->toDateString())
            ->assertOk()
            ->json();
        $lote = collect($statement['paid_lotes'])->firstWhere('id', 'lote_' . $credit->id);

        $this->assertSame('waived', $lote['real_status']);
        $this->assertCount(1, $lote['payments']);
        $this->assertSame(2069.0, (float) $lote['payments'][0]['amount']);
        $this->assertSame(700.0, max(0, (float) $lote['total_amount'] - collect($lote['payments'])->sum('amount')));
        $this->assertSame(0.0, (float) $lote['pending_balance']);
        $this->assertNotNull($lote['waived_at']);
        $this->assertSame($admin->id, $lote['waived_by']);
        $this->assertSame($admin->name, $lote['waived_by_name']);
        $this->assertTrue(collect($statement['history'])->pluck('movements')->flatten(1)->contains(function (array $movement) {
            return $movement['type'] === 'CONDONACIÓN';
        }));
    }

    public function test_paid_credit_does_not_have_a_waived_document_event(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(250, 250, 'paid');

        Sanctum::actingAs(User::factory()->create());
        $statement = $this->getJson("/api/credits/customers/{$customer->id}/statement")
            ->assertOk()
            ->json();

        $lote = collect($statement['paid_lotes'])->firstWhere('id', 'lote_' . $credit->id);
        $this->assertNotNull($lote);
        $this->assertNull($lote['waived_at']);
        $this->assertNull($lote['waived_by']);
        $this->assertNull($lote['waived_by_name']);
    }

    public function test_legacy_waived_credit_without_metadata_does_not_invent_audit_data(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(250, 0, 'waived');
        $credit->update(['remaining_amount' => 0, 'waived_at' => null, 'waived_by' => null]);

        Sanctum::actingAs(User::factory()->create());
        $statement = $this->getJson("/api/credits/customers/{$customer->id}/statement")
            ->assertOk()
            ->json();

        $lote = collect($statement['paid_lotes'])->firstWhere('id', 'lote_' . $credit->id);
        $this->assertNull($lote['waived_at']);
        $this->assertNull($lote['waived_by']);
        $this->assertNull($lote['waived_by_name']);
    }

    public function test_audit_migration_down_refuses_to_run_when_waived_credits_exist(): void
    {
        [$customer, $credit] = $this->createCreditWithSale(250, 0, 'waived');
        $migration = require base_path('database/migrations/2026_10_01_010000_add_waived_audit_fields_to_credits_table.php');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage("status='waived'");
        $migration->down();
    }

    private function createCreditWithSale(float $total, float $paid, string $status): array
    {
        $customer = Customer::create([
            'name' => 'Cliente de prueba',
            'credit_balance' => max(0, $total - $paid),
        ]);
        $user = User::factory()->create();
        $warehouseId = DB::table('warehouses')->insertGetId([
            'name' => 'Tienda de prueba',
            'code' => 'TEST-' . uniqid(),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $saleId = DB::table('sales')->insertGetId([
            'receipt_number' => 'TEST-' . uniqid(),
            'warehouse_id' => $warehouseId,
            'user_id' => $user->id,
            'customer_id' => $customer->id,
            'cash_register_id' => null,
            'total_amount' => $total,
            'paid_amount' => 0,
            'pending_balance' => $total,
            'status' => 'consolidated_credit',
            'notes' => 'Venta de prueba',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $productId = DB::table('products')->insertGetId([
            'name' => 'Producto de prueba',
            'base_code' => 'TEST',
            'model' => 'TEST',
            'package_size' => 1,
            'allowed_amperages' => null,
            'is_raw' => true,
            'cost_price' => 1,
            'supplier' => null,
            'notes' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $variantId = DB::table('product_variants')->insertGetId([
            'product_id' => $productId,
            'amperage' => 1,
            'sku' => 'TEST-' . uniqid(),
            'cost_price' => 1,
            'sale_price' => $total,
            'is_finished' => true,
            'notes' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $saleItem = SaleItem::create([
            'sale_id' => $saleId,
            'product_variant_id' => $variantId,
            'quantity' => 1,
            'unit_price' => $total,
            'subtotal' => $total,
        ]);
        $credit = Credit::create([
            'customer_id' => $customer->id,
            'sale_id' => null,
            'total_amount' => $total,
            'paid_amount' => $paid,
            'remaining_amount' => $total - $paid,
            'due_date' => now()->addDays(30),
            'status' => $status,
            'notes' => 'LOTE-VALORIZADO-TEST',
        ]);
        DB::table('credit_sales')->insert([
            'credit_id' => $credit->id,
            'sale_id' => $saleId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [$customer, $credit, Sale::findOrFail($saleId), $saleItem];
    }
}
