<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credits', function (Blueprint $table) {
            $table->enum('status', ['pending', 'partial', 'paid', 'overdue', 'waived'])->change();
        });
    }

    public function down(): void
    {
        if (DB::table('credits')->where('status', 'waived')->exists()) {
            throw new \RuntimeException(
                "No se puede revertir el estado waived: existen créditos con status='waived'. Resuélvelos antes del rollback."
            );
        }

        Schema::table('credits', function (Blueprint $table) {
            $table->enum('status', ['pending', 'partial', 'paid', 'overdue'])->change();
        });
    }
};
