<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('inventory_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('user_id')->constrained(); // Quién lo hizo
            $table->foreignId('warehouse_id')->constrained(); // Dónde (Almacén o Tienda)
            $table->integer('quantity'); // Positivo para suma, Negativo para resta (Merma)
            $table->string('reason'); // MALOGRADO, ERROR_CONTEO, etc.
            $table->text('notes')->nullable();
            $table->timestamps();
            // database/migrations/xxxx_create_inventory_adjustments_table.php
            $table->enum('status', ['PENDIENTE', 'APROBADO', 'RECHAZADO'])->default('PENDIENTE');
            $table->foreignId('approved_by')->nullable()->constrained('users'); // Quién lo autorizó
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_adjustments');
    }
};
