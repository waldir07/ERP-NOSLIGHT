<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('cash_closures', function (Blueprint $table) {
            // Creamos la columna 'observations' de tipo texto largo y permitimos que sea vacía (nullable)
            // Se posicionará justo después de 'next_day_float'
            $table->text('observations')
                ->nullable()
                ->after('next_day_float');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cash_closures', function (Blueprint $table) {
            // Si alguna vez necesitas revertir este cambio, esta línea borrará la columna
            $table->dropColumn('observations');
        });
    }
};