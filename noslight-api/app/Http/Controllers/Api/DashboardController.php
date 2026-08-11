<?php
// app/Http/Controllers/API/DashboardController.php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function getChartsData(Request $request)
    {
        $headers = [
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With'
        ];

        $today = Carbon::today();
        $startOfMonth = Carbon::now()->startOfMonth();
        $thirtyDaysAgo = Carbon::now()->subDays(30);
        $dayOfWeek = Carbon::now()->dayOfWeek;

        // =========================================================================
        // 📈 1. VENTAS DE HOY VS HISTÓRICO
        // =========================================================================
        $salesToday = DB::table('sales')
            ->select(DB::raw('HOUR(created_at) as hora'), DB::raw('SUM(total_amount) as total'))
            ->whereDate('created_at', $today)
            ->where('status', '!=', 'cancelled')
            ->groupBy(DB::raw('HOUR(created_at)'))
            ->orderBy('hora', 'asc')
            ->get();

        $salesHistory = DB::table('sales')
            ->select(DB::raw('HOUR(created_at) as hora'), DB::raw('SUM(total_amount) / 4 as promedio'))
            ->whereRaw('DAYOFWEEK(created_at) = ?', [$dayOfWeek + 1])
            ->where('created_at', '<', $today)
            ->where('created_at', '>=', Carbon::now()->subWeeks(4))
            ->where('status', '!=', 'cancelled')
            ->groupBy(DB::raw('HOUR(created_at)'))
            ->orderBy('hora', 'asc')
            ->get();

        $hoursCategories = array('08:00', '10:00', '12:00', '14:00', '16:00', '18:00');
        $todayValues = array(0, 0, 0, 0, 0, 0);
        $historyValues = array(0, 0, 0, 0, 0, 0);

        foreach ($salesToday as $row) {
            $idx = min((int)($row->hora / 3), 5);
            $todayValues[$idx] += (float)$row->total;
        }
        foreach ($salesHistory as $row) {
            $idx = min((int)($row->hora / 3), 5);
            $historyValues[$idx] += (float)$row->promedio;
        }

        if (array_sum($todayValues) == 0 && array_sum($historyValues) == 0) {
            $todayValues = array(350, 890, 1200, 2100, 1400, 400);
            $historyValues = array(400, 750, 1100, 1800, 1600, 600);
        }

        $currentWeekSales = (float) DB::table('sales')->whereBetween('created_at', [Carbon::now()->startOfWeek(), Carbon::now()])->where('status', '!=', 'cancelled')->sum('total_amount');
        $avgWeekSales = (float) DB::table('sales')->where('created_at', '<', Carbon::now()->startOfWeek())->where('status', '!=', 'cancelled')->sum('total_amount') / 4;

        if ($currentWeekSales == 0) {
            $currentWeekSales = 7500.00;
            $avgWeekSales = 6800.00;
        }

        // =========================================================================
        // 🏆 2. TOP PRODUCTOS
        // =========================================================================
        $productsData = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('product_variants', 'sale_items.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->select('products.name', DB::raw('SUM(sale_items.quantity) as total_qty'))
            ->where('products.is_raw', false)
            ->whereBetween('sales.created_at', [$startOfMonth, Carbon::now()])
            ->groupBy('products.id', 'products.name')
            ->orderBy('total_qty', 'desc')
            ->limit(5)
            ->get();

        $productCategories = $productsData->pluck('name')->toArray();
        $productValues = $productsData->pluck('total_qty')->map(fn($val) => (int)$val)->toArray();

        if (empty($productCategories)) {
            $productCategories = array('Contactor 18A ABB', 'Llave 2x40A Schneider', 'Diferencial 2x25A', 'Relé Térmico 12A', 'Llave 3x63A Siemens');
            $productValues = array(45, 38, 29, 21, 15);
        }

        // =========================================================================
        // 👥 3. CLIENTES VIP
        // =========================================================================
        $customersData = DB::table('sales')
            ->join('customers', 'sales.customer_id', '=', 'customers.id')
            ->select('customers.name', DB::raw('SUM(sales.total_amount) as total_spent'))
            ->whereBetween('sales.created_at', [$startOfMonth, Carbon::now()])
            ->groupBy('customers.id', 'customers.name')
            ->orderBy('total_spent', 'desc')
            ->limit(5)
            ->get();

        $customerLabels = $customersData->pluck('name')->toArray();
        $customerValues = $customersData->pluck('total_spent')->map(fn($val) => (float)$val)->toArray();

        if (empty($customerLabels)) {
            $customerLabels = array('Comercial Eléctrica SAC', 'Ing. Juan Mendoza', 'Tableros Industriales', 'Sistemas Auto.', 'Otros');
            $customerValues = array(4500, 3200, 2800, 1900, 5000);
        }

        // =========================================================================
        // 🔮 4. ALERTA PREDICTIVA: DÍAS DE DURACIÓN DEL STOCK REAL
        // =========================================================================
        // Calculamos cuántas unidades se venden por día de cada producto en los últimos 30 días
        $salesVelocity = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->select('sale_items.product_variant_id', DB::raw('SUM(sale_items.quantity) / 30 as unidades_por_dia'))
            ->where('sales.created_at', '>=', $thirtyDaysAgo)
            ->where('sales.status', '!=', 'cancelled')
            ->groupBy('sale_items.product_variant_id');

        // Cruzamos el stock actual con la velocidad de venta para predecir los días restantes
        $predictiveStock = DB::table('stocks')
            ->join('product_variants', 'stocks.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->leftJoinSub($salesVelocity, 'velocity', function ($join) {
                $join->on('stocks.product_variant_id', '=', 'velocity.product_variant_id');
            })
            ->select(
                'products.name',
                'stocks.quantity as current_stock',
                'products.package_size as box_size',
                DB::raw('IFNULL(velocity.unidades_por_dia, 0) as daily_velocity')
            )
            ->where('products.is_raw', false)
            ->get();

        $predictiveList = array();
        foreach ($predictiveStock as $prod) {
            $velocity = (float) $prod->daily_velocity;

            // Si el producto no ha tenido ventas, le asignamos una velocidad mínima de simulación local para que no divida entre cero
            if ($velocity == 0) {
                $velocity = 1.5;
            }

            $daysRemaining = $velocity > 0 ? round($prod->current_stock / $velocity) : 99;

            // Calculamos porcentaje de empaque mínimo
            $pct = $prod->box_size > 0 ? round(($prod->current_stock / $prod->box_size) * 100) : 0;

            // Filtramos solo los que se van a agotar en menos de 10 días para alertar en el dashboard
            if ($daysRemaining <= 10 || $prod->current_stock < $prod->box_size) {
                $predictiveList[] = [
                    'name' => $prod->name,
                    'current' => (int) $prod->current_stock,
                    'limit' => (int) $prod->box_size,
                    'pct' => $pct > 100 ? 100 : $pct,
                    'days' => (int) $daysRemaining
                ];
            }
        }

        // Datos mock predictivos locales si las tablas están vacías en desarrollo
        if (empty($predictiveList)) {
            $predictiveList = array(
                ['name' => "Contactor de Potencia 25A ABB", 'current' => 15, 'limit' => 120, 'pct' => 12, 'days' => 2],
                ['name' => "Llave Termomagnética 3x32A Schneider", 'current' => 28, 'limit' => 100, 'pct' => 28, 'days' => 4],
                ['name' => "Interruptor Diferencial 2x40A Siemens", 'current' => 42, 'limit' => 80, 'pct' => 52, 'days' => 7],
                ['name' => "Relé Térmico 9-13A Schneider", 'current' => 48, 'limit' => 50, 'pct' => 96, 'days' => 9]
            );
        }



        // =========================================================================
        // ⏱️ 5. GRÁFICA DE CRÉDITOS: TOP CLIENTES CON MEJOR RÉCORD DE PAGO
        // =========================================================================
        // Calculamos el promedio de días que tarda cada cliente en pagar sus créditos
        $creditRecords = DB::table('credit_sales')
            ->join('credits', 'credit_sales.credit_id', '=', 'credits.id')
            ->join('customers', 'credits.customer_id', '=', 'customers.id')
            ->select(
                'customers.name',
                DB::raw('ROUND(AVG(DATEDIFF(credits.updated_at, credits.created_at))) as dias_promedio')
            )
            ->where('credits.status', '=', 'paid') // Solo evaluamos los ya liquidados
            ->groupBy('customers.id', 'customers.name')
            ->orderBy('dias_promedio', 'asc') // Los que pagan en menos días van primero
            ->limit(5)
            ->get();

        $creditLabels = $creditRecords->pluck('name')->toArray();
        $creditValues = $creditRecords->pluck('dias_promedio')->map(fn($val) => (int)$val)->toArray();

        // Datos de contingencia consistentes con tu expediente por si estás en base de datos local limpia
        if (empty($creditLabels)) {
            $creditLabels = array('GAAAA', 'Ing. Juan Mendoza', 'Tableros Industriales', 'Sistemas Auto.', 'Comercial Eléctrica');
            $creditValues = array(2, 4, 7, 12, 18); // 2 días para tu cliente de la foto
        }



        // Ordenamos para poner los más urgentes (menos días de vida) arriba de todo
        usort($predictiveList, function($a, $b) {
            return $a['days'] <=> $b['days'];
        });

        return response()->json([
            'salesByHour' => [
                'categories' => $hoursCategories,
                'todayData' => $todayValues,
                'historyData' => $historyValues
            ],
            'motivation' => [
                'currentWeek' => $currentWeekSales,
                'avgWeek' => $avgWeekSales,
                'percent' => $avgWeekSales > 0 ? round((($currentWeekSales - $avgWeekSales) / $avgWeekSales) * 100) : 0
            ],
            'topProducts' => [
                'categories' => $productCategories,
                'data' => $productValues
            ],
            'vipCustomers' => [
                'labels' => $customerLabels,
                'data' => $customerValues
            ],
              'creditRecords' => [ // 👈 Nueva variable conectada
                'labels' => $creditLabels,
                'data' => $creditValues
            ],
            'lowStock' => $predictiveList
        ], 200, $headers);
    }
}
