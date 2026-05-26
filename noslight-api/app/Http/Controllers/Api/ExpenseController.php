<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Expense;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $startDate = $request->get('start_date');
        $endDate   = $request->get('end_date');
        $search    = $request->get('search');

        $query = Expense::with('user');

        // Lógica de fechas corregida para buscar desde las 00:00:00 hasta las 23:59:59
        if ($startDate && $endDate) {
            $query->whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
        } elseif ($startDate) {
            $query->where('created_at', '>=', $startDate . ' 00:00:00');
        } elseif ($endDate) {
            $query->where('created_at', '<=', $endDate . ' 23:59:59');
        }

        if ($search) {
            $query->where(function($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%");
            });
        }

        $expenses = $query->orderBy('created_at', 'desc')->get();

        $totalEfectivo = $expenses->where('payment_method', 'efectivo')->sum('amount');
        $totalGeneral = $expenses->sum('amount');

        return response()->json([
            'expenses'       => $expenses,
            'total_efectivo' => (float) $totalEfectivo,
            'total_general'  => (float) $totalGeneral,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'description'    => 'required|string|max:500',
            'amount'         => 'required|numeric|min:0.01',
            'payment_method' => 'required|string',
            'category'       => 'nullable|string'
        ]);

        $expense = Expense::create([
            'user_id'        => $request->user()->id,
            'description'    => $request->description,
            'amount'         => $request->amount,
            'payment_method' => $request->payment_method,
            'category'       => $request->category ?? 'General',
            'expense_date'   => now()->toDateString(),
        ]);

        return response()->json([
            'message' => 'Gasto registrado correctamente',
            'expense' => $expense
        ], 201);
    }
}