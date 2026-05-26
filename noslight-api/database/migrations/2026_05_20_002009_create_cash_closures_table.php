<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('cash_closures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained(); // Quién cerró la caja
            
            // Los cálculos del día
            $table->decimal('opening_balance', 10, 2)->default(0); // Sencillo con el que empezó el día
            $table->decimal('cash_sales', 10, 2)->default(0);      // Total ventas efectivo
            $table->decimal('yape_sales', 10, 2)->default(0);      // Total ventas Yape/Transferencia
            $table->decimal('cash_expenses', 10, 2)->default(0);   // Total gastos efectivo
            
            // El Cuadre
            $table->decimal('expected_cash', 10, 2)->default(0);   // Lo que el sistema calculó que debe haber
            $table->decimal('actual_cash', 10, 2)->default(0);     // Lo que tú contaste físicamente
            $table->decimal('discrepancy', 10, 2)->default(0);     // Si sobró (+) o faltó (-) plata
            
            // El Retiro que mencionaste
            $table->decimal('cash_withdrawn', 10, 2)->default(0);  // Lo que te llevas
            $table->decimal('next_day_float', 10, 2)->default(0);  // Lo que dejas para mañana
            
            $table->timestamps(); // Cuándo se hizo el cierre
        });
    }

    public function down()
    {
        Schema::dropIfExists('cash_closures');
    }
};