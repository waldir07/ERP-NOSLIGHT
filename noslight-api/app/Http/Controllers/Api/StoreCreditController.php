<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\StoreCredit;

class StoreCreditController extends Controller
{
    public function check($code)
    {
        $vale = StoreCredit::where('code', strtoupper($code))->where('status', 'active')->first();
        if (!$vale || $vale->amount <= 0) {
            return response()->json(['message' => 'Vale inválido.'], 404);
        }
        return response()->json($vale);
    }
}