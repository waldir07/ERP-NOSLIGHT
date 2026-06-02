<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    // Solo trae el ID y el nombre para no hacer pesada la consulta
    public function getPosCustomers()
    {
        // SOLO TRAE A LOS CLIENTES ACTIVOS (is_active = true)
        $customers = Customer::where('is_active', true)
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'document_number', 'credit_balance', 'credit_limit', 'has_credit']);
        return response()->json($customers);
    }



    public function index()
    {
        return response()->json(Customer::orderBy('name', 'asc')->get());
    }

    // 2. Crear un cliente nuevo (Solo desde el Admin)
    public function store(Request $request)
    {
        // Validamos que por lo menos manden el nombre
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        // Creamos el cliente con todos los datos que mande React
        $customer = Customer::create($request->all());

        return response()->json($customer, 201);
    }

    // 3. Editar un cliente y sus límites de crédito (Solo desde el Admin)
    public function update(Request $request, $id)
    {
        $customer = Customer::findOrFail($id);

        // Actualizamos los datos
        $customer->update($request->all());

        return response()->json($customer);
    }

    // Activar / Desactivar un cliente
    public function toggleStatus($id)
    {
        $customer = Customer::findOrFail($id);

        // Si lo vamos a desactivar, verificamos que no deba plata
        if ($customer->is_active && $customer->credit_balance > 0) {
            return response()->json([
                'error' => 'No puedes desactivar a un cliente que aún te debe S/ ' . $customer->credit_balance
            ], 422);
        }

        // Invertimos su estado (Si era true pasa a false, y viceversa)
        $customer->is_active = !$customer->is_active;
        $customer->save();

        return response()->json(['message' => 'Estado actualizado', 'is_active' => $customer->is_active]);
    }
}
