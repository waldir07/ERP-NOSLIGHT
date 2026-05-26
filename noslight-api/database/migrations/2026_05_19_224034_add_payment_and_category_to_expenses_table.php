<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('expenses', function (Blueprint $table) {
            // Agregamos las dos columnas nuevas
            $table->string('payment_method')->default('efectivo')->after('amount');
            $table->string('category')->nullable()->after('payment_method');
        });
    }

    public function down()
    {
        Schema::table('expenses', function (Blueprint $table) {
            // Por si necesitamos revertir los cambios
            $table->dropColumn(['payment_method', 'category']);
        });
    }
};