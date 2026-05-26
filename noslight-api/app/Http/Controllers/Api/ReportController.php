<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transformation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Sale;

class ReportController extends Controller
{
    /**
     * Top de amperajes/productos más transformados
     */
    public function mostTransformed(Request $request)
    {
        $limit = $request->limit ?? 10;

        $most = Transformation::query()
            ->when($request->date_from, fn($q) => $q->whereDate('created_at', '>=', $request->date_from))
            ->when($request->date_to, fn($q) => $q->whereDate('created_at', '<=', $request->date_to))
            ->select([
                'finished_amperage as amperage',
                'product_id',
                DB::raw('SUM(quantity) as total_transformed'),
                DB::raw('COUNT(*) as times_transformed')
            ])
            ->groupBy('finished_amperage', 'product_id')
            ->orderByDesc('total_transformed')
            ->limit($limit)
            ->with(['product:id,name,base_code,model'])
            ->get();

        return response()->json([
            'message' => 'Amperajes y productos más transformados',
            'date_from' => $request->date_from,
            'date_to' => $request->date_to,
            'data' => $most,
            'total_records' => $most->count(),
        ]);
    }

    /**
     * Resumen de ventas: total por variant, ingresos estimados
     */
    public function salesSummary(Request $request)
    {
        $sales = Sale::query()
            ->when($request->date_from, fn($q) => $q->whereDate('created_at', '>=', $request->date_from))
            ->when($request->date_to, fn($q) => $q->whereDate('created_at', '<=', $request->date_to))
            ->select([
                'product_variant_id',
                DB::raw('SUM(quantity) as total_quantity'),
                DB::raw('SUM(total_amount) as total_income'),
                DB::raw('COUNT(*) as total_sales')
            ])
            ->groupBy('product_variant_id')
            ->orderByDesc('total_income')
            ->with([
                'productVariant' => fn($q) => $q->select('id', 'product_id', 'amperage', 'sku', 'sale_price'),
                'productVariant.product:id,name,base_code,model'
            ])
            ->get();

        $grandTotalIncome = $sales->sum('total_income');
        $grandTotalQuantity = $sales->sum('total_quantity');

        return response()->json([
            'message' => 'Resumen de ventas',
            'date_from' => $request->date_from,
            'date_to' => $request->date_to,
            'grand_total_income' => $grandTotalIncome,
            'grand_total_quantity' => $grandTotalQuantity,
            'sales_by_variant' => $sales,
        ]);
    }
}
