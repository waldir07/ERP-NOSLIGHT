<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_id')->constrained('stocks')->onDelete('cascade');
            $table->foreignId('product_variant_id')->constrained('product_variants')->onDelete('cascade');
            $table->foreignId('warehouse_id')->constrained('warehouses')->onDelete('cascade');
            $table->enum('type', ['entry', 'exit', 'transformation', 'transfer']); // tipo de movimiento
            $table->unsignedInteger('quantity'); // cantidad que se movió (positivo)
            $table->decimal('unit_cost', 10, 2)->nullable(); // costo unitario en ese momento (para entry/transformation)
            $table->text('reference')->nullable(); // ej: "Venta #123", "Transformación #45", "Importación China"
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
