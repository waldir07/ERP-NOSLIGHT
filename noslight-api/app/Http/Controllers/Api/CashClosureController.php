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
            return response()->json([
                'is_closed' => true,
                'date' => $todayStr,
                'closure_details' => $alreadyClosed
            ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        }

        // 2. OBTENER EQUILIBRIO INICIAL
        $lastClosure = CashClosure::orderBy('id', 'desc')->first();
        $openingBalance = $lastClosure ? $lastClosure->next_day_float : 0.00;

        // 🟢 CÁLCULO DE VUELTOS DE HOY
        $salesTodayIds = \App\Models\Sale::whereBetween('created_at', [$startOfDay, $endOfDay])->pluck('id');
        $totalVueltosHoy = \App\Models\Sale::whereIn('id', $salesTodayIds)
            ->whereRaw('paid_amount > total_amount')
            ->selectRaw('SUM(paid_amount - total_amount) as total')
            ->value('total') ?: 0;

        // 🟢 VENTAS PURAS EN EFECTIVO: Filtramos de forma estricta para excluir cualquier rastro de cobranzas
        $rawCashSales = SalePayment::whereBetween('created_at', [$startOfDay, $endOfDay])
            ->where('payment_method', 'efectivo')
            ->where(function ($query) {
                // Si tiene un destino explícito, aseguramos que NO sea de cobranzas ni de lotes
                $query->where('payment_destination', 'not like', '%COBRANZA%')
                    ->where('payment_destination', 'not like', '%LOTE%')
                    ->where('payment_destination', 'not like', '%ABONO%');
            })
            ->sum('amount') ?? 0;

        $cashSales = ($rawCashSales - $totalVueltosHoy) > 0 ? ($rawCashSales - $totalVueltosHoy) : 0;

        // 🟢 VENTAS DIGITALES PURAS (EXCLUYENDO TODAS LAS COBRANZAS)
        $yapeSales = SalePayment::whereBetween('created_at', [$startOfDay, $endOfDay])
            ->where('payment_method', 'yape')
            ->where('payment_destination', 'not like', 'COBRANZA CRÉDITO%')
            ->sum('amount') ?? 0;

        $transferSales = SalePayment::whereBetween('created_at', [$startOfDay, $endOfDay])
            ->where('payment_method', 'transferencia')
            ->where('payment_destination', 'not like', 'COBRANZA CRÉDITO%')
            ->sum('amount') ?? 0;

        // 🟢 COBRANZAS DE CRÉDITO DEL DÍA (BÚSQUEDA EXACTA POR FECHA PURA)
        $creditPaymentsToday = \App\Models\CreditPayment::where('payment_date', $todayStr)->get();

        $cashCredits = (float) $creditPaymentsToday->where('payment_method', 'efectivo')->sum('amount');
        $yapeCredits = (float) $creditPaymentsToday->where('payment_method', 'yape')->sum('amount');
        $transferCredits = (float) $creditPaymentsToday->where('payment_method', 'transferencia')->sum('amount');

        // 🟢 GASTOS EN EFECTIVO
        $cashExpenses = Expense::whereBetween('created_at', [$startOfDay, $endOfDay])
            ->where('payment_method', 'efectivo')
            ->sum('amount') ?? 0;

        // 💰 CAJA ESPERADA TOTAL EN EFECTIVO (FONDO + VENTAS EFECTIVO + ABONOS EFECTIVO - GASTOS)
        $expectedCash = ($openingBalance + $cashSales + $cashCredits) - $cashExpenses;

        return response()->json([
            'is_closed' => false,
            'opening_balance' => (float) $openingBalance,
            'cash_sales' => (float) $cashSales,
            'yape_sales' => (float) $yapeSales, // 🔥 Devuelve venta pura sin inflar
            'transfer_sales' => (float) $transferSales, // 🔥 Devuelve venta pura sin inflar
            'cash_credits' => (float) $cashCredits, // 🆕 Mandamos los abonos para el Frontend
            'yape_credits' => (float) $yapeCredits, // 🆕 Mandamos los abonos para el Frontend
            'transfer_credits' => (float) $transferCredits, // 🆕 Mandamos los abonos para el Frontend
            'cash_expenses' => (float) $cashExpenses,
            'expected_cash' => (float) $expectedCash,
            'date' => $todayStr,
            'credit_payments' => $creditPaymentsToday->map(function ($p) {
                return [
                    'id' => $p->id,
                    'customer' => $p->customer->name ?? 'Cliente General',
                    'amount' => (float) $p->amount,
                    'method' => $p->payment_method,
                    'time' => $p->created_at ? $p->created_at->format('H:i') : '00:00'
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
