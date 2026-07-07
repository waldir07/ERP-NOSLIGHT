<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credits', function (Blueprint $table) {
            // Modificamos la columna para que permita valores NULL
            $table->bigInteger('sale_id')->unsigned()->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('credits', function (Blueprint $table) {
            // En caso de revertir, regresa a su estado original (no recomendado si hay datos nuevos)
            $table->bigInteger('sale_id')->unsigned()->nullable(false)->change();
        });
    }
};
