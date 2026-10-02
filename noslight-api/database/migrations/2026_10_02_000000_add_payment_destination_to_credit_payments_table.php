<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credit_payments', function (Blueprint $table) {
            $table->string('payment_destination')->nullable()->after('payment_method');
        });
    }

    public function down(): void
    {
        if (DB::table('credit_payments')->whereNotNull('payment_destination')->exists()) {
            throw new \RuntimeException(
                'No se puede revertir payment_destination: existen destinos de pago registrados.'
            );
        }

        Schema::table('credit_payments', function (Blueprint $table) {
            $table->dropColumn('payment_destination');
        });
    }
};
