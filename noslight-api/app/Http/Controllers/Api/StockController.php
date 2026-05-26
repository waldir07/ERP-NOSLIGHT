<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stock;
use Illuminate\Http\Request;

class StockController extends Controller
{
    public function index(Request $request)
    {
        $stocks = Stock::query()
            ->with([
                'productVariant' => fn($q) => $q->select('id', 'product_id', 'amperage', 'sku', 'is_finished'),
                'productVariant.product' => fn($q) => $q->select('id', 'name', 'base_code', 'model', 'is_raw', 'is_direct_sale'),
                'warehouse:id,name,code'
            ])
            ->when($request->warehouse_id, fn($q) => $q->where('warehouse_id', $request->warehouse_id))
            ->when($request->is_raw !== null, function ($q) use ($request) {
                $isRawRequested = filter_var($request->is_raw, FILTER_VALIDATE_BOOLEAN);

                return $q->whereHas('productVariant.product', function ($qp) use ($isRawRequested) {
                    if ($isRawRequested) {
                        $qp->where('is_raw', true);
                    } else {
                        $qp->where('is_raw', false)
                            ->orWhere('is_direct_sale', true);
                    }
                });
            })
            ->get();

        return response()->json($stocks);
    }
    /**
     * Alertas de stock bajo para productos terminados en Tienda
     */
    public function lowFinishedStock(Request $request)
    {
        $threshold = $request->threshold ?? 20; // Umbral por defecto 20, puedes pasarlo ?threshold=10

        $lowStocks = Stock::query()
            ->where('quantity', '<', $threshold)
            ->whereHas('productVariant', fn($q) => $q->where('is_finished', true))
            ->whereHas('warehouse', fn($q) => $q->where('code', 'TIENDA'))
            ->with([
                'productVariant.product:id,name,base_code,model',
                'productVariant' => fn($q) => $q->select('id', 'product_id', 'amperage', 'sku', 'sale_price'),
                'warehouse' => fn($q) => $q->select('id', 'name', 'code')
            ])
            ->orderBy('quantity', 'asc') // los más bajos primero
            ->get();

        return response()->json([
            'message' => 'Productos terminados con stock bajo en Tienda',
            'threshold_used' => $threshold,
            'low_stocks' => $lowStocks,
            'total_low' => $lowStocks->count(),
        ]);
    }

    /**
     * Alertas de stock bajo para raw en Almacén Principal
     */
    public function lowRawStock(Request $request)
    {
        $threshold = $request->threshold ?? 50; // Umbral por defecto 50

        $lowStocks = Stock::query()
            ->where('is_raw', true)
            ->where('quantity', '<', $threshold)
            ->whereHas('warehouse', fn($q) => $q->where('code', 'PRINCIPAL'))
            ->with([
                'productVariant.product:id,name,base_code,model',
                'productVariant' => fn($q) => $q->select('id', 'product_id', 'amperage', 'sku'),
                'warehouse' => fn($q) => $q->select('id', 'name', 'code')
            ])
            ->orderBy('quantity', 'asc')
            ->get();

        return response()->json([
            'message' => 'Stock raw bajo en Almacén Principal',
            'threshold_used' => $threshold,
            'low_stocks' => $lowStocks,
            'total_low' => $lowStocks->count(),
        ]);
    }

    public function getStoreStock()
    {
        // 1. Buscamos todo el stock del almacén 2 (Tienda) trayendo sus relaciones
        $stocks = \App\Models\Stock::with(['productVariant.product'])
            ->where('warehouse_id', 2)
            ->get();

        // 2. Mapeamos (transformamos) los datos para que React los reciba limpios
        $formattedData = $stocks->map(function ($stock) {
            $variant = $stock->productVariant;
            $product = $variant ? $variant->product : null;

            return [
                'id' => $stock->id,
                'name' => $product ? $product->name : 'Producto sin nombre',
                'sku' => $variant ? $variant->sku : 'Sin SKU',
                'model' => $product && $product->model ? $product->model : 'Sin modelo',
                'brand' => $product && $product->brand ? $product->brand : 'Sin marca',
                'amps' => $product && $product->amperage ? $product->amperage . 'A' : '-',
                'poles' => $product && $product->poles ? $product->poles : '-',
                'stock' => $stock->quantity,
                'minStock' => $product && $product->package_size ? $product->package_size : 10,
                // 👇 ESTA ES LA LÍNEA QUE FALTABA PARA ENVIAR EL PRECIO A REACT
                // Busca el precio en la variante, si no existe o es 0, lo busca en el producto base
                // Ahora busca en sale_price (variante) y si no hay, usa el cost_price (producto)
                'base_price' => (float) ($variant->sale_price ?? $product->cost_price ?? 0),

                'raw_variant' => $variant,
                'raw_product' => $product,
            ];
        });

        // 3. Lo enviamos como respuesta JSON
        return response()->json($formattedData);
    }
}
