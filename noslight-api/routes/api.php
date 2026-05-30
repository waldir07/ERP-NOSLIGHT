<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductTransformationController;
use App\Http\Controllers\Api\TransformationController;
use App\Http\Controllers\Api\ImportacionController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\StockMovementController;
use App\Http\Controllers\Api\StockEntryController;
use App\Http\Controllers\Api\TransferController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\CreditController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\InventoryAdjustmentController;


/*
|--------------------------------------------------------------------------
| RUTAS PÚBLICAS
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login']);


/*
|--------------------------------------------------------------------------
| RUTAS DE ADMINISTRADOR (Gestión del Sistema)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // --- USUARIOS ---
    Route::post('/admin/create-user', [AuthController::class, 'createUser']); // Si tienes lógica específica de admin aquí
    Route::apiResource('users', UserController::class)->only(['index', 'store', 'update', 'destroy']);

    // --- PRODUCTOS ---
    Route::apiResource('products', ProductController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::get('/products/raw', [ProductController::class, 'rawIndex']);

    // --- CONFIGURACIÓN DE TRANSFORMACIONES ---
    Route::apiResource('product-transformations', ProductTransformationController::class)->only(['index', 'store', 'destroy']);
    // (Movimos /transformations/possible a la sección general porque parece ser de lectura para Warehouse)

    // --- IMPORTACIONES (Entrada principal de materia prima) ---
    Route::apiResource('importaciones', ImportacionController::class)
        ->only(['index', 'store', 'show', 'destroy'])
        ->parameters(['importaciones' => 'importacion']); // Fuerza el nombre correcto para la variable

    Route::post('/importaciones/{importacion}/gastos', [ImportacionController::class, 'agregarGastos']);
});


/*
|--------------------------------------------------------------------------
| RUTAS OPERATIVAS (Tienda, Almacén, Consultas Generales)
| Requieren estar logueado (Sanctum)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // Perfil del usuario actual
    Route::get('/user', fn(Request $request) => $request->user());

    // --- STOCK E INVENTARIO ---
    Route::get('/stocks', [StockController::class, 'index']);
    Route::post('/stock-entries', [StockEntryController::class, 'store']); // Entradas manuales
    Route::get('/stock-movements', [StockMovementController::class, 'index']); // Historial

    // ---> ¡AQUÍ ESTÁ TU RUTA DE LA TIENDA PROTEGIDA! <---
    Route::get('/store/stock', [StockController::class, 'getStoreStock']);

    // --- TRANSFORMACIONES (Operativa del Warehouse) ---
    Route::get('/transformations', [TransformationController::class, 'index']);
    Route::post('/transformations', [TransformationController::class, 'store']);
    Route::get('/transformations/possible', [ProductTransformationController::class, 'possible']);

    // --- TRANSFERENCIAS (Almacén -> Tienda) ---
    Route::get('/transfers', [TransferController::class, 'index']);
    Route::get('/transfers/{transfer}', [TransferController::class, 'show']);
    Route::post('/transfers/bulk-send', [TransferController::class, 'bulkSend']); // Crear vale de envío
    Route::post('/transfers/send-to-store', [TransferController::class, 'sendToStore']); // Envío simple (si aplica)
    Route::post('/transfers/{transfer}/receive', [TransferController::class, 'receiveTransfer']); // Tienda recibe

    // --- VENTAS ---
    Route::get('/sales', [SaleController::class, 'index']);
    Route::post('/sales', [SaleController::class, 'store']);
    Route::post('/sales', [\App\Http\Controllers\Api\SaleController::class, 'store']);

    // --- CRÉDITOS ---
    Route::get('/credits', [CreditController::class, 'index']);
    Route::post('/credits/{credit}/pay', [CreditController::class, 'pay']);
    Route::get('/credits/overdue', [CreditController::class, 'overdue']);
    // Rutas para el Cuaderno de Créditos de la Jefa
    Route::get('/credits/pending', [\App\Http\Controllers\Api\CreditController::class, 'getPending']);
    Route::post('/credits/{id}/approve', [\App\Http\Controllers\Api\CreditController::class, 'approve']);
    Route::post('/customers/pos', [\App\Http\Controllers\Api\CustomerController::class, 'storeQuick']);
    Route::get('/credits/accounts', [\App\Http\Controllers\Api\CreditController::class, 'getAccounts']);
    Route::post('/credits/customers/{id}/payments', [\App\Http\Controllers\Api\CreditController::class, 'addPayment']);
    Route::get('/credits/customers/{id}/statement', [CreditController::class, 'getCustomerStatement']);
    Route::post('/credits/approve-group', [\App\Http\Controllers\Api\CreditController::class, 'approveGroup']);

    Route::get('/customers/pos', [\App\Http\Controllers\Api\CustomerController::class, 'getPosCustomers']); // <-- Esta lee la lista
    Route::post('/customers/pos', [\App\Http\Controllers\Api\CustomerController::class, 'storeQuick']);     // <-- Esta guarda el +Nuevo

    // --- ALERTAS Y REPORTES ---
    Route::get('/alerts/low-stock-raw', [StockController::class, 'lowRawStock']);
    Route::get('/alerts/low-stock-finished', [StockController::class, 'lowFinishedStock']);
    Route::get('/reports/most-transformed', [ReportController::class, 'mostTransformed']);
    Route::get('/reports/sales-summary', [ReportController::class, 'salesSummary']);

    // --- GASTOS ---
    Route::get('/expenses', [\App\Http\Controllers\Api\ExpenseController::class, 'index']);
    Route::post('/expenses', [\App\Http\Controllers\Api\ExpenseController::class, 'store']);

    // --- CIERRE DE CAJA ---
    Route::get('/cash-closures/daily-summary', [\App\Http\Controllers\Api\CashClosureController::class, 'getDailySummary']);
    Route::post('/cash-closures', [\App\Http\Controllers\Api\CashClosureController::class, 'store']);

    Route::post('/exchanges', [\App\Http\Controllers\Api\ExchangeController::class, 'store']);

    Route::get('/admin/inventory/unified-list', [\App\Http\Controllers\Api\InventoryAdjustmentController::class, 'getAdminUnifiedStockList']);
    Route::post('/admin/inventory/inject-row', [\App\Http\Controllers\Api\InventoryAdjustmentController::class, 'injectSingleRowStock']);

    Route::get('/store-credits/{code}', [\App\Http\Controllers\Api\StoreCreditController::class, 'check']);

    //momentaneo para inyección
    Route::post('/admin/inventory/bulk-inject', [InventoryAdjustmentController::class, 'bulkAdminInject']);
});
    //inyeccion de excel

    Route::post('/products/import', [ProductController::class, 'importExcel']);
    Route::get('/products/export', [ProductController::class, 'exportExcel']);
