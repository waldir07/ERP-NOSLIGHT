<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Imports\ProductsImport;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\ProductsExport;

class ProductController extends Controller
{


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

    // Asegúrate de tener estas dos líneas en la parte superior del archivo (con los demás 'use'):
    // use App\Imports\ProductsImport;
    // use Maatwebsite\Excel\Facades\Excel;


    public function exportExcel()
    {
        // Esto genera el archivo y fuerza la descarga con el nombre 'productos_actuales.xlsx'
        return Excel::download(new ProductsExport, 'productos_actuales.xlsx');
    }

    public function importExcel(\Illuminate\Http\Request $request)
    {
        // 1. Validamos que obligatoriamente envíen un archivo Excel o CSV
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv|max:10240', // Máximo 10MB
        ]);

        try {
            // 2. Le pasamos el archivo a nuestro motor
            Excel::import(new ProductsImport, $request->file('file'));

            // 3. Respondemos que todo salió bien
            return response()->json([
                'message' => 'Productos importados correctamente'
            ], 200);

        } catch (\Exception $e) {
            // Si algo falla, atrapamos el error para no crashear la página
            return response()->json([
                'message' => 'Error al importar: ' . $e->getMessage()
            ], 500);
        }
    }
}
