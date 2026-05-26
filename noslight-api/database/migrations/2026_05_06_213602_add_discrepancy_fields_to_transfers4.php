<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('transfers', function (Blueprint $table) {
            // Guardamos el motivo por el cual la tienda dice que falta mercadería
            $table->text('discrepancy_note')->nullable()->after('status');
        });

        Schema::table('transfer_items', function (Blueprint $table) {
            // Guardamos la cantidad real que entró a la tienda
            $table->integer('received_quantity')->nullable()->after('quantity');
        });
    }

    public function down()
    {
        Schema::table('transfers', function (Blueprint $table) {
            $table->dropColumn('discrepancy_note');
        });
        Schema::table('transfer_items', function (Blueprint $table) {
            $table->dropColumn('received_quantity');
        });
    }
};
