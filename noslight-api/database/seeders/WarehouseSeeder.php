<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class WarehouseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        \App\Models\Warehouse::create(['name' => 'Almacén Principal', 'code' => 'PRINCIPAL']);
        \App\Models\Warehouse::create(['name' => 'Almacén Tienda', 'code' => 'TIENDA']);
    }
}
