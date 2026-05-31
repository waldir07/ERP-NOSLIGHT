<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\InventoryAdjustment;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;
use App\Models\Stock;
use Illuminate\Validation\Rule;

class InventoryAdjustmentController extends Controller
{
    // 1. El operario solo solicita
    public function store(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required',
            'warehouse_id' => 'required',
            'quantity' => 'required|integer', // Positivo suma, negativo resta
            'reason' => 'required|string',
            'notes' => 'nullable'
        ]);

        InventoryAdjustment::create($data + [
            'user_id' => auth()->id(),
            'status' => 'PENDIENTE'
        ]);

        return response()->json(['message' => 'Solicitud enviada al Administrador']);
    }

    // 2. TÚ apruebas y aquí es donde el stock REALMENTE se mueve
    public function approve($id)
    {
        return DB::transaction(function () use ($id) {
            $adj = InventoryAdjustment::findOrFail($id);
            if ($adj->status !== 'PENDIENTE') return response()->json(['error' => 'Ya procesado'], 400);

            // Mover el stock
            $variant = ProductVariant::where('product_id', $adj->product_id)->first();
            $stock = Stock::firstOrCreate(
                ['product_variant_id' => $variant->id, 'warehouse_id' => $adj->warehouse_id],
                ['quantity' => 0]
            );

            $stock->increment('quantity', $adj->quantity);

            $adj->update([
                'status' => 'APROBADO',
                'approved_by' => auth()->id()
            ]);

            return response()->json(['message' => 'Stock actualizado correctamente']);
        });
    }

    // Método exclusivo de Admin para inyección directa masiva
    public function bulkAdminInject(Request $request)
    {
        $request->validate([
            'warehouse_code' => 'required|string|in:ALMACEN,TIENDA',
            'items'          => 'required|array',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.amperage'   => 'required|integer',
            'items.*.quantity'   => 'required|integer|min:1',
        ]);

        $user = auth()->id();
        $warehouse = \App\Models\Warehouse::where('code', $request->warehouse_code)->firstOrFail();

        return DB::transaction(function () use ($request, $user, $warehouse) {
            foreach ($request->items as $item) {
                $variant = ProductVariant::where('product_id', $item['product_id'])
                    ->where('amperage', $item['amperage'])
                    ->first();

                if (!$variant) {
                    continue;
                }

                $stock = Stock::firstOrCreate(
                    ['product_variant_id' => $variant->id, 'warehouse_id' => $warehouse->id],
                    ['quantity' => 0]
                );

                $stock->increment('quantity', $item['quantity']);

                InventoryAdjustment::create([
                    'product_id'   => $item['product_id'],
                    'warehouse_id' => $warehouse->id,
                    'quantity'     => $item['quantity'],
                    'reason'       => 'INVENTARIO_INICIAL',
                    'notes'        => 'Inyección masiva directa realizada por el Administrador',
                    'user_id'      => $user,
                    'status'       => 'APROBADO',
                    'approved_by'  => $user
                ]);
            }

            return response()->json(['message' => '¡Lote de inventario inicial inyectado con éxito!']);
        });
    }

    // --- LAS 2 FUNCIONES NUEVAS DEL MODO DIOS ---

    // 1. Obtener la lista unificada (Con Paginación y Filtros Inteligentes)
    public function getAdminUnifiedStockList(Request $request)
    {
        $products = \App\Models\Product::all();
        $warehouses = \App\Models\Warehouse::all()->keyBy('id');
        $almacenRaw = $warehouses->get(1);
        $tienda = $warehouses->get(2);

        $result = collect();

        foreach ($products as $product) {
            $variants = \App\Models\ProductVariant::where('product_id', $product->id)->get();

            if ($variants->isEmpty()) {
                $sku = $product->is_raw ? 'M-' . $product->base_code : $product->base_code;
                $result->push([
                    'product_id' => $product->id,
                    'variant_id' => null,
                    'name' => $product->name,
                    'base_code' => $product->base_code,
                    'sku' => $sku,
                    'brand' => $product->brand,
                    'amperage' => $product->amperage,
                    'is_raw' => $product->is_raw,
                    'current_stock' => 0,
                    'warehouse_name' => $product->is_raw ? 'Almacén (Raw)' : 'Tienda (Terminado)'
                ]);
                continue;
            }

            foreach ($variants as $variant) {
                $targetWarehouse = $product->is_raw ? $almacenRaw : $tienda;
                $stockQty = 0;

                if ($targetWarehouse) {
                    $stock = \App\Models\Stock::where('product_variant_id', $variant->id)
                        ->where('warehouse_id', $targetWarehouse->id)
                        ->first();
                    $stockQty = $stock ? $stock->quantity : 0;
                }

                $result->push([
                    'product_id' => $product->id,
                    'variant_id' => $variant->id,
                    'name' => $product->name,
                    'base_code' => $product->base_code,
                    'sku' => $variant->sku ?? ($product->is_raw ? 'M-' . $product->base_code : $product->base_code),
                    'brand' => $product->brand,
                    'amperage' => $variant->amperage ?? $product->amperage,
                    'is_raw' => $product->is_raw,
                    'current_stock' => $stockQty,
                    'warehouse_name' => $product->is_raw ? 'Almacén (Raw)' : 'Tienda (Terminado)'
                ]);
            }
        }

        // Aplicar filtros
        if ($request->filled('type') && $request->type !== 'ALL') {
            $isRawExpected = $request->type === 'RAW';
            $result = $result->filter(function ($item) use ($isRawExpected) {
                return $item['is_raw'] === $isRawExpected;
            });
        }

        if ($request->filled('search')) {
            $search = strtolower($request->search);
            $result = $result->filter(function ($item) use ($search) {
                return str_contains(strtolower($item['name']), $search) ||
                       str_contains(strtolower($item['sku']), $search) ||
                       str_contains(strtolower($item['base_code']), $search);
            });
        }

        $result = $result->values();

        // Paginación inteligente
        if ($request->has('page')) {
            $page = (int) $request->input('page', 1);
            $perPage = 15;

            $paginated = new \Illuminate\Pagination\LengthAwarePaginator(
                $result->forPage($page, $perPage)->values(),
                $result->count(),
                $perPage,
                $page,
                ['path' => $request->url(), 'query' => $request->query()]
            );
            return response()->json($paginated);
        }

        return response()->json($result);
    }

    // 2. Ajuste directo fila por fila (Modo Dios: acepta negativos)
    public function injectSingleRowStock(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'variant_id' => 'nullable',
            'quantity'   => 'required|integer|not_in:0',
        ]);

        $product = \App\Models\Product::find($request->product_id);
        if (!$product) {
            return response()->json(['error' => 'El producto no existe en la BD.'], 404);
        }

        $user = auth()->id();
        $warehouseId = $product->is_raw ? 1 : 2;
        $warehouse = \App\Models\Warehouse::find($warehouseId);

        if (!$warehouse) {
            return response()->json(['message' => "ERROR FATAL: No se encontró el almacén."], 400);
        }

        if ($request->variant_id) {
            $variant = \App\Models\ProductVariant::find($request->variant_id);
        } else {
            $variant = \App\Models\ProductVariant::firstOrCreate(
                ['product_id' => $product->id, 'amperage' => $product->amperage],
                ['sku' => $product->is_raw ? 'M-' . $product->base_code : $product->base_code, 'is_finished' => !$product->is_raw]
            );
        }

        return \Illuminate\Support\Facades\DB::transaction(function () use ($product, $variant, $warehouse, $request, $user) {
            $stock = \App\Models\Stock::firstOrCreate(
                ['product_variant_id' => $variant->id, 'warehouse_id' => $warehouse->id],
                ['quantity' => 0]
            );

            $stock->increment('quantity', $request->quantity);

            $tipoAjuste = $request->quantity > 0 ? 'INGRESO_MANUAL_ADMIN' : 'SALIDA_MANUAL_ADMIN';
            $accionDesc = $request->quantity > 0 ? 'Inyección' : 'Descuento';

            // SOLUCIÓN: Solo guardamos los campos que realmente existen en tu BD
            \App\Models\InventoryAdjustment::create([
                'product_id'   => $product->id,
                'warehouse_id' => $warehouse->id,
                'quantity'     => $request->quantity,
                'reason'       => $tipoAjuste,
                'notes'        => "{$accionDesc} directa por el Administrador en Modo Dios",
                'user_id'      => $user,
            ]);

            return response()->json([
                'message' => 'Stock inyectado con éxito',
                'new_stock' => $stock->quantity
            ]);
        });
    }
}
