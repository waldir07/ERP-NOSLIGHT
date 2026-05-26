<?php

// app/Http/Controllers/Api/TransferController.php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transfer; // <--- Ahora sí existe
use App\Models\Stock;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransferController extends Controller
{


    public function index(Request $request)
    {
        try {
            $query = Transfer::with(['items.variant.product', 'sender', 'receiver']);


            // 1. Búsqueda por Código de Envío (Tabla Transfers)
            if ($request->filled('search')) {
                $search = $request->query('search');
                $query->where('transfer_number', 'LIKE', "%{$search}%");
            }

            if ($request->has('destination')) {
                $query->where('destination_warehouse_id', $request->destination);
            }

            // 2. Búsqueda por Modelo (Columna 'model' en tabla 'products')
            if ($request->filled('model')) {
                $model = $request->query('model');
                $query->whereHas('items.variant.product', function ($q) use ($model) {
                    $q->where('model', 'LIKE', "%{$model}%");
                });
            }

            // 3. Búsqueda por Amperaje (Columna 'amperage' en tabla 'products')
            if ($request->filled('amperaje')) {
                $amp = $request->query('amperaje');
                $query->whereHas('items.variant.product', function ($q) use ($amp) {
                    $q->where('amperage', 'LIKE', "%{$amp}%");
                });
            }

            // 4. Búsqueda por Polos (Columna 'poles' en tabla 'products')
            if ($request->filled('polos')) {
                $polos = $request->query('polos');
                $query->whereHas('items.variant.product', function ($q) use ($polos) {
                    $q->where('poles', 'LIKE', "%{$polos}%");
                });
            }

            // 5. Filtro por Rango de Fechas
            if ($request->filled('from') && $request->filled('to')) {
                $query->whereBetween('created_at', [$request->from . ' 00:00:00', $request->to . ' 23:59:59']);
            }

            // Filtro por destino (Tienda ID 2)
            if ($request->filled('destination')) {
                $query->where('destination_warehouse_id', $request->query('destination'));
            }

            if ($request->query('has_issue') === 'yes') {
                // Filtra los que tienen nota (discrepancia)
                $query->whereNotNull('discrepancy_note')->where('discrepancy_note', '!=', '');
            } elseif ($request->query('has_issue') === 'no') {
                // Filtra los que están limpios
                $query->where(function ($q) {
                    $q->whereNull('discrepancy_note')->orWhere('discrepancy_note', '');
                });
            }



            return $query->orderBy('created_at', 'desc')->get();
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function show(Transfer $transfer)
    {
        // Ver el detalle de un envío específico
        return $transfer->load(['items.variant.product', 'sender']);
    }


    public function bulkSend(Request $request)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        try {
            return DB::transaction(function () use ($request) {
                $transfer = Transfer::create([
                    'transfer_number' => 'TR-' . now()->format('Ymd-His'),
                    'sender_id' => $request->user()->id,
                    'status' => 'pending',
                    'destination_warehouse_id' => $request->destination_warehouse_id ?? 2, // Por defecto Tienda
                ]);

                foreach ($request->items as $item) {
                    // 1. ¡NUEVA SEGURIDAD! Buscamos el producto en la BD para saber SU VERDADERO amperaje
                    $product = \App\Models\Product::find($item['product_id']);

                    // 2. Buscamos la variante exacta cruzando el producto Y el amperaje real de la BD
                    $variant = ProductVariant::where('product_id', $item['product_id'])
                        ->where('amperage', $product->amperage)
                        ->first();

                    if (!$variant) {
                        throw new \Exception("Error: No se encontró variante para el producto " . $product->name);
                    }

                    // Restar del almacén principal (ID 1)
                    $stock = Stock::where('product_variant_id', $variant->id)
                        ->where('warehouse_id', 1)
                        ->first();

                    if (!$stock || $stock->quantity < $item['quantity']) {
                        throw new \Exception("Stock insuficiente para: " . $variant->sku);
                    }

                    $stock->decrement('quantity', $item['quantity']);

                    // Guardar en el detalle del envío
                    $transfer->items()->create([
                        'product_variant_id' => $variant->id,
                        'quantity' => $item['quantity']
                    ]);
                }

                return response()->json(['status' => 'success', 'transfer_id' => $transfer->id]);
            });
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
        }
    }

    // app/Http/Controllers/Api/TransferController.php

    public function receiveTransfer(Request $request, $id)
    {
        $transfer = Transfer::findOrFail($id);

        return DB::transaction(function () use ($transfer, $request) {
            // 1. Actualizar cantidades de los items
            foreach ($request->input('items') as $itemData) {
                // Cargamos el item junto con su variante y el producto para poder leer sus datos
                $item = $transfer->items()->with('variant.product')->find($itemData['id']);

                if ($item) {
                    $item->update(['received_quantity' => $itemData['received_quantity']]);

                    // Nivel de Magia Ninja: Buscar al Gemelo Perfecto
                    $finalVariantId = $item->product_variant_id; // Por defecto, es el mismo que se envió
                    $product = $item->variant->product ?? null;

                    // Si el producto existe y es Materia Prima (is_raw = 1)
                    if ($product && $product->is_raw) {

                        // Buscamos al gemelo: mismo base_code, pero is_raw = 0
                        $twinProduct = \App\Models\Product::where('base_code', $product->base_code)
                            ->where('is_raw', 0)
                            ->first();

                        if ($twinProduct) {
                            // 1. Obtenemos el amperaje de la variante original que está viajando
                            $originalVariant = \App\Models\ProductVariant::find($finalVariantId);

                            // 2. Buscamos la variante del gemelo EXIGIENDO que tenga el mismo amperaje
                            $twinVariant = \App\Models\ProductVariant::where('product_id', $twinProduct->id)
                                ->where('amperage', $originalVariant->amperage)
                                ->first();

                            if ($twinVariant) {
                                // ¡Encontramos al gemelo exacto! Cambiamos el ID destino
                                $finalVariantId = $twinVariant->id;
                            }
                        }
                    }

                    // Sumar al stock de tienda usando el ID correcto (el original o el gemelo)
                    $stock = \App\Models\Stock::firstOrCreate(
                        ['product_variant_id' => $finalVariantId, 'warehouse_id' => 2],
                        ['quantity' => 0]
                    );
                    $stock->increment('quantity', $itemData['received_quantity']);
                }
            }

            // 2. Actualizar cabecera
            $transfer->update([
                'status' => 'completed',
                'discrepancy_note' => $request->input('discrepancy_note'),
                'received_at' => now(),
                'receiver_id' => auth()->id()
            ]);

            return response()->json([
                'message' => '¡Recibido y procesado correctamente!',
                'note' => $transfer->discrepancy_note
            ]);
        });
    }
}
