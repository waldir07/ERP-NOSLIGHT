<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('credit_payments', function (Blueprint $table) {
            // 1. Hacemos que el ID del vale ya no sea obligatorio
            $table->unsignedBigInteger('credit_id')->nullable()->change();

            // 2. Por si acaso, nos aseguramos de que existan las columnas del nuevo modelo
            if (!Schema::hasColumn('credit_payments', 'customer_id')) {
                $table->unsignedBigInteger('customer_id')->nullable()->after('id');
            }
            if (!Schema::hasColumn('credit_payments', 'user_id')) {
                $table->unsignedBigInteger('user_id')->nullable()->after('customer_id');
            }
        });
    }

    public function down(): void {
        // No necesitamos revertir nada crítico aquí
    }
};
