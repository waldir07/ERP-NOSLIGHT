<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Models\Sale;
use App\Models\Stock;
use App\Models\Warehouse;
use App\Models\StockMovement;
use App\Models\ProductVariant;
// Usamos namespaces absolutos para las tablas nuevas por si aún no has creado los archivos de los modelos
use App\Models\Customer;
use App\Models\SaleItem;
use App\Models\SalePayment;

class SaleController extends Controller
{
    // =========================================================================
    // 🛒 1. FUNCIÓN STORE: REGISTRO DE VENTAS (Sintaxis Corregida y Cerrada)
    // =========================================================================
    public function store(\Illuminate\Http\Request $request)
    {
        // Validar la estructura que nos envía el carrito de React
        $request->validate([
            'saleType'               => 'required|in:contado,credito',
            'customer_id'            => 'nullable|integer',
            'customerName'           => 'nullable|string|max:255',
            'items'                  => 'required|array|min:1',
            'items.*.sku'            => 'required|string',
            'items.*.quantity'       => 'required|integer|min:1',
            'items.*.unit_price'     => 'required|numeric|min:0',
            'payments'               => 'nullable|array',
            'payments.*.amount'      => 'required|numeric|min:0',
            'payments.*.method'      => 'required|string',
            'payments.*.destination' => 'nullable|string',
        ]);

        $tienda = \App\Models\Warehouse::where('code', 'TIENDA')->firstOrFail();
        $user = $request->user();

        return \Illuminate\Support\Facades\DB::transaction(function () use ($request, $tienda, $user) {

            $customerId = $request->customer_id;

            // Si es crédito, sí o sí tiene que venir un ID válido del selector
            if ($request->saleType === 'credito' && !$customerId) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'customer_id' => 'Debe seleccionar un cliente de la lista para ventas a crédito.'
                ]);
            }

            // Generar un Número de Vale/Ticket Único
            $lastSale = \App\Models\Sale::orderBy('id', 'desc')->first();
            $nextNumber = $lastSale ? $lastSale->id + 1 : 1;
            $receiptNumber = 'T-' . str_pad($nextNumber, 6, '0', STR_PAD_LEFT);

            $calculatedTotal = 0;
            $itemsData = [];

            foreach ($request->items as $item) {
                $variant = \App\Models\ProductVariant::where('sku', $item['sku'])->first();
                if (!$variant) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'items' => "El producto con SKU {$item['sku']} no existe en la base de datos."
                    ]);
                }

                $stock = \App\Models\Stock::where('product_variant_id', $variant->id)
                    ->where('warehouse_id', $tienda->id)
                    ->lockForUpdate()
                    ->first();

                if (!$stock || $stock->quantity < $item['quantity']) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'items' => "Stock insuficiente para: {$variant->sku}. Disponible: " . ($stock ? $stock->quantity : 0)
                    ]);
                }

                // Descontar stock
                $stock->decrement('quantity', $item['quantity']);
                $subtotal = $item['quantity'] * $item['unit_price'];
                $calculatedTotal += $subtotal;

                $itemsData[] = [
                    'product_variant_id' => $variant->id,
                    'quantity'           => $item['quantity'],
                    'unit_price'         => $item['unit_price'],
                    'subtotal'           => $subtotal,
                ];
            }

            // Calcular Pagos Totales entregados
            $paidAmount = 0;
            if ($request->payments && $request->saleType === 'contado') {
                foreach ($request->payments as $payment) {
                    $paidAmount += (float) $payment['amount'];
                }
            }

            $status = 'paid';
            if ($request->saleType === 'credito') {
                $status = 'pending_verification';
            }

            // Crear la Venta (Cabecera)
            $sale = \App\Models\Sale::create([
                'receipt_number'   => $receiptNumber,
                'warehouse_id'     => $tienda->id,
                'user_id'          => $user->id,
                'customer_id'      => $customerId,
                'cash_register_id' => null,
                'total_amount'     => $calculatedTotal,
                'paid_amount'      => $request->saleType === 'credito' ? 0 : $paidAmount,
                'status'           => $status,
                'notes'            => $request->saleType === 'credito' ? 'Venta a crédito' : 'Venta al contado',
            ]);

            // Crear los Items y Registrar el Movimiento (Kardex)
            foreach ($itemsData as $data) {
                $sale->items()->create($data);

                \App\Models\StockMovement::create([
                    'stock_id'           => \App\Models\Stock::where('product_variant_id', $data['product_variant_id'])->where('warehouse_id', $tienda->id)->value('id'),
                    'product_variant_id' => $data['product_variant_id'],
                    'warehouse_id'       => $tienda->id,
                    'type'               => 'exit',
                    'quantity'           => $data['quantity'],
                    'unit_cost'          => $data['unit_price'],
                    'reference'          => 'Ticket ' . $receiptNumber,
                    'user_id'            => $user->id,
                    'notes'              => 'Venta mostrador',
                ]);
            }

            // Registrar los Pagos Individuales
            if ($request->payments && $request->saleType === 'contado') {
                foreach ($request->payments as $payment) {
                    $sale->payments()->create([
                        'user_id'             => $user->id,
                        'amount'              => (float) $payment['amount'],
                        'payment_method'      => $payment['method'],
                        'payment_destination' => $payment['destination'],
                    ]);

                    // 🟢 NUEVO: Si pagó con VALE, descontamos el saldo
                    if ($payment['method'] === 'vale') {
                        $vale = \App\Models\StoreCredit::where('code', $payment['destination'])->where('status', 'active')->first();
                        if ($vale) {
                            $nuevoSaldo = $vale->amount - (float) $payment['amount'];
                            $vale->update([
                                'amount' => max(0, $nuevoSaldo),
                                'status' => $nuevoSaldo <= 0 ? 'used' : 'active'
                            ]);
                        }
                    }
                }
            }

            return response()->json([
                'message' => 'Venta registrada exitosamente',
                'receipt' => $sale->load(['items.productVariant.product', 'payments']),
            ], 201);
        }); // <-- Aquí se cierra correctamente la transacción de la línea 41
    } // <-- Aquí cierra la función store()

    // =========================================================================
    // 📊 2. FUNCIÓN INDEX: LECTURA DEL HISTORIAL (Sintaxis Cuadrada)
    // =========================================================================
    public function index(\Illuminate\Http\Request $request)
    {

       $columnaMarca     = 'brand';
        $columnaModelo    = 'model';
        $columnaAmperaje  = 'amperage';
        $columnaPolaridad = 'poles';
        $columnaTotal     = 'total_amount';
        $columnaTipo      = 'status';

        $query = \App\Models\Sale::with(['customer', 'items.productVariant.product', 'payments']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('receipt_number', 'like', '%' . $search . '%')
                    ->orWhereHas('customer', function ($element) use ($search) {
                        $element->where('name', 'like', '%' . $search . '%');
                    });
            });
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('created_at', [$request->start_date . ' 00:00:00', $request->end_date . ' 23:59:59']);
        }

        // 🎯 FILTRO DE TIPOS Y PAGOS MIXTOS ULTRA-SEGURO (Limpio y directo)
        if ($request->filled('sale_type')) {
            $tipo = $request->sale_type;

            if ($tipo === 'credito') {
                $query->where($columnaTipo, '!=', 'paid');
            } elseif ($tipo === 'contado') {
                $query->where($columnaTipo, '=', 'paid');
            } else {
                // Buscamos los IDs de forma totalmente aislada para no alterar la consulta estructural de la tabla
                $salesIdsConEsePago = \App\Models\SalePayment::where('payment_method', 'LIKE', '%' . $tipo . '%')
                    ->pluck('sale_id')
                    ->toArray();

                $query->where($columnaTipo, '=', 'paid')
                      ->whereIn('id', $salesIdsConEsePago);
            }
        }

        if ($request->filled('brand')) {
            $brand = $request->brand;
            $query->whereHas('items.productVariant.product', function ($q) use ($brand, $columnaMarca) {
                $q->where($columnaMarca, 'like', '%' . $brand . '%');
            });
        }
        if ($request->filled('model')) {
            $model = $request->model;
            $query->whereHas('items.productVariant.product', function ($q) use ($model, $columnaModelo) {
                $q->where($columnaModelo, 'like', '%' . $model . '%');
            });
        }
        if ($request->filled('amperage')) {
            $amperage = $request->amperage;
            $query->whereHas('items.productVariant.product', function ($q) use ($amperage, $columnaAmperaje) {
                $q->where($columnaAmperaje, 'like', '%' . $amperage . '%');
            });
        }
        if ($request->filled('polarity')) {
            $polarity = $request->polarity;
            $query->whereHas('items.productVariant.product', function ($q) use ($polarity, $columnaPolaridad) {
                $q->where($columnaPolaridad, 'like', '%' . $polarity . '%');
            });
        }
        // =========================================================================
        // 🟢 NUEVOS KPIs PURIFICADOS (Alineados con tu visión de negocio)
        // =========================================================================
        $clonedQuery = clone $query;
        $salesIds = $clonedQuery->pluck('id');

        // 1. Vueltos totales de las operaciones nativas de hoy
        $totalVueltosEntregados = \App\Models\Sale::whereIn('id', $salesIds)
            ->whereRaw('paid_amount > total_amount')
            ->selectRaw('SUM(paid_amount - total_amount) as total')
            ->value('total') ?: 0;

        // 2. Créditos que acaban de NACER el día de hoy (Siguen pendientes de pago)
        $creditTotal = \App\Models\Sale::whereIn('id', $salesIds)
            ->where($columnaTipo, '!=', 'paid')
            ->sum($columnaTotal) ?: 0;

        // 3. Ventas puras en EFECTIVO de operaciones que nacieron y se pagaron al contado hoy
        // Excluimos cualquier registro huérfano de abonos que use la tabla general
        $rawCash = \App\Models\SalePayment::whereIn('sale_id', $salesIds)
            ->where('payment_method', 'efectivo')
            ->where('payment_destination', 'not like', '%COBRANZA%')
            ->where('payment_destination', 'not like', '%LOTE%')
            ->where('payment_destination', 'not like', '%ABONO%')
            ->sum('amount') ?: 0;
        $cashTotal = ($rawCash - $totalVueltosEntregados) > 0 ? ($rawCash - $totalVueltosEntregados) : 0;

        // 4. Ventas puras DIGITALES de operaciones al contado de hoy
        $electronicTotal = \App\Models\SalePayment::whereIn('sale_id', $salesIds)
            ->where('payment_method', '!=', 'efectivo')
            ->where('payment_destination', 'not like', '%COBRANZA%')
            ->where('payment_destination', 'not like', '%LOTE%')
            ->where('payment_destination', 'not like', '%ABONO%')
            ->sum('amount') ?: 0;

        // 5. CAJA TOTAL BRUTA REAL (Solo lo recaudado por operaciones genuinas de hoy)
        // Evitamos sumar las ventas de créditos del pasado que fueron pagadas hoy
        $grandTotal = $cashTotal + $electronicTotal;

        // =========================================================================
        // 6. FILTRO DE VISTA: Ocultamos del listado diario las ventas antiguas que se pagaron hoy por lote
        // =========================================================================

        // Solo restringimos la vista si la cajera NO ha seleccionado fechas manualmente
        if (!$request->filled('start_date') && !$request->filled('end_date')) {

            // 🟢 SOLUCIÓN AUDITADA: Forzamos a Carbon a sacar la fecha real de Perú
            $todayStr = \Carbon\Carbon::now('America/Lima')->toDateString();

            $query->where(function($q) use ($todayStr) {
                $q->whereDate('created_at', $todayStr)
                  ->orWhere(function($sub) {
                      $sub->where('status', '!=', 'paid');
                  });
            });
        }

        $paginatedSales = $query->orderBy('id', 'desc')->paginate(10);


        $paginatedSales->getCollection()->transform(function ($sale) {
            $sale->totalAmount = (float) $sale->total_amount;
            $esCredito = ($sale->status !== 'paid') || (strpos(strtolower($sale->notes), 'credito') !== false);
            $sale->saleType = $esCredito ? 'credito' : 'contado';
            $sale->vueltoReal = $sale->paid_amount > $sale->total_amount ? (float)($sale->paid_amount - $sale->total_amount) : 0;

            // ====================== NUEVO: CÁLCULO NETO INTELIGENTE ======================
            $vueltoRestante = $sale->vueltoReal;

            $sale->payments_net = $sale->payments->map(function ($p) use (&$vueltoRestante) {
                $amount = (float) $p->amount;
                $destination = $p->payment_destination ?? ($p->payment_method === 'efectivo' ? 'Caja Principal' : 'General');

                // Detectamos si es un pago extra por cambio
                $isDifference = strpos(strtoupper($destination), 'DIFERENCIA') !== false;

                // Al efectivo original le restamos el vuelto para sacar el "neto" real de esa operación
                if ($p->payment_method === 'efectivo' && !$isDifference && $vueltoRestante > 0) {
                    if ($amount >= $vueltoRestante) {
                        $amount -= $vueltoRestante;
                        $vueltoRestante = 0;
                    } else {
                        $vueltoRestante -= $amount;
                        $amount = 0;
                    }
                }

                return [
                    'method'      => $p->payment_method,
                    'destination' => $destination,
                    'amount'      => $amount,
                    'is_difference' => $isDifference
                ];
            })->filter(function ($p) {
                return $p['amount'] > 0; // Ocultamos la fila si el vuelto la dejó en cero
            })->values();

            // Mantenemos payments_mapped original para otros usos
            $sale->payments_mapped = $sale->payments->map(function ($p) {
                return [
                    'method'      => $p->payment_method,
                    'destination' => $p->payment_destination ?? 'General',
                    'amount'      => (float) $p->amount
                ];
            });

            if ($sale->items) {
                foreach ($sale->items as $item) {
                    $item->name  = $item->productVariant->product->name ?? 'Producto SKU: ' . ($item->productVariant->sku ?? '');
                    $item->price = (float) $item->unit_price;
                }
            }
            return $sale;
        });

        return response()->json([
            'sales' => $paginatedSales,
            'kpis' => [
                'cash'        => $cashTotal,
                'electronic'  => $electronicTotal,
                'credit'      => $creditTotal,
                'grandTotal'  => $grandTotal
            ]
        ]);
    } // <-- Aquí cierra la función index()
}
