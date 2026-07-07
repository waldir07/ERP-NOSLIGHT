<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Credit extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id', 'customer_id', 'total_amount', 'paid_amount',
        'remaining_amount', 'due_date', 'status', 'notes'
    ];

    protected $casts = [
        'due_date' => 'date',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function payments()
    {
        return $this->hasMany(CreditPayment::class);
    }

    // Método helper para actualizar estado
    public function updateStatus()
    {
        if ($this->remaining_amount <= 0) {
            $this->status = 'paid';
        } elseif ($this->due_date->isPast() && $this->remaining_amount > 0) {
            $this->status = 'overdue';
        } elseif ($this->paid_amount > 0) {
            $this->status = 'partial';
        } else {
            $this->status = 'pending';
        }
        $this->save();
    }
}
