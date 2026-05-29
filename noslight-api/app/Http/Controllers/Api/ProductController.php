<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
/*   public function index(Request $request)
    {
        $query = Product::query();

        // Si el frontend envía una búsqueda, filtramos directamente en Laravel
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'LIKE', '%' . $search . '%')
                  ->orWhere('base_code', 'LIKE', '%' . $search . '%')
                  ->orWhere('brand', 'LIKE', '%' . $search . '%');
            });
        }

        // Retornamos solo los resultados que coincidan
        return response()->json($query->get());
    }*/



    /* habían errores en la inyección de cantidades
    public function index(Request $request)
    {
        $query = Product::query();

        // 1. Mantenemos tu lógica original de búsqueda intacta
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'LIKE', '%' . $search . '%')
                  ->orWhere('base_code', 'LIKE', '%' . $search . '%')
                  ->orWhere('brand', 'LIKE', '%' . $search . '%');
            });
        }

        // 2. NUEVO: Si el frontend solicita explícitamente paginación
        if ($request->boolean('paginated')) {
            // Capturamos cuántos productos por página quiere el frontend (por defecto 10)
            $perPage = $request->input('per_page', 10);
            return response()->json($query->paginate($perPage));
        }

        // 3. RETROCOMPATIBILIDAD: Si no pide paginación, devuelve el array completo de siempre
        return response()->json($query->get());
    }*/

    public function index(Request $request)
    {
        $query = Product::query();

        // 1. Lógica de búsqueda original
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'LIKE', '%' . $search . '%')
                  ->orWhere('base_code', 'LIKE', '%' . $search . '%')
                  ->orWhere('brand', 'LIKE', '%' . $search . '%');
            });
        }



        // 2. CORRECCIÓN ULTRA SEGURA: Solo si el frontend envía explícitamente '?paginated=true'
        // Usamos 'has' y validamos texto plano para evitar falsos positivos en otras vistas
        if ($request->has('paginated') && $request->input('paginated') == 'true') {
            $perPage = $request->input('per_page', 10);
            return response()->json($query->paginate($perPage));
        }

        // 3. RETROCOMPATIBILIDAD ABSOLUTA: Cualquier otra pantalla (como Auditoría) recibe el array limpio de siempre
        return response()->json($query->get());
    }


    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'          => 'required|string|max:255',
            'base_code'     => [
                'required',
                'string',
                'max:50',
                Rule::unique('products')->where(function ($query) use ($request) {
                    return $query->where('is_raw', $request->boolean('is_raw'));
                })
            ],
            'model'         => 'nullable|string|max:100',
            'brand'         => 'nullable|string|max:100',
            'package_size'  => 'required|integer|min:1',
            'is_raw'        => 'required|boolean',
            'cost_price'    => 'required|numeric|min:0',
            'supplier'      => 'nullable|string|max:255',
            'notes'         => 'nullable|string',
            'initial_stock' => 'nullable|integer|min:0',
            'raw_product_id' => 'nullable|exists:products,id',
            'amperage'       => 'nullable|string|max:50',
            'poles'          => 'nullable|string|max:50',
        ]);

        $product = Product::create($validated);
        $sku = $product->is_raw ? 'M-' . $product->base_code : $product->base_code;

        \App\Models\ProductVariant::create([
            'product_id'  => $product->id,
            'sku'         => $sku,
            'amperage'    => $product->amperage,
            'is_finished' => !$product->is_raw, // Si es raw (1), is_finished es false (0), y viceversa
        ]);

        return response()->json($product, 201);
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate([
            'name'          => 'sometimes|required|string|max:255',
            'base_code'     => [
                'sometimes',
                'string',
                'max:50',
                Rule::unique('products')
                    ->where(function ($query) use ($request, $product) {
                        // Usamos el valor que viene en el request, o el actual del producto si no se envió
                        $isRaw = $request->has('is_raw')
                            ? $request->boolean('is_raw')
                            : $product->is_raw;
                        return $query->where('is_raw', $isRaw);
                    })
                    ->ignore($product->id)
            ],
            'model'         => 'nullable|string|max:100',
            'brand'         => 'nullable|string|max:100',
            'package_size'  => 'sometimes|integer|min:1',
            'is_raw'        => 'sometimes|boolean',
            'cost_price'    => 'sometimes|numeric|min:0',
            'supplier'      => 'nullable|string|max:255',
            'notes'         => 'nullable|string',
            'is_direct_sale' => 'sometimes|boolean',
            'amperage'       => 'nullable|string|max:50',
            'poles'          => 'nullable|string|max:50',

        ]);

        $product->update([
            'name'           => $request->input('name', $product->name),
            'base_code'      => $request->input('base_code', $product->base_code),
            'model'          => $request->input('model', $product->model),
            'brand'          => $request->input('brand', $product->brand),
            'package_size'   => $request->input('package_size', $product->package_size),
            'cost_price'     => $request->input('cost_price', $product->cost_price),
            'supplier'       => $request->input('supplier', $product->supplier),

            // EXPLICACIÓN:
            // Si el campo viene en el JSON (has), usamos su valor booleano real (boolean).
            // Si no viene, dejamos lo que ya estaba.
            'is_raw'         => $request->has('is_raw') ? $request->boolean('is_raw') : $product->is_raw,
            'is_direct_sale' => $request->has('is_direct_sale') ? $request->boolean('is_direct_sale') : $product->is_direct_sale,

            'amperage'       => $request->input('amperage', $product->amperage),
            'poles'          => $request->input('poles', $product->poles),
        ]);

        $sku = $product->is_raw ? 'M-' . $product->base_code : $product->base_code;

        // updateOrCreate busca la variante de este producto. Si existe, la actualiza. Si no, la crea.
        \App\Models\ProductVariant::updateOrCreate(
            ['product_id' => $product->id],
            [
                'sku'         => $sku,
                'amperage'    => $product->amperage,
                'is_finished' => !$product->is_raw,
            ]
        );



        return response()->json($product);
    }

    public function destroy(Product $product)
    {
        $product->delete();
        return response()->json(null, 204);
    }
}
