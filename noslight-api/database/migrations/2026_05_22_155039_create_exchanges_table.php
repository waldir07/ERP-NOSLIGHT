<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('exchanges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained(); // A qué venta pertenece el cambio
            $table->foreignId('user_id')->constrained(); // Qué cajero hizo el cambio
            $table->string('type'); // 'same_price', 'customer_paid_more', 'store_credit_issued'
            $table->decimal('amount_difference', 10, 2)->default(0); 
            $table->text('observations')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('exchanges');
    }
};