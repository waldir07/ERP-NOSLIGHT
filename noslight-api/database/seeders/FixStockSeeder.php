<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class FixStockSeeder extends Seeder
{
    public function run()
    {
        // 1. Aseguramos que exista un almacén
        $wh = DB::table('warehouses')->first();
        if (!$wh) {
            DB::table('warehouses')->insert(['name' => 'Principal', 'code' => 'PRINCIPAL']);
            $wh = DB::table('warehouses')->first();
        }

        // 2. Buscamos tu producto RAW
        $prod = DB::table('products')->where('is_raw', 1)->first();

        if ($prod) {
            // 3. Aseguramos que tenga su variante
            $var = DB::table('product_variants')->where('product_id', $prod->id)->first();
            if (!$var) {
                $varId = DB::table('product_variants')->insertGetId([
                    'product_id' => $prod->id,
                    'sku' => 'M-' . $prod->base_code,
                    'amperage' => 60,
                    'is_finished' => 0,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
                $var = DB::table('product_variants')->where('id', $varId)->first();
            }

            // 4. Inyectamos el stock a la fuerza
            DB::table('stocks')->insert([
                'warehouse_id' => $wh->id,
                'product_variant_id' => $var->id,
                'quantity' => 1000,
                'is_raw' => 1,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            $this->command->info('✅ ¡ÉXITO! 1000 unidades inyectadas correctamente.');
        } else {
            $this->command->error('❌ ERROR: No tienes ningún producto RAW creado en el catálogo.');
        }
    }
}
