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
        // AHORA MANDAMOS EL SALDO Y EL LÍMITE A LA CAJA
        $customers = Customer::orderBy('name', 'asc')
            ->get(['id', 'name', 'document_number', 'credit_balance', 'credit_limit']);
        return response()->json($customers);
    }

    // NUEVO: Crea un cliente rápido desde la caja
    public function storeQuick(Request $request)
    {
        // Validamos que por lo menos manden el nombre
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        // Creamos el cliente en la base de datos
        $customer = Customer::create([
            'name' => $request->name,
            'document_number' => $request->document_number ?? null,
            // Empieza con 0 de deuda
            'credit_balance' => 0,
        ]);

        return response()->json($customer, 201);
    }


}
