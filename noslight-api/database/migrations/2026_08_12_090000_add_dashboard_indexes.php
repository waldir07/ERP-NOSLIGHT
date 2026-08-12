<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Índices para el panel de gráficas de tienda. Todas sus consultas filtran por
 * (warehouse_id, status, created_at) y agrupan por hora/fecha; sin el índice
 * compuesto MySQL termina escaneando la tabla completa de ventas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->index(['warehouse_id', 'status', 'created_at'], 'sales_dashboard_idx');
        });

        Schema::table('credit_payments', function (Blueprint $table) {
            $table->index(['credit_id', 'payment_date'], 'credit_payments_liquidation_idx');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex('sales_dashboard_idx');
        });

        Schema::table('credit_payments', function (Blueprint $table) {
            $table->dropIndex('credit_payments_liquidation_idx');
        });
    }
};
