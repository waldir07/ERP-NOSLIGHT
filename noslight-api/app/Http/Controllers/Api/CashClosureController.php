<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\CashClosure;
use App\Models\Expense;
use App\Models\SalePayment;
use Carbon\Carbon;

class CashClosureController extends Controller
{
    /**
     * Obtiene el resumen de lo que va del día para mostrar en la pantalla de cierre
     */
    public function getDailySummary(Request $request)
    {
        $todayStr = Carbon::now('America/Lima')->toDateString();
        $startOfDay = $todayStr . ' 00:00:00';
        $endOfDay = $todayStr . ' 23:59:59';

        // 1. VERIFICAR SI YA SE CERRÓ LA CAJA HOY
        $alreadyClosed = CashClosure::whereDate('created_at', $todayStr)->first();

        if ($alreadyClosed) {
            // Si ya se cerró, enviamos una bandera y los datos del cierre
            return response()->json([
                'is_closed'       => true,
                'date'            => $todayStr,
                'closure_details' => $alreadyClosed
            ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        }

        // 2. SI NO SE HA CERRADO, HACEMOS EL CÁLCULO NORMAL
        $lastClosure = CashClosure::orderBy('id', 'desc')->first();
        $openingBalance = $lastClosure ? $lastClosure->next_day_float : 0.00;



        // =================================================================
        // 🟢 CÁLCULO DE VENTAS NETO (RESTANDO VUELTOS REALES DE HOY)
        // =================================================================

        // A. Buscamos todas las ventas que se realizaron dentro del rango de hoy
        $salesTodayIds = \App\Models\Sale::whereBetween('created_at', [$startOfDay, $endOfDay])
            ->pluck('id');

        // B. Sumamos todos los vueltos reales entregados en caja el día de hoy
        $totalVueltosHoy = \App\Models\Sale::whereIn('id', $salesTodayIds)
            ->whereRaw('paid_amount > total_amount')
            ->selectRaw('SUM(paid_amount - total_amount) as total')
            ->value('total') ?: 0;

        // C. Sumamos los pagos brutos registrados en efectivo de hoy
        $rawCashSales = SalePayment::whereBetween('created_at', [$startOfDay, $endOfDay])
            ->where('payment_method', 'efectivo')
            ->sum('amount') ?? 0;

        // D. El EFECTIVO REAL NETO que se quedó físicamente en tu gaveta de dinero
        $cashSales = ($rawCashSales - $totalVueltosHoy) > 0 ? ($rawCashSales - $totalVueltosHoy) : 0;

        // E. Las ventas electrónicas se mantienen igual (Yape y Transferencias no generan vuelto)
        $yapeSales = SalePayment::whereBetween('created_at', [$startOfDay, $endOfDay])
            ->where('payment_method', 'yape')
            ->sum('amount') ?? 0;

        $transferSales = SalePayment::whereBetween('created_at', [$startOfDay, $endOfDay])
            ->where('payment_method', 'transferencia')
            ->sum('amount') ?? 0;

        // =================================================================
        // 🧾 3. AUDITORÍA EN VIVO DE ABONOS DE CRÉDITO COBRADOS HOY
        // =================================================================
        // Cargamos la relación con el modelo Customer para leer el nombre en la auditoría visual
        $creditPaymentsToday = \App\Models\CreditPayment::with('customer')
            ->whereBetween('payment_date', [$startOfDay, $endOfDay])
            ->get();

        // Calculamos los subtotales de dinero real que ingresó estrictamente de cobranzas de deuda hoy
        $cashCredits = (float) $creditPaymentsToday->where('payment_method', 'efectivo')->sum('amount');
        $yapeCredits = (float) $creditPaymentsToday->where('payment_method', 'yape')->sum('amount');
        $transferCredits = (float) $creditPaymentsToday->where('payment_method', 'transferencia')->sum('amount');

        // =================================================================
        // 💰 4. UNIFICACIÓN DE CAJA TOTAL (VENTAS + ABONOS DE CRÉDITO)
        // =================================================================
        $cashSalesTotal = $cashSales + $cashCredits;
        $yapeSalesTotal = $yapeSales + $yapeCredits;
        $transferSalesTotal = $transferSales + $transferCredits;


        // F. Gastos del día
        $cashExpenses = Expense::whereBetween('created_at', [$startOfDay, $endOfDay])
            ->where('payment_method', 'efectivo')
            ->sum('amount') ?? 0;

        // G. Caja esperada real al céntimo
        $expectedCash = ($openingBalance + $cashSalesTotal) - $cashExpenses;

        return response()->json([
            'is_closed'       => false, // <-- Bandera de que aún está abierta
            'opening_balance' => (float) $openingBalance,
            'cash_sales'      => (float) $cashSales,
            'yape_sales'      => (float) $yapeSalesTotal,
            'transfer_sales'  => (float) $transferSalesTotal,
            'cash_expenses'   => (float) $cashExpenses,
            'expected_cash'   => (float) $expectedCash,
            'date'            => $todayStr,

             // 🔥 REGISTRO DE AUDITORÍA VISUAL DESGLOSADO PARA LA TIENDA
            'credit_payments' => $creditPaymentsToday->map(function($p) {
                return [
                    'id'       => $p->id,
                    'customer' => $p->customer->name ?? 'Cliente General',
                    'amount'   => (float) $p->amount,
                    'method'   => $p->payment_method,
                    'time'     => $p->created_at ? $p->created_at->format('H:i') : '00:00'
                ];
            })



        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }

    /**
     * Guarda el cierre de caja definitivo en la base de datos
     */
    public function store(Request $request)
    {
        $request->validate([
            'opening_balance' => 'required|numeric',
            'cash_sales'      => 'required|numeric',
            'yape_sales'      => 'required|numeric',
            'transfer_sales'  => 'required|numeric',
            'cash_expenses'   => 'required|numeric',
            'expected_cash'   => 'required|numeric',
            'actual_cash'     => 'required|numeric|min:0',
            'cash_withdrawn'  => 'required|numeric|min:0',
            'observations'    => 'nullable|string|max:1000', // <-- Nueva validación
        ]);

        $todayStr = Carbon::now('America/Lima')->toDateString();

        $alreadyClosed = CashClosure::whereDate('created_at', $todayStr)->exists();

        if ($alreadyClosed) {
            return response()->json([
                'message' => 'La caja de hoy ya fue cerrada.'
            ], 422);
        }

        $discrepancy = $request->actual_cash - $request->expected_cash;

        // 🟢 NUEVA VALIDACIÓN BACKEND: Redondeamos a 2 decimales por si acaso
        if (round($discrepancy, 2) != 0 && empty($request->observations)) {
            return response()->json([
                'message' => 'Hay un descuadre en caja. Es obligatorio detallar el motivo en las observaciones.'
            ], 422);
        }

        $nextDayFloat = $request->actual_cash - $request->cash_withdrawn;

        if ($nextDayFloat < 0) {
            return response()->json([
                'message' => 'No puedes retirar más efectivo del que realmente hay en caja.'
            ], 422);
        }

        $closure = CashClosure::create([
            'user_id'         => $request->user()->id,
            'opening_balance' => $request->opening_balance,
            'cash_sales'      => $request->cash_sales,
            'yape_sales'      => $request->yape_sales,
            'transfer_sales'  => $request->transfer_sales,
            'cash_expenses'   => $request->cash_expenses,
            'expected_cash'   => $request->expected_cash,
            'actual_cash'     => $request->actual_cash,
            'discrepancy'     => $discrepancy,
            'cash_withdrawn'  => $request->cash_withdrawn,
            'next_day_float'  => $nextDayFloat,
            'observations'    => $request->observations, // <-- Guardamos en la BD
        ]);

        return response()->json([
            'message' => 'Cierre de caja guardado con éxito. ¡Buen trabajo hoy!',
            'closure' => $closure
        ], 201);
    }
}
