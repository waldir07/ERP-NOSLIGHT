<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

// Config that mirrors DashboardController
$windowDays = 30;
$targetCoverage = 14;
$billedStatuses = ['paid', 'credit', 'consolidated_credit', 'partial'];

$now = Carbon::now();
$warehouseId = Warehouse::where('code', 'TIENDA')->value('id');
if (! $warehouseId) {
    echo "No existe el almacén con código TIENDA.\n";
    exit(1);
}

// Velocity per variant
$velocity = DB::table('sale_items')
    ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
    ->where('sales.warehouse_id', $warehouseId)
    ->whereIn('sales.status', $billedStatuses)
    ->whereBetween('sales.created_at', [$now->copy()->subDays($windowDays), $now])
    ->selectRaw('sale_items.product_variant_id as variant_id, SUM(sale_items.quantity) as vendidas')
    ->groupBy('sale_items.product_variant_id');

$rows = DB::table('stocks')
    ->join('product_variants', 'stocks.product_variant_id', '=', 'product_variants.id')
    ->join('products', 'product_variants.product_id', '=', 'products.id')
    ->leftJoinSub($velocity, 'v', 'v.variant_id', '=', 'stocks.product_variant_id')
    ->where('stocks.warehouse_id', $warehouseId)
    ->where('products.is_raw', false)
    ->selectRaw('products.name as name, product_variants.sku as sku, stocks.quantity as quantity, products.package_size as package_size, COALESCE(v.vendidas, 0) as vendidas')
    ->get();

$items = [];
foreach ($rows as $row) {
    $daily = (float) $row->vendidas / $windowDays;
    $quantity = (int) $row->quantity;

    $reorderPoint = $daily > 0
        ? (int) max(1, ceil($daily * $targetCoverage))
        : (int) ($row->package_size ?: 0);

    $days = $daily > 0 ? (int) floor($quantity / $daily) : null;
    $needsAttention = $daily > 0
        ? $days <= $targetCoverage
        : ($reorderPoint > 0 && $quantity < $reorderPoint);

    if (! $needsAttention) {
        continue;
    }

    $pct = $reorderPoint > 0
        ? min(100, (int) round(($quantity / $reorderPoint) * 100))
        : 0;

    $status = coverageStatus($quantity, $days);

    $items[] = [
        'name' => $row->name,
        'sku' => $row->sku,
        'current' => $quantity,
        'limit' => $reorderPoint,
        'pct' => $pct,
        'days' => $days,
        'dailyVelocity' => round($daily, 2),
        'hasVelocity' => $daily > 0,
        'status' => $status,
    ];
}

usort($items, function ($a, $b) {
    if ($a['days'] === null && $b['days'] === null) {
        return $a['current'] <=> $b['current'];
    }
    if ($a['days'] === null) return 1;
    if ($b['days'] === null) return -1;
    return $a['days'] <=> $b['days'];
});

$items = array_slice($items, 0, 12);

// Print clean text report
echo "Informe de Stock - generado en: {$now->toIso8601String()}\n";
echo str_repeat('=', 72) . "\n";
if (empty($items)) {
    echo "No hay artículos que necesiten atención según la política actual.\n";
    exit(0);
}

foreach ($items as $i => $it) {
    $n = $i + 1;
    echo "{$n}. {$it['name']} (SKU: {$it['sku']})\n";
    echo "   - Stock actual: {$it['current']} unidades\n";
    echo "   - Velocidad diaria (últ. {$windowDays}d): {$it['dailyVelocity']} u/día\n";
    echo "   - Días estimados de cobertura: ";
    echo $it['days'] === null ? "sin rotación medible" : "{$it['days']} días";
    echo "\n";
    echo "   - Punto de reposición (limit): {$it['limit']} unidades\n";
    echo "   - Cobertura relativa: {$it['pct']}%\n";
    echo "   - Estado: {$it['status']}\n";
    echo str_repeat('-', 72) . "\n";
}

function coverageStatus(int $quantity, ?int $days): string
{
    if ($quantity <= 0) return 'agotado';
    if ($days !== null && $days <= 3) return 'critico';
    if ($days !== null && $days <= 7) return 'alerta';
    return 'vigilar';
}

echo "Fin del informe.\n";
