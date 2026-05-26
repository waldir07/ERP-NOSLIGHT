<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('importaciones', function (Blueprint $table) {
            $table->id();

            $table->string('invoice_code')->unique();
            $table->string('bl_awb')->nullable();

            $table->date('fecha_aviso')->nullable();
            $table->date('fecha_llegada_almacen');

            // Temporal: sin foreign key hasta que existan las tablas
            $table->unsignedBigInteger('proveedor_id')->nullable();
            $table->unsignedBigInteger('empresa_importadora_id')->nullable();

            $table->decimal('valor_dolar', 10, 4);
            $table->decimal('fob_total', 15, 2);
            $table->decimal('gastos_total', 15, 2)->default(0);
            $table->decimal('factor', 10, 4)->default(1);

            $table->enum('estado', ['borrador', 'completada', 'cancelada'])->default('borrador');

            $table->text('notes')->nullable();
            $table->foreignId('user_id')->constrained('users');

            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('importaciones');
    }
};
