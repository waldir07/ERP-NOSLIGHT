<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'is_active')) {
                // Por defecto, todos los clientes nacen "Activos" (true)
                $table->boolean('is_active')->default(true)->after('credit_balance');
            }
        });
    }

    public function down()
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
