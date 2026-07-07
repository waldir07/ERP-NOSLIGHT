<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('credit_payment_sales', function (Blueprint $table) {
            $table->id();
            // 🟢 Candados numéricos puros de llaves foráneas:
            $table->foreignId('credit_payment_id')->constrained('credit_payments')->onDelete('cascade');
            $table->foreignId('sale_id')->constrained('sales')->onDelete('cascade');
            // 🟢 Registra los centavos exactos que este vale absorbió de ese abono
            $table->decimal('amount_applied', 10, 2);
            $table->timestamps();
        });
    }


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('credit_payment_sales');
    }
};
