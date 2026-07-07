<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('credits', function (Blueprint $table) {
            // 1. Eliminamos la llave foránea antigua que apuntaba a la tabla 'clients'
            $table->dropForeign('credits_client_id_foreign');
        });

        Schema::table('credits', function (Blueprint $table) {
            // 2. Renombramos la columna para que ahora sea técnicamente 'customer_id'
            $table->renameColumn('client_id', 'customer_id');
        });

        Schema::table('credits', function (Blueprint $table) {
            // 3. Creamos el nuevo candado formal apuntando a tu tabla de administración real ('customers')
            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('credits', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->renameColumn('customer_id', 'client_id');
            $table->foreign('client_id')->references('id')->on('clients')->onDelete('restrict');
        });
    }
};
