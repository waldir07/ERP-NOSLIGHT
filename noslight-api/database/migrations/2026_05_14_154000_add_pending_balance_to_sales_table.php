<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'pending_balance')) {
                // Aquí guardaremos cuánto falta pagar de este ticket específico
                $table->decimal('pending_balance', 10, 2)->default(0)->after('total_amount');
            }
        });
    }
    public function down(): void {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('pending_balance');
        });
    }
};
