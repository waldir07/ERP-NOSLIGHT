<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => 'Interruptor Termomagnético Monofásico Base',
            'base_code' => 'ITM',
            'model' => 'IC',
            'package_size' => 120,
            'allowed_amperages' => [16, 20, 25, 32, 40, 63],
            'is_raw' => true,
            'cost_price' => 4.50,
            'supplier' => 'Proveedor China Eléctrico',
            'notes' => 'Lote importado febrero 2026',
        ];
    }
}
