<?php

namespace App\Http\Controllers; // Cambia esto a namespace App\Http\Controllers\Api; si lo moviste a la carpeta Api

use App\Models\Setting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    // 1. Enviar todas las configuraciones a React
    public function index()
    {
        // Esto devuelve un formato perfecto: { "yape_accounts": ["Piero", "Jose"], "company_name": "Noslight" }
        $settings = Setting::pluck('value', 'key');
        return response()->json($settings);
    }
    // 2. Recibir y guardar configuraciones desde React (Actualizado para Arrays/Objetos)
    public function store(Request $request)
    {
        foreach ($request->all() as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $value]
            );
        }
        return response()->json(['message' => 'Configuración guardada correctamente']);
    }
}
