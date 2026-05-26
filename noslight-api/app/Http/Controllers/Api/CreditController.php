<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Sale;
use App\Models\Customer;
use App\Models\SaleItem;

class CreditController extends Controller
{
    /**
     * 1. Trae todos los despachos que el vendedor hizo a crédito
     * y que están esperando que tú les pongas precio.
     */
    public function getPending()
    {
        // Traemos todas las ventas pendientes con sus productos
        $sales = \App\Models\Sale::where('status', 'pending_verification')
            ->with(['customer', 'items.productVariant.product'])
            ->orderBy('created_at', 'desc')
            ->get();

        $grouped = [];

        // Agrupamos POR CLIENTE
        foreach ($sales as $sale) {
            $customerId = $sale->customer_id ?: 0;
            $customerName = $sale->customer ? $sale->customer->name : ($sale->customer_name ?: 'Público General');
            $date = $sale->created_at->format('Y-m-d');

            $key = 'cliente_' . $customerId; // Llave única por cliente

            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'group_id' => $key,
                    'customer_id' => $customerId,
                    'customer_name' => $customerName,
                    'sale_ids' => [],
                    'estimated_total' => 0, // El total de referencia
                    'days' => [] // Aquí separaremos los días internamente
                ];
            }

            // Agregamos el ID de este despacho
            $grouped[$key]['sale_ids'][] = $sale->id;

            // Sumamos el monto base al estimado total
            $grouped[$key]['estimated_total'] += $sale->total_amount;

            // Creamos el espacio para este día si no existe
            if (!isset($grouped[$key]['days'][$date])) {
                $grouped[$key]['days'][$date] = [];
            }

            // Metemos los productos al saco de su día correspondiente
            foreach ($sale->items as $item) {
                $itemArray = $item->toArray();
                $itemArray['receipt_number'] = $sale->receipt_number;
                $itemArray['time'] = $sale->created_at->format('H:i');
                $grouped[$key]['days'][$date][] = $itemArray;
            }
        }

        // Formateamos el arreglo de días para que sea fácil leerlo en React
        foreach ($grouped as &$group) {
            $formattedDays = [];
            foreach ($group['days'] as $d => $items) {
                $formattedDays[] = [
                    'date' => $d,
                    'items' => $items
                ];
            }
            // Ordenamos para que los días más recientes salgan primero
            usort($formattedDays, function ($a, $b) {
                return strtotime($b['date']) - strtotime($a['date']);
            });
            $group['days'] = $formattedDays;
        }

        return response()->json(array_values($grouped));
    }

    /**
     * 2. Recibe los precios que tú decidiste, recalcula el total,
     * y le clava la deuda al cliente.
     */
    public function approve(Request $request, $id)
    {
        // Validamos que desde React nos manden los precios correctamente
        $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|exists:sale_items,id',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request, $id) {
            $sale = Sale::findOrFail($id);

            // Evitamos que por error apruebes dos veces lo mismo
            if ($sale->status !== 'pending_verification') {
                return response()->json(['message' => 'Este despacho ya fue valorizado y cobrado.'], 400);
            }

            // Usaremos exactamente el mismo nombre en todo el código
            $newTotal = 0;

            // Recorremos los productos y les ponemos el precio final que elegiste
            foreach ($request->items as $itemData) {
                $saleItem = SaleItem::where('id', $itemData['id'])->where('sale_id', $sale->id)->firstOrFail();

                $subtotal = $saleItem->quantity * $itemData['unit_price'];

                $newTotal += $subtotal;

                $saleItem->update([
                    'unit_price' => $itemData['unit_price'],
                    'subtotal'   => $subtotal,
                ]);
            }

            // 3. Actualizamos la Venta
            $sale->update([
                'total_amount' => $newTotal,
                'pending_balance' => $newTotal, // 👈 NUEVO: Empieza debiendo todo el ticket
                'status' => 'credit'
            ]);

            // ¡El toque final! Le sumamos esta deuda al saldo del cliente
            if ($sale->customer_id) {
                $customer = Customer::findOrFail($sale->customer_id);
                $customer->increment('credit_balance', $newTotal);
            }

            return response()->json([
                'message' => '¡Precios fijados! La deuda se ha sumado a la cuenta del cliente.',
                'sale' => $sale
            ]);
        });
    }

    /**
     * 3. Trae el directorio de clientes que tienen deudas (saldo mayor a 0).
     */
    public function getAccounts()
    {
        $customers = Customer::where('credit_balance', '>', 0)
            ->with([
                // 1. Traemos las ventas a crédito CON SUS PRODUCTOS
                'sales' => function ($query) {
                    $query->where('status', 'credit')
                        ->with('items.productVariant.product') // <--- La magia del detalle
                        ->orderBy('created_at', 'desc');
                },
                // 2. Traemos todos los abonos que ha hecho
                'creditPayments' => function ($query) {
                    $query->orderBy('created_at', 'desc');
                }
            ])
            ->orderBy('name', 'asc')
            ->get();

        return response()->json($customers);
    }
    /**
     * 4. Registrar un Abono a la deuda del cliente.
     */
    public function addPayment(Request $request, $customerId)
    {
        $request->validate([
            'payments' => 'required|array|min:1',
            'payments.*.amount' => 'required|numeric|min:0.1',
            'payments.*.method' => 'required|string',
        ]);

        return DB::transaction(function () use ($request, $customerId) {
            $customer = Customer::findOrFail($customerId);

            // 1. Calculamos cuánto dinero nos están dando en total
            $totalPaid = collect($request->payments)->sum('amount');

            if ($totalPaid > $customer->credit_balance) {
                return response()->json(['message' => 'El abono es mayor a la deuda total.'], 400);
            }

            // 2. Descontamos la deuda general del cliente
            $customer->decrement('credit_balance', $totalPaid);

            // 3. LA MAGIA DE LA CASCADA (Mata las deudas más viejas primero)
            $moneyLeftToDistribute = $totalPaid;

            // Buscamos todos sus tickets que aún tengan saldo pendiente, del más viejo al más nuevo
            $pendingSales = $customer->sales()
                ->where('status', 'credit')
                ->where('pending_balance', '>', 0)
                ->orderBy('created_at', 'asc')
                ->get();

            foreach ($pendingSales as $sale) {
                if ($moneyLeftToDistribute <= 0) break;

                if ($moneyLeftToDistribute >= $sale->pending_balance) {
                    // Paga todo este ticket y sobra plata para el siguiente
                    $moneyLeftToDistribute -= $sale->pending_balance;
                    $sale->update(['pending_balance' => 0]);
                } else {
                    // Solo paga una parte de este ticket y se acaba la plata
                    $sale->decrement('pending_balance', $moneyLeftToDistribute);
                    $moneyLeftToDistribute = 0;
                }
            }

            // 4. Guardamos los recibos del pago (Por si pagó mitad efectivo, mitad yape)
            foreach ($request->payments as $paymentData) {
                \App\Models\CreditPayment::create([
                    'customer_id' => $customer->id,
                    'user_id' => $request->user()->id,
                    'amount' => $paymentData['amount'],
                    'payment_method' => $paymentData['method'],
                    'payment_date' => now(),
                ]);
            }

            return response()->json([
                'message' => 'Abono en cascada registrado correctamente.',
                'new_balance' => $customer->credit_balance
            ]);
        });
    }

    public function getCustomerStatement(Request $request, $id)
    {
        $customer = Customer::findOrFail($id);

        // Capturamos el rango de fechas de los calendarios
        $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
        $endDate = $request->input('end_date', now()->endOfMonth()->format('Y-m-d'));

        // 1. Traemos las Ventas filtradas por fecha
        $sales = $customer->sales()
            ->where('status', 'credit')
            ->whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->with('items.productVariant.product')
            ->get()
            ->map(function($item) {
                return [
                    'id' => 'sale_'.$item->id,
                    'date' => $item->created_at->format('Y-m-d'),
                    'time' => $item->created_at->format('H:i'),
                    'full_date' => $item->created_at,
                    'type' => 'VENTA',
                    'description' => 'Despacho #' . $item->receipt_number,
                    'amount' => $item->total_amount,
                    'details' => $item->items,
                    'is_payment' => false
                ];
            });

        // 2. Traemos los Abonos filtrados por fecha Y con el usuario
        $payments = $customer->creditPayments()
            ->with('user')
            ->whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59']) // 👈 ¡ESTA ES LA LÍNEA QUE FALTABA!
            ->get()
            ->map(function($item) {
                return [
                    'id' => 'pay_'.$item->id,
                    'date' => $item->created_at->format('Y-m-d'),
                    'time' => $item->created_at->format('H:i'),
                    'full_date' => $item->created_at,
                    'type' => 'ABONO',
                    'description' => 'Pago recibido por ' . ($item->user ? $item->user->name : 'Sistema'),
                    'method' => strtoupper($item->payment_method),
                    'amount' => $item->amount,
                    'is_payment' => true
                ];
            });

        // 3. Unimos todo
        $historyFlat = $sales->concat($payments)->sortBy('full_date')->values();

        // 4. Agrupamos por Día
        $groupedHistory = [];
        foreach ($historyFlat as $mov) {
            $date = $mov['date'];

            if (!isset($groupedHistory[$date])) {
                $groupedHistory[$date] = [
                    'date' => $date,
                    'movements' => [],
                    'daily_sales' => 0,
                    'daily_payments' => 0,
                ];
            }

            $groupedHistory[$date]['movements'][] = $mov;

            if ($mov['is_payment']) {
                $groupedHistory[$date]['daily_payments'] += $mov['amount'];
            } else {
                $groupedHistory[$date]['daily_sales'] += $mov['amount'];
            }
        }

        // Ordenamos para que los días más recientes salgan arriba
        krsort($groupedHistory);

        return response()->json([
            'customer' => $customer,
            'history' => array_values($groupedHistory),
            'current_balance' => $customer->credit_balance
        ]);
    }
    public function approveGroup(Request $request)
    {
        $request->validate([
            'sale_ids' => 'required|array',
            'items' => 'required|array',
            'items.*.id' => 'required|exists:sale_items,id',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        return \Illuminate\Support\Facades\DB::transaction(function () use ($request) {
            $totalNewDebt = 0;
            $customerId = null;

            // 1. Actualizamos el precio final de cada producto individual
            foreach ($request->items as $itemData) {
                $saleItem = \App\Models\SaleItem::whereIn('sale_id', $request->sale_ids)
                    ->where('id', $itemData['id'])
                    ->firstOrFail();

                $subtotal = $saleItem->quantity * $itemData['unit_price'];

                $saleItem->update([
                    'unit_price' => $itemData['unit_price'],
                    'subtotal'   => $subtotal,
                ]);
            }

            // 2. Calculamos el nuevo total de cada despacho y lo activamos como crédito oficial
            foreach ($request->sale_ids as $saleId) {
                $sale = \App\Models\Sale::findOrFail($saleId);

                if ($sale->status !== 'pending_verification') continue;

                $customerId = $sale->customer_id; // Identificamos al cliente

                // Sumamos los subtotales de este despacho específico
                $newSaleTotal = $sale->items()->sum('subtotal');
                $totalNewDebt += $newSaleTotal;

                $sale->update([
                    'total_amount' => $newSaleTotal,
                    'pending_balance' => $newSaleTotal,
                    'status' => 'credit'
                ]);
            }

            // 3. Le sumamos TODA la deuda del día a la cuenta corriente del cliente
            if ($customerId) {
                $customer = \App\Models\Customer::findOrFail($customerId);
                $customer->increment('credit_balance', $totalNewDebt);
            }

            return response()->json(['message' => '¡Día valorizado y sumado a la cuenta corriente!']);
        });
    }
}
