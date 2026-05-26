<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transfer extends Model
{
    protected $fillable =
    [
        'transfer_number',
        'sender_id',
        'receiver_id',
        'destination_warehouse_id',
        'status',
        'discrepancy_note',
        'received_at', // <--- IMPORTANTE AÑADIR ESTO

    ];

    // Un envío tiene muchos productos
    public function items()
    {
        return $this->hasMany(TransferItem::class);
    }

    // Quién recibio
    public function receiver() {
    return $this->belongsTo(User::class, 'receiver_id');
}

    // Quién envió
    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

}
