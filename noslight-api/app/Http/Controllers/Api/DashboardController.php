<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private const BILLED_STATUSES = ['paid', 'credit', 'consolidated_credit', 'partial'];
    private const PENDING_STATUS = 'pending_verification';
    private const OPEN_HOUR = 8;
    private const CLOSE_HOUR = 21;
    private const HISTORY_WEEKS = 4;
    private const TARGET_COVERAGE_DAYS = 14;

    public function getChartsData(Request $request)
    {
        $warehouseId = Warehouse::where('code', 'TIENDA')->value('id');
        if (!$warehouseId) {
            return response()->json([
                'message' => 'No existe el almacén con código TIENDA.',
            ], 422);
        }

        $payload = Cache::remember(
            "dashboard.charts.{$warehouseId}",
            now()->addSeconds(90),
            fn () => $this->buildPayload($warehouseId)
        );

        return response()->json($payload);
    }

    private function buildPayload(int $warehouseId): array
    {
        $now = Carbon::now();
        $startOfToday = $now->copy()->startOfDay();
        $startOfMonth = $now->copy()->startOfMonth();
        $startOfWeek = $now->copy()->startOfWeek();

        return [
            'salesByHour' => $this->salesByHour($warehouseId, $startOfToday, $now),
            'motivation' => $this->weeklyMotivation($warehouseId, $startOfWeek, $now),
            'topProducts' => $this->topProducts($warehouseId, $startOfMonth, $now),
            'vipCustomers' => $this->vipCustomers($warehouseId, $startOfMonth, $now),
            'creditRecords' => $this->creditRecords(),
            'lowStock' => $this->lowStock($warehouseId, $now),
            'pendingVales' => $this->pendingVales($warehouseId),
            'meta' => [
                'generatedAt' => $now->toIso8601String(),
                'warehouseId' => $warehouseId,
                'historyWeeks' => self::HISTORY_WEEKS,
            ],
        ];
    }

    private function billedSales(int $warehouseId, Carbon $from, Carbon $to)
    {
        return DB::table('sales')
            ->where('sales.warehouse_id', $warehouseId)
            ->whereIn('sales.status', self::BILLED_STATUSES)
            ->whereBetween('sales.created_at', [$from, $to]);
    }

    private function salesByHour(int $warehouseId, Carbon $startOfToday, Carbon $now): array
    {
        $hours = range(self::OPEN_HOUR, self::CLOSE_HOUR);
        $categories = array_map(fn ($h) => sprintf('%02d:00', $h), $hours);
        $slotOf = array_flip($hours);

        $fill = function ($rows, $valueKey) use ($slotOf, $hours) {
            $series = array_fill(0, count($hours), 0.0);
            foreach ($rows as $row) {
                $hour = (int) $row->hora;
                if (isset($slotOf[$hour])) {
                    $series[$slotOf[$hour]] += round((float) $row->{$valueKey}, 2);
                }
            }
            return $series;
        };

        $todayRows = $this->billedSales($warehouseId, $startOfToday, $now)
            ->selectRaw('HOUR(created_at) as hora, SUM(total_amount) as total')
            ->groupByRaw('HOUR(created_at)')
            ->get();

        $pendingRows = DB::table('sales')
            ->where('warehouse_id', $warehouseId)
            ->where('status', self::PENDING_STATUS)
            ->whereBetween('created_at', [$startOfToday, $now])
            ->selectRaw('HOUR(created_at) as hora, SUM(total_amount) as total')
            ->groupByRaw('HOUR(created_at)')
            ->get();

        $perDay = $this->billedSales(
            $warehouseId,
            $startOfToday->copy()->subWeeks(self::HISTORY_WEEKS),
            $startOfToday
        )
        ->whereRaw('DAYOFWEEK(created_at) = ?', [$now->dayOfWeek + 1])
        ->selectRaw('HOUR(created_at) as hora, DATE(created_at) as dia, SUM(total_amount) as total')
        ->groupByRaw('HOUR(created_at), DATE(created_at)');

        $historyRows = DB::query()
            ->fromSub($perDay, 'd')
            ->selectRaw('d.hora as hora, AVG(d.total) as promedio')
            ->groupBy('d.hora')
            ->get();

        return [
            'categories' => $categories,
            'todayData' => $fill($todayRows, 'total'),
            'historyData' => $fill($historyRows, 'promedio'),
            'pendingData' => $fill($pendingRows, 'total'),
        ];
    }

    private function weeklyMotivation(int $warehouseId, Carbon $startOfWeek, Carbon $now): array
    {
        $currentWeek = (float) $this->billedSales($warehouseId, $startOfWeek, $now)->sum('total_amount');
        $elapsedSeconds = $startOfWeek->diffInSeconds($now);
        $weekTotals = [];

        for ($i = 1; $i <= self::HISTORY_WEEKS; $i++) {
            $weekStart = $startOfWeek->copy()->subWeeks($i);
            $weekCut = $weekStart->copy()->addSeconds($elapsedSeconds);
            $total = (float) $this->billedSales($warehouseId, $weekStart, $weekCut)->sum('total_amount');
            if ($total > 0) {
                $weekTotals[] = $total;
            }
        }

        $weeksCompared = count($weekTotals);
        $avgWeek = $weeksCompared > 0 ? array_sum($weekTotals) / $weeksCompared : 0.0;
        $percent = $avgWeek > 0 ? (int) round((($currentWeek - $avgWeek) / $avgWeek) * 100) : 0;

        $todayStats = $this->billedSales($warehouseId, $now->copy()->startOfDay(), $now)
            ->selectRaw('COUNT(*) as tickets, COALESCE(SUM(total_amount), 0) as total')
            ->first();

        $tickets = (int) ($todayStats->tickets ?? 0);
        $today = (float) ($todayStats->total ?? 0);

        return [
            'currentWeek' => round($currentWeek, 2),
            'avgWeek' => round($avgWeek, 2),
            'percent' => $percent,
            'weeksCompared' => $weeksCompared,
            'comparable' => $weeksCompared > 0,
            'todayTotal' => round($today, 2),
            'ticketsToday' => $tickets,
            'avgTicket' => $tickets > 0 ? round($today / $tickets, 2) : 0.0,
        ];
    }

    private function topProducts(int $warehouseId, Carbon $from, Carbon $to): array
    {
        $rows = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('product_variants', 'sale_items.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->where('sales.warehouse_id', $warehouseId)
            ->whereIn('sales.status', self::BILLED_STATUSES)
            ->whereBetween('sales.created_at', [$from, $to])
            ->where('products.is_raw', false)
            ->selectRaw('products.name as name, SUM(sale_items.quantity) as total_qty, SUM(sale_items.subtotal) as revenue')
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('total_qty')
            ->limit(5)
            ->get();

        if ($rows->isEmpty()) {
            return [
                'categories' => ['Sin ventas este mes'],
                'data' => [0],
                'revenue' => [0]
            ];
        }

        return [
            'categories' => $rows->pluck('name')->all(),
            'data' => $rows->map(fn ($r) => (int) $r->total_qty)->all(),
            'revenue' => $rows->map(fn ($r) => round((float) $r->revenue, 2))->all(),
        ];
    }

    private function vipCustomers(int $warehouseId, Carbon $from, Carbon $to): array
    {
        $rows = $this->billedSales($warehouseId, $from, $to)
            ->join('customers', 'sales.customer_id', '=', 'customers.id')
            ->whereNotNull('sales.customer_id')
            ->selectRaw('customers.name as name, SUM(sales.total_amount) as total_spent')
            ->groupBy('customers.id', 'customers.name')
            ->orderByDesc('total_spent')
            ->limit(5)
            ->get();

        if ($rows->isEmpty()) {
            return ['labels' => ['Sin clientes registrados'], 'data' => [0]];
        }

        return [
            'labels' => $rows->pluck('name')->all(),
            'data' => $rows->map(fn ($r) => round((float) $r->total_spent, 2))->all(),
        ];
    }

    private function creditRecords(): array
    {
        $perCredit = DB::table('credits')
            ->join('credit_payments', 'credit_payments.credit_id', '=', 'credits.id')
            ->where('credits.status', 'paid')
            ->whereNotNull('credits.customer_id')
            ->selectRaw('credits.id as credit_id, credits.customer_id as customer_id, GREATEST(DATEDIFF(MAX(credit_payments.payment_date), DATE(credits.created_at)), 0) as dias')
            ->groupBy('credits.id', 'credits.customer_id');

        $rows = DB::query()
            ->fromSub($perCredit, 'c')
            ->join('customers', 'customers.id', '=', 'c.customer_id')
            ->selectRaw('customers.name as name, ROUND(AVG(c.dias)) as dias_promedio, COUNT(*) as lotes')
            ->groupBy('customers.id', 'customers.name')
            ->orderBy('dias_promedio')
            ->limit(5)
            ->get();

        if ($rows->isEmpty()) {
            return ['labels' => ['Aún sin créditos liquidados'], 'data' => [0], 'lotes' => [0]];
        }

        return [
            'labels' => $rows->pluck('name')->all(),
            'data' => $rows->map(fn ($r) => (int) $r->dias_promedio)->all(),
            'lotes' => $rows->map(fn ($r) => (int) $r->lotes)->all(),
        ];
    }

   private function lowStock(int $warehouseId, Carbon $now): array
    {
        $windowDays = 30;

        // Unidades vendidas por variante en la ventana → velocidad diaria.
        $velocity = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.warehouse_id', $warehouseId)
            ->whereIn('sales.status', self::BILLED_STATUSES)
            ->whereBetween('sales.created_at', [$now->copy()->subDays($windowDays), $now])
            ->selectRaw('sale_items.product_variant_id as variant_id, SUM(sale_items.quantity) as vendidas')
            ->groupBy('sale_items.product_variant_id');

        $rows = DB::table('stocks')
            ->join('product_variants', 'stocks.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->leftJoinSub($velocity, 'v', 'v.variant_id', '=', 'stocks.product_variant_id')
            ->where('stocks.warehouse_id', $warehouseId)
            ->where('products.is_raw', false)
            ->selectRaw('products.name as name, product_variants.sku as sku, stocks.quantity as quantity, products.package_size as package_size, COALESCE(v.vendidas, 0) as vendidas')
            ->get();

        $items = [];
        foreach ($rows as $row) {
            $daily = (float) $row->vendidas / $windowDays;
            $quantity = (int) $row->quantity;

            // Punto de reposición = lo que se vende en TARGET_COVERAGE_DAYS.
            // Si el producto no rota, caemos al tamaño de cajón como referencia mínima.
            $reorderPoint = $daily > 0
                ? (int) max(1, ceil($daily * self::TARGET_COVERAGE_DAYS))
                : (int) ($row->package_size ?: 0);

            $days = $daily > 0 ? (int) floor($quantity / $daily) : null;
            $needsAttention = $daily > 0
                ? $days <= self::TARGET_COVERAGE_DAYS
                : ($reorderPoint > 0 && $quantity < $reorderPoint);

            if (!$needsAttention) {
                continue;
            }

            $pct = $reorderPoint > 0
                ? min(100, (int) round(($quantity / $reorderPoint) * 100))
                : 0;

            $items[] = [
                'name' => $row->name,
                'sku' => $row->sku,
                'current' => $quantity,
                'limit' => $reorderPoint,
                'pct' => $pct,
                'days' => $days, // null = sin rotación medible
                'dailyVelocity' => round($daily, 2),
                'hasVelocity' => $daily > 0,
                'status' => $this->coverageStatus($quantity, $days),
            ];
        }

        // Primero lo que se agota antes; los sin rotación al final, por stock más bajo.
        usort($items, function ($a, $b) {
            if ($a['days'] === null && $b['days'] === null) {
                return $a['current'] <=> $b['current'];
            }
            if ($a['days'] === null) return 1;
            if ($b['days'] === null) return -1;
            return $a['days'] <=> $b['days'];
        });

        return array_slice($items, 0, 12);
    }

    private function coverageStatus(int $quantity, ?int $days): string
    {
        if ($quantity <= 0) return 'agotado';
        if ($days !== null && $days <= 3) return 'critico';
        if ($days !== null && $days <= 7) return 'alerta';
        return 'vigilar';
    }

    private function pendingVales(int $warehouseId): array
    {
        $row = DB::table('sales')
            ->where('warehouse_id', $warehouseId)
            ->where('status', self::PENDING_STATUS)
            ->selectRaw('COUNT(*) as total, COALESCE(SUM(total_amount), 0) as monto')
            ->first();

        return [
            'count' => (int) ($row->total ?? 0),
            'amount' => round((float) ($row->monto ?? 0), 2),
        ];
    }
} // 👈 Esta llave cierra definitivamente la clase DashboardController
