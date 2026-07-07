<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('credit_sales', function (Blueprint $table) {
            $table->id();
            // Vincula al lote único de cobro
            $table->foreignId('credit_id')->constrained('credits')->onDelete('cascade');
            // Vincula al vale de origen
            $table->foreignId('sale_id')->constrained('sales')->onDelete('cascade');
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('credit_sales');
    }
};
