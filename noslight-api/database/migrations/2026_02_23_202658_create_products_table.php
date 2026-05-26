<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');                     // Ej: "Interruptor Termomagnético Monofásico Base"
            $table->string('base_code');                // Ej: "ITM" (Interruptor Termomagnético)
            $table->string('model');                    // Ej: "IC" (curva C, por ejemplo)
            $table->integer('package_size')->nullable(); // Cantidad por cajón (puede variar)
            $table->json('allowed_amperages')->nullable(); // [16, 25, 32, 40, 63] como array JSON
            $table->boolean('is_raw')->default(true);   // Siempre true para estos
            $table->decimal('cost_price', 10, 2)->nullable(); // Precio de costo importado
            $table->string('supplier')->nullable();     // Ej: "Proveedor China XYZ"
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
