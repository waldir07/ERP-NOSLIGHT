<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('importacion_gastos', function (Blueprint $table) {
            $table->id();

            $table->foreignId('importacion_id')->constrained('importaciones')->onDelete('cascade');

            $table->string('descripcion');
            $table->decimal('monto', 12, 2);
            $table->enum('moneda', ['USD', 'PEN'])->default('USD');
            $table->decimal('monto_convertido', 12, 2);   // Monto en soles según valor_dolar

            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('importacion_gastos');
    }
};
