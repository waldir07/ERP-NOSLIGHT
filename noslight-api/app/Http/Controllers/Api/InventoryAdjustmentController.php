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
    /*public function getAdminUnifiedStockList(Request $request)
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
    }*/

    public function getAdminUnifiedStockList(Request $request)
    {
        $search = $request->input('search');
        $type = $request->input('type', 'ALL');
        $page = (int) $request->input('page', 1);
        $perPage = 15;

        // 1. Cargamos Almacenes en memoria quieto (solo son 2)
        $warehouses = \App\Models\Warehouse::all()->keyBy('id');
        $almacenRaw = $warehouses->get(1);
        $tienda = $warehouses->get(2);

        // 2. Base de la consulta usando un Query Builder (Filtrado Real en Base de Datos)
        // Buscamos primero en las variantes, ya que ahí están los SKUs individuales
        $query = \App\Models\ProductVariant::query()
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->select(
                'products.id as product_id',
                'product_variants.id as variant_id',
                'products.name',
                'products.base_code',
                'product_variants.sku',
                'products.brand',
                'product_variants.amperage',
                'products.is_raw'
            );

        // 3. APLICAR FILTROS DIRECTOS EN LA BASE DE DATOS ⚡
        if ($type !== 'ALL') {
            $query->where('products.is_raw', $type === 'RAW' ? 1 : 0);
        }

        if (!empty($search)) {
            // Buscamos coincidencia exacta por el SKU de la variante
            // O por el código base si el producto no tuviera variante directa
            $query->where(function ($q) use ($search) {
                $q->where('product_variants.sku', '=', $search)
                    ->orWhere('products.base_code', '=', $search);
            });
        }

        // 4. Paginamos directamente en la Base de Datos (Solo procesa 15 registros, no miles)
        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        // 5. Mapeamos SOLAMENTE los 15 resultados de esta página para inyectarles el stock actual
        $items = collect($paginated->items())->map(function ($item) use ($almacenRaw, $tienda) {
            $targetWarehouse = $item->is_raw ? $almacenRaw : $tienda;
            $stockQty = 0;

            if ($targetWarehouse) {
                $stock = \App\Models\Stock::where('product_variant_id', $item->variant_id)
                    ->where('warehouse_id', $targetWarehouse->id)
                    ->first();
                $stockQty = $stock ? $stock->quantity : 0;
            }

            // Devolvemos el mismo formato exacto que tenías
            return [
                'product_id' => $item->product_id,
                'variant_id' => $item->variant_id,
                'name' => $item->name,
                'base_code' => $item->base_code,
                'sku' => $item->sku ?? ($item->is_raw ? 'M-' . $item->base_code : $item->base_code),
                'brand' => $item->brand,
                'amperage' => $item->amperage,
                'is_raw' => (bool)$item->is_raw,
                'current_stock' => $stockQty,
                'warehouse_name' => $item->is_raw ? 'Almacén (Raw)' : 'Tienda (Terminado)'
            ];
        });

        // 6. Retornamos la respuesta paginada idéntica a como la espera React
        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => $items,
            'first_page_url' => $paginated->url(1),
            'from' => $paginated->firstItem(),
            'last_page' => $paginated->lastPage(),
            'last_page_url' => $paginated->url($paginated->lastPage()),
            'next_page_url' => $paginated->nextPageUrl(),
            'path' => $request->url(),
            'per_page' => $paginated->perPage(),
            'prev_page_url' => $paginated->previousPageUrl(),
            'to' => $paginated->lastItem(),
            'total' => $paginated->total(),
        ]);
    }


    // 2. Ajuste directo fila por fila (Modo Dios: Blindado contra negativos)
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

        // 🛡️ PASO 1: Buscar el stock actual antes de hacer nada
        $stockRecord = \App\Models\Stock::where('product_variant_id', $variant->id)
            ->where('warehouse_id', $warehouse->id)
            ->first();

        $stockActual = $stockRecord ? $stockRecord->quantity : 0;

        // 🛡️ PASO 2: Si es una resta, verificar que no nos pasemos de cero
        if ($request->quantity < 0) {
            $cantidadARestar = abs($request->quantity); // Convertir a positivo para comparar
            if ($cantidadARestar > $stockActual) {
                // Devolvemos un error 422 (Unprocessable Entity) que React puede leer fácilmente
                return response()->json([
                    'message' => "Operación denegada: Intentas restar {$cantidadARestar} unidades, pero solo hay {$stockActual} en stock."
                ], 422);
            }
        }

        // 🚀 PASO 3: Si pasó la seguridad, ejecutamos la transacción
        return \Illuminate\Support\Facades\DB::transaction(function () use ($product, $variant, $warehouse, $request, $user, $stockRecord) {

            // Si el stock no existía, lo creamos
            if (!$stockRecord) {
                $stockRecord = \App\Models\Stock::create([
                    'product_variant_id' => $variant->id,
                    'warehouse_id' => $warehouse->id,
                    'quantity' => 0
                ]);
            }

            // Hacemos la suma o resta real
            $stockRecord->increment('quantity', $request->quantity);

            $tipoAjuste = $request->quantity > 0 ? 'INGRESO_MANUAL_ADMIN' : 'SALIDA_MANUAL_ADMIN';
            $accionDesc = $request->quantity > 0 ? 'Inyección' : 'Descuento';

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
                'new_stock' => $stockRecord->fresh()->quantity // Devolvemos el stock exacto actualizado
            ]);
        });
    }
}
