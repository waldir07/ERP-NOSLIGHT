<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('store_credits', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // Ej: VALE-A8F2
            $table->foreignId('customer_id')->nullable()->constrained(); // Null si es público general
            $table->foreignId('sale_id')->constrained(); // De qué venta se originó
            $table->decimal('amount', 10, 2);
            $table->string('status')->default('active'); // active, used, expired
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('store_credits');
    }
};