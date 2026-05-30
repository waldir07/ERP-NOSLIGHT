<?php

namespace App\Imports;

use App\Models\Product;
use App\Models\ProductVariant;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Row;

class ProductsImport implements OnEachRow, WithHeadingRow
{
    /**
     * Esta función se ejecutará por cada fila que tenga tu Excel
     */
    public function onRow(Row $row)
    {
        $fila = $row->toArray();

        // Seguridad 1: Si la fila está vacía, la saltamos
        if (empty($fila['nombre']) || empty($fila['codigo_base'])) {
            return;
        }

        $isRaw = (isset($fila['es_materia_prima']) && $fila['es_materia_prima'] == 1) ? true : false;

        // --- ¡LA NUEVA BARRERA DE SEGURIDAD! ---
        // Buscamos si ya existe un producto con el mismo código y el mismo tipo (Materia prima o final)
        $productoExiste = Product::where('base_code', $fila['codigo_base'])
                                 ->where('is_raw', $isRaw)
                                 ->first();

        // Si el producto ya existe, saltamos esta fila para no duplicarlo
        if ($productoExiste) {
            return;
        }
        // ----------------------------------------

        // 1. Creamos el Producto
        $product = Product::create([
            'name'         => $fila['nombre'],
            'base_code'    => $fila['codigo_base'],
            'model'        => $fila['modelo'] ?? null,
            'brand'        => $fila['marca'] ?? null,
            'package_size' => $fila['tamano_caja'] ?? 1,
            'is_raw'       => $isRaw,
            'cost_price'   => $fila['precio_costo'] ?? 0,
            'amperage'     => $fila['amperaje'] ?? null,
            'poles'        => $fila['polos'] ?? null,
        ]);

        // 2. Asignamos el SKU
        $sku = $isRaw ? 'M-' . $product->base_code : $product->base_code;

        // 3. Creamos la Variante
        ProductVariant::create([
            'product_id'  => $product->id,
            'sku'         => $sku,
            'amperage'    => $product->amperage,
            'is_finished' => !$isRaw,
        ]);
    }
}
