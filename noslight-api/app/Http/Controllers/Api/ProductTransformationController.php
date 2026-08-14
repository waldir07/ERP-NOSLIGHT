<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductTransformation;
use App\Models\Product;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductTransformationController extends Controller
{
    /**
     * Listar todas las transformaciones configuradas (para Admin)
     */
    public function index()
    {
        $transformations = ProductTransformation::with([
            'rawProduct:id,name,base_code,is_raw',
            'finishedProduct:id,name,base_code,is_raw'
        ])
        ->orderBy('raw_product_id')
        ->orderBy('raw_amperage')
        ->get();

        return response()->json($transformations);
    }

    /**
     * Guardar una nueva transformación (Admin)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'raw_product_id'     => 'required|exists:products,id',
            'raw_amperage'       => 'required|integer|min:1',
            'finished_product_id'=> 'required|exists:products,id',
            'finished_amperage'  => 'required|integer|min:1',
            'conversion_rate'    => 'required|numeric|min:0.1|max:10',
            'extra_cost'         => 'nullable|numeric|min:0',
            'notes'              => 'nullable|string|max:500',
        ]);

        // Validación de negocio: Raw debe ser realmente raw
        $rawProduct = Product::findOrFail($validated['raw_product_id']);
        if (!$rawProduct->is_raw) {
            return response()->json(['message' => 'El producto seleccionado no es Raw'], 422);
        }

        // Evitar duplicados: existe una restricción UNIQUE en la BD sobre
        // (raw_product_id, raw_amperage, finished_product_id, finished_amperage).
        $exists = ProductTransformation::where('raw_product_id', $validated['raw_product_id'])
            ->where('raw_amperage', $validated['raw_amperage'])
            ->where('finished_product_id', $validated['finished_product_id'])
            ->where('finished_amperage', $validated['finished_amperage'])
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Producto repetido: ya existe esa transformación. Elige otro producto o ajusta amperaje.'
            ], 422);
        }

        try {
            $transformation = ProductTransformation::create($validated);
        } catch (QueryException $ex) {
            // En caso de carrera u otra violación de integridad, devolver mensaje amigable
            return response()->json([
                'message' => 'No se pudo crear la transformación (posible duplicado). Intenta con otro producto.'
            ], 422);
        }

        return response()->json([
            'message' => 'Transformación configurada correctamente',
            'transformation' => $transformation->load(['rawProduct', 'finishedProduct'])
        ], 201);
    }

    /**
     * Eliminar una transformación (Admin)
     */
    public function destroy(ProductTransformation $productTransformation)
    {
        $productTransformation->delete();

        return response()->json([
            'message' => 'Transformación eliminada correctamente'
        ]);
    }

    /**
     * Obtener posibles transformaciones para un Raw específico (usado por Warehouse)
     */
    public function possible(Request $request)
    {
        $request->validate([
            'raw_product_id' => 'required|exists:products,id',
            'raw_amperage'   => 'required|integer|min:1',
        ]);

        $transformations = ProductTransformation::where('raw_product_id', $request->raw_product_id)
            ->where('raw_amperage', $request->raw_amperage)
            ->with('finishedProduct:id,name,base_code,model,package_size,cost_price')
            ->get();

        return response()->json([
            'raw_product_id' => $request->raw_product_id,
            'raw_amperage'   => $request->raw_amperage,
            'possible_finished' => $transformations->map(function ($t) {
                return [
                    'id'                => $t->id,
                    'finished_product_id' => $t->finished_product_id,
                    'finished_product_name' => $t->finishedProduct->name,
                    'finished_amperage' => $t->finished_amperage,
                    'conversion_rate'   => (float) $t->conversion_rate,
                    'extra_cost'        => (float) $t->extra_cost,
                    'notes'             => $t->notes,
                ];
            }),
        ]);
    }
}
