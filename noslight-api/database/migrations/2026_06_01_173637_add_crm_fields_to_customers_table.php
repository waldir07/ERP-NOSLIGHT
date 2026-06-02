<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('customers', function (Blueprint $table) {
            // Datos de contacto y facturación
            if (!Schema::hasColumn('customers', 'document_type')) {
                $table->string('document_type', 20)->nullable()->after('name'); // Ej: DNI o RUC
            }
            if (!Schema::hasColumn('customers', 'document_number')) {
                $table->string('document_number', 20)->nullable()->after('document_type');
            }
            if (!Schema::hasColumn('customers', 'phone')) {
                $table->string('phone', 20)->nullable()->after('document_number');
            }
            if (!Schema::hasColumn('customers', 'address')) {
                $table->string('address')->nullable()->after('phone');
            }

            // Datos vitales para tu jefa (El switch y los límites)
            if (!Schema::hasColumn('customers', 'has_credit')) {
                $table->boolean('has_credit')->default(false)->after('address'); // Por defecto NO tienen crédito
            }
            if (!Schema::hasColumn('customers', 'credit_limit')) {
                $table->decimal('credit_limit', 10, 2)->default(0)->after('has_credit'); // Tope máximo de deuda
            }
            if (!Schema::hasColumn('customers', 'credit_balance')) {
                $table->decimal('credit_balance', 10, 2)->default(0)->after('credit_limit'); // Cuánto debe actualmente
            }
        });
    }

    public function down()
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn([
                'document_type',
                'document_number',
                'phone',
                'address',
                'has_credit',
                'credit_limit',
                'credit_balance'
            ]);
        });
    }
};
