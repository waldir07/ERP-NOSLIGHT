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
            $table->timestamp('waived_at')->nullable()->after('status');
            $table->foreignId('waived_by')
                ->nullable()
                ->after('waived_at')
                ->constrained('users')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::table('credits')->where('status', 'waived')->exists()) {
            throw new \RuntimeException(
                "No se puede revertir la auditoría de condonaciones: existen créditos con status='waived'."
            );
        }

        if (DB::table('credits')->whereNotNull('waived_at')->exists()) {
            throw new \RuntimeException(
                'No se puede revertir la auditoría de condonaciones: existen valores waived_at registrados.'
            );
        }

        if (DB::table('credits')->whereNotNull('waived_by')->exists()) {
            throw new \RuntimeException(
                'No se puede revertir la auditoría de condonaciones: existen valores waived_by registrados.'
            );
        }

        Schema::table('credits', function (Blueprint $table) {
            $table->dropForeign(['waived_by']);
            $table->dropColumn(['waived_at', 'waived_by']);
        });
    }
};
