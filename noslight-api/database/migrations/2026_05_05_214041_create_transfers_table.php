<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    // database/migrations/xxxx_create_transfers_table.php
    public function up()
    {
       // Schema::create('transfers', function (Blueprint $table) {
           // $table->id();
            //$table->string('transfer_number')->unique();
            //$table->foreignId('sender_id')->constrained('users'); // Willy (Warehouse)
            //$table->foreignId('receiver_id')->nullable()->constrained('users'); // Quién recibe (Store)
            //$table->enum('status', ['pending', 'completed', 'cancelled'])->default('pending');
            //$table->timestamps();
       // });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transfers');
    }
};
