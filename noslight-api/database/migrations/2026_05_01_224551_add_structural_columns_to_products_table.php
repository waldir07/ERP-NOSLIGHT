<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('products', function (Blueprint $table) {
            // 1. Enlace a la Materia Prima (Trazabilidad)
            $table->unsignedBigInteger('raw_product_id')->nullable()->after('id')->comment('Si es terminado, indica de qué RAW proviene');
            $table->foreign('raw_product_id')->references('id')->on('products')->onDelete('set null');

            // 2. Datos analíticos para reportes súper rápidos
            $table->integer('amperage')->nullable()->after('is_raw')->comment('Ej: 10, 20, 60');
            $table->integer('poles')->nullable()->after('amperage')->comment('1=Mono, 2=Bi, 3=Tri');
        });
    }

    public function down()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['raw_product_id']);
            $table->dropColumn(['raw_product_id', 'amperage', 'poles']);
        });
    }
};
