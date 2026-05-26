<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockEntryController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'amperage' => 'required|integer|min:1',
            'quantity' => 'required|integer|min:1',
            'cost_price' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
        ]);

        $product = Product::findOrFail($request->product_id);

        // Verificar amperaje permitido
        $allowed = $product->allowed_amperages ?? [];
        if (!in_array($request->amperage, $allowed)) {
            throw ValidationException::withMessages([
                'amperage' => 'Amperaje no permitido para este producto raw.',
            ]);
        }

        $principal = Warehouse::where('code', 'PRINCIPAL')->firstOrFail();

        return DB::transaction(function () use ($request, $product, $principal) {
            // Crear o recuperar variante raw
            $variant = ProductVariant::firstOrCreate(
                [
                    'product_id' => $product->id,
                    'amperage' => $request->amperage,
                ],
                [
                    'sku' => $product->generateRawSku($request->amperage),
                    'cost_price' => $request->cost_price ?? $product->cost_price,
                    'is_finished' => false,
                ]
            );

            // Sumar stock raw en Principal
            $stock = Stock::updateOrCreate(
                [
                    'product_variant_id' => $variant->id,
                    'warehouse_id' => $principal->id,
                ],
                [
                    'is_raw' => true,
                    'cost_price' => $request->cost_price ?? $product->cost_price,
                ]
            );

            // Incrementar quantity de forma segura
            $stock->increment('quantity', (int)$request->quantity);

            // Registrar movimiento de entrada
            StockMovement::create([
                'stock_id' => $stock->id,
                'product_variant_id' => $variant->id,  // ← ESTA LÍNEA FALTABA
                'warehouse_id' => $principal->id,
                'type' => 'entry',
                'quantity' => $request->quantity,
                'unit_cost' => $request->cost_price ?? $product->cost_price,
                'reference' => 'Importación #' . now()->format('YmdHis'),
                'user_id' => auth()->id(),
                'notes' => $request->notes ?? 'Entrada de importación - proveedor: ' . ($request->supplier ?? 'N/A'),
            ]);

            return response()->json([
                'message' => 'Entrada de importación registrada exitosamente',
                'entry' => [
                    'variant' => $variant,
                    'quantity_added' => $request->quantity,
                    'stock_raw_new' => $stock->fresh()->quantity,
                ],
            ], 201);
        });
    }
}
