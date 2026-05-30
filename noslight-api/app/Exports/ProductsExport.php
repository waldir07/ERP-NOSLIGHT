<?php

namespace App\Exports;

use App\Models\Product;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ProductsExport implements FromCollection, WithHeadings, WithMapping
{
    // 1. Traemos todos los productos de la base de datos
    public function collection()
    {
        return Product::all();
    }

    // 2. Definimos los títulos exactos que necesita tu importador
    public function headings(): array
    {
        return [
            'nombre', 'marca', 'codigo_base', 'modelo', 'polos',
            'amperaje', 'es_materia_prima', 'tamano_caja', 'precio_costo'
        ];
    }

    // 3. Mapeamos los datos de la base de datos a las columnas del Excel
    public function map($product): array
    {
        return [
            $product->name,
            $product->brand,
            $product->base_code,
            $product->model,
            $product->poles,
            $product->amperage,
            $product->is_raw ? 1 : 0, // Convertimos el true/false a 1/0
            $product->package_size,
            $product->cost_price,
        ];
    }
}
