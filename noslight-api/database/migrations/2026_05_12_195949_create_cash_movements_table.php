<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up() {
        Schema::create('cash_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_register_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained(); // Quién sacó la plata
            $table->string('type'); // 'expense' (gasto), 'withdrawal' (retiro), 'addition' (ingreso)
            $table->decimal('amount', 10, 2);
            $table->string('description'); // Ej: "Compra de cinta embalaje", "Retiro del jefe"
            $table->timestamps();
        });
    }
    public function down() {
        Schema::dropIfExists('cash_movements');
    }
};
