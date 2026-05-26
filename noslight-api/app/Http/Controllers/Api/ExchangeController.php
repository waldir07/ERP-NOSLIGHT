<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\ProductVariant;
use App\Models\Warehouse;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Exchange;
use App\Models\StoreCredit;
use Illuminate\Support\Str;

class ExchangeController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'sale_id'         => 'required|exists:sales,id',
            'return_items'    => 'array',
            'new_items'       => 'array',
            'condition'       => 'required|in:good,damaged',
            'payment_method'  => 'nullable|string', 
        ]);

        $user = $request->user();
        $sale = Sale::findOrFail($request->sale_id);

        $tienda = Warehouse::firstOrCreate(['code' => 'TIENDA'], ['name' => 'Tienda Principal']);
        $mermas = Warehouse::firstOrCreate(['code' => 'MERMAS'], ['name' => 'Almacén de Mermas']);

        return DB::transaction(function () use ($request, $user, $sale, $tienda, $mermas) {
            $totalDevuelto = 0;
            $totalNuevo = 0;

            // =======================================================
            // 1. PROCESAR DEVOLUCIONES (Lo que entra y se quita del ticket)
            // =======================================================
            $warehouseDestino = $request->condition === 'good' ? $tienda : $mermas;

            foreach ($request->return_items as $item) {
                if ($item['return_qty'] > 0) {
                    $subtotal = $item['return_qty'] * $item['price'];
                    $totalDevuelto += $subtotal;

                    // A. Aumentar Stock
                    $stock = Stock::firstOrCreate(
                        ['product_variant_id' => $item['product_variant_id'], 'warehouse_id' => $warehouseDestino->id],
                        ['quantity' => 0]
                    );
                    $stock->increment('quantity', $item['return_qty']);

                    // B. Registrar Kardex
                    StockMovement::create([
                        'stock_id'           => $stock->id,
                        'product_variant_id' => $item['product_variant_id'],
                        'warehouse_id'       => $warehouseDestino->id,
                        'type'               => 'entry',
                        'quantity'           => $item['return_qty'],
                        'unit_cost'          => $item['price'],
                        'reference'          => 'Cambio TKT-' . $sale->receipt_number,
                        'user_id'            => $user->id,
                        'notes'              => $request->condition === 'good' ? 'Devolución Buen Estado' : 'Devolución Merma',
                    ]);

                    // 🟢 C. MODIFICAR EL TICKET ORIGINAL (Quitar el producto)
                    $saleItem = SaleItem::find($item['id']);
                    if ($saleItem) {
                        if ($saleItem->quantity <= $item['return_qty']) {
                            // Si devuelve todo, borramos la línea del ticket
                            $saleItem->delete();
                        } else {
                            // Si devuelve una parte, restamos la cantidad y el subtotal
                            $saleItem->decrement('quantity', $item['return_qty']);
                            $saleItem->update(['subtotal' => $saleItem->quantity * $saleItem->unit_price]);
                        }
                    }
                }
            }

            // =======================================================
            // 2. PROCESAR NUEVOS PRODUCTOS (Lo que sale y se agrega al ticket)
            // =======================================================
            foreach ($request->new_items as $item) {
                if ($item['exchange_qty'] > 0) {
                    $subtotal = $item['exchange_qty'] * $item['price'];
                    $totalNuevo += $subtotal;

                    // Buscamos la variante del nuevo producto
                    $variant = ProductVariant::where('product_id', $item['id'])->first();

                    if ($variant) {
                        // A. Descontar Stock
                        $stock = Stock::firstOrCreate(
                            ['product_variant_id' => $variant->id, 'warehouse_id' => $tienda->id],
                            ['quantity' => 0]
                        );
                        $stock->decrement('quantity', $item['exchange_qty']);

                        // B. Registrar Kardex
                        StockMovement::create([
                            'stock_id'           => $stock->id,
                            'product_variant_id' => $variant->id,
                            'warehouse_id'       => $tienda->id,
                            'type'               => 'exit',
                            'quantity'           => $item['exchange_qty'],
                            'unit_cost'          => $item['price'],
                            'reference'          => 'Cambio TKT-' . $sale->receipt_number,
                            'user_id'            => $user->id,
                            'notes'              => 'Salida por Cambio',
                        ]);

                        // 🟢 C. AGREGAR AL TICKET ORIGINAL (Como una línea nueva)
                        $sale->items()->create([
                            'product_variant_id' => $variant->id,
                            'quantity'           => $item['exchange_qty'],
                            'unit_price'         => $item['price'],
                            'subtotal'           => $subtotal,
                        ]);
                    }
                }
            }

            // =======================================================
            // 3. MATEMÁTICA FINANCIERA Y ETIQUETADO DINÁMICO
            // =======================================================
            $diferencia = $totalNuevo - $totalDevuelto;
            $type = 'same_price';
            $storeCredit = null;

            if ($diferencia > 0) {
                $type = 'customer_paid_more';
                
                // 🟢 CAPTURAMOS EL DESTINO DE CUENTA Y LE SUMAMOS LA NOTA AL COSTADO
                $destinoBase = $request->input('payment_destination', 'Caja Principal');
                $destinoFinal = $destinoBase . ' (DIFERENCIA DE CAMBIO)';

                $sale->payments()->create([
                    'user_id'             => $user->id,
                    'amount'              => $diferencia,
                    'payment_method'      => $request->payment_method ?? 'efectivo',
                    'payment_destination' => $destinoFinal, // <-- Guardará Ej: "BCP HERMELINDA (DIFERENCIA DE CAMBIO)"
                ]);
                
                $sale->increment('total_amount', $diferencia);
                $sale->increment('paid_amount', $diferencia);
            }
            elseif ($diferencia < 0) {
                $type = 'store_credit_issued';
                $montoFavor = abs($diferencia);
                $code = 'VALE-' . strtoupper(Str::random(6));

                $storeCredit = StoreCredit::create([
                    'code'        => $code,
                    'customer_id' => $sale->customer_id,
                    'sale_id'     => $sale->id,
                    'amount'      => $montoFavor,
                    'status'      => 'active'
                ]);
            }

            Exchange::create([
                'sale_id'           => $sale->id,
                'user_id'           => $user->id,
                'type'              => $type,
                'amount_difference' => $diferencia,
            ]);

            return response()->json([
                'message'      => 'Operación procesada con éxito',
                'store_credit' => $storeCredit,
                'diferencia'   => $diferencia
            ]);
        });
    }
}