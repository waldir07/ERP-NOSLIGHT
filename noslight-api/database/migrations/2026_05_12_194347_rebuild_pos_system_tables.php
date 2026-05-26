<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Desactivamos temporalmente las llaves foráneas para poder borrar la tabla vieja sin errores
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('sales');
        Schema::enableForeignKeyConstraints();

        // 1. CLIENTES Y SUS DEUDAS
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('document_number')->nullable(); // DNI opcional
            $table->string('phone')->nullable();
            $table->decimal('credit_balance', 10, 2)->default(0); // Cuánto te debe en total
            $table->text('notes')->nullable();
            $table->timestamps(); // Guarda fecha y hora exacta de creación
        });

        // 2. TURNOS Y CIERRES DE CAJA
        Schema::create('cash_registers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_id')->constrained(); // En qué tienda es la caja
            $table->foreignId('user_id')->constrained(); // Quién es el cajero
            $table->decimal('opening_balance', 10, 2)->default(0); // Sencillo inicial
            $table->decimal('closing_balance', 10, 2)->nullable(); // Cuánto declara al cerrar
            $table->timestamp('opened_at')->useCurrent();
            $table->timestamp('closed_at')->nullable();
            $table->string('status')->default('open'); // open, closed
            $table->text('notes')->nullable(); // "Faltó 10 soles", etc.
            $table->timestamps();
        });

        // 3. LA VENTA (EL TICKET)
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('receipt_number')->unique(); // Ej: T-000001
            $table->foreignId('warehouse_id')->constrained(); // De qué tienda salió
            $table->foreignId('user_id')->constrained(); // Quién lo vendió
            $table->foreignId('customer_id')->nullable()->constrained(); // Null = Público General
            $table->foreignId('cash_register_id')->nullable()->constrained(); // A qué turno de caja pertenece
            $table->decimal('total_amount', 10, 2); // Total de la venta
            $table->decimal('paid_amount', 10, 2)->default(0); // Cuánto pagó realmente hoy
            $table->string('status')->default('paid'); // paid, partial, credit
            $table->text('notes')->nullable();
            $table->timestamps(); // Guarda fecha y hora exacta de la venta
        });

        // 4. EL CARRITO DE COMPRAS (Múltiples productos)
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained('product_variants');
            $table->integer('quantity');
            $table->decimal('unit_price', 10, 2); // Precio al que se le vendió finalmente
            $table->decimal('subtotal', 10, 2);
            $table->timestamps();
        });

        // 5. HISTORIAL DE PAGOS (Efectivo, Yape, Transferencias)
        Schema::create('sale_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained(); // Quién recibió el pago
            $table->foreignId('cash_register_id')->nullable()->constrained(); // A qué caja entra (si es efectivo)
            $table->decimal('amount', 10, 2);
            $table->string('payment_method'); // cash, yape, plin, transfer
            $table->string('payment_destination')->nullable(); // Ej: "Yape María", "BCP Empresa"
            $table->string('reference_number')->nullable(); // Nro de operación opcional
            $table->timestamps(); // Fecha y hora exacta del pago
        });
    }

    public function down()
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('sale_payments');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('cash_registers');
        Schema::dropIfExists('customers');
        Schema::enableForeignKeyConstraints();
    }
};
