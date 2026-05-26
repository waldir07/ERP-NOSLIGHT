<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('importacion_detalles', function (Blueprint $table) {
            $table->id();

            $table->foreignId('importacion_id')->constrained('importaciones')->onDelete('cascade');
            $table->foreignId('product_id')->constrained('products')->onDelete('restrict');

            $table->decimal('precio_unitario_proveedor', 12, 4);   // Precio real pagado al proveedor
            $table->integer('cantidad');
            $table->decimal('costo_declarado', 12, 2)->nullable(); // Para referencia SUNAT

            $table->decimal('fob_real', 12, 2);                    // Calculado: precio_unitario * cantidad
            $table->decimal('costo_landed_unitario', 12, 4);       // Costo final puesto en Perú

            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('importacion_detalles');
    }
};
