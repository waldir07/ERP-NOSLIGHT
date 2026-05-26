<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('transfers', function (Blueprint $table) {
            $table->unsignedBigInteger('destination_warehouse_id')->nullable()->after('sender_id');

            // Opcional: Si tienes una tabla warehouses, añade la clave foránea
            // $table->foreign('destination_warehouse_id')->references('id')->on('warehouses');
        });
    }

    public function down()
    {
        Schema::table('transfers', function (Blueprint $table) {
            $table->dropColumn('destination_warehouse_id');
        });
    }
};
