<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            // Agregamos las columnas solo si no existen para evitar errores
            if (!Schema::hasColumn('credit_payments', 'customer_id')) {
                $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            }
            if (!Schema::hasColumn('credit_payments', 'user_id')) {
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('credit_payments', 'amount')) {
                $table->decimal('amount', 10, 2)->default(0);
            }
            if (!Schema::hasColumn('credit_payments', 'payment_method')) {
                $table->string('payment_method')->default('efectivo');
            }
        });
    }

    public function down(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->dropColumn(['customer_id', 'user_id', 'amount', 'payment_method']);
        });
    }
};
