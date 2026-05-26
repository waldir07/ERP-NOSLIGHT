<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('product_transformations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('raw_product_id')
                  ->constrained('products')
                  ->onDelete('cascade');

            $table->unsignedInteger('raw_amperage');

            $table->foreignId('finished_product_id')
                  ->constrained('products')
                  ->onDelete('cascade');

            $table->unsignedInteger('finished_amperage');

            $table->decimal('conversion_rate', 8, 2)->default(1.00);
            $table->decimal('extra_cost', 8, 2)->default(0.00);

            $table->text('notes')->nullable();

            $table->timestamps();

            // Índice único con nombre corto (importante)
            $table->unique(
                ['raw_product_id', 'raw_amperage', 'finished_product_id', 'finished_amperage'],
                'pt_raw_finished_unique'   // ← Nombre corto (menos de 64 caracteres)
            );
        });
    }

    public function down()
    {
        Schema::dropIfExists('product_transformations');
    }
};
