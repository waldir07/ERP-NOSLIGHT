<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockMovement;
use Illuminate\Http\Request;

class StockMovementController extends Controller
{
    /**
     * Listar movimientos de stock (historial paginado)
     */
    public function index(Request $request)
    {
        $movements = StockMovement::query()
            ->with([
                'stock.productVariant.product:id,name,base_code,model',
                'stock.productVariant' => fn($q) => $q->select('id', 'product_id', 'amperage', 'sku', 'is_finished'),
                'stock.warehouse:id,name,code',
                'user:id,name'
            ])
            ->when($request->type, fn($q) => $q->where('type', $request->type))
            ->when($request->warehouse_id, fn($q) => $q->whereHas('stock', fn($qs) => $qs->where('warehouse_id', $request->warehouse_id)))
            ->when($request->variant_id, fn($q) => $q->whereHas('stock', fn($qs) => $qs->where('product_variant_id', $request->variant_id)))
            ->when($request->date_from, fn($q) => $q->whereDate('created_at', '>=', $request->date_from))
            ->when($request->date_to, fn($q) => $q->whereDate('created_at', '<=', $request->date_to))
            ->latest('created_at')
            ->paginate(20);

        return response()->json($movements);
    }
}
