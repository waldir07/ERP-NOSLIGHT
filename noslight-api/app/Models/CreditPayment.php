<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CreditPayment extends Model
{
    use HasFactory;
// 👇 ESTO ES LO QUE DEBES AGREGAR O REEMPLAZAR
    protected $fillable = [
        'credit_id',
        'customer_id',
        'user_id',
        'amount',
        'payment_method',
        'payment_date',
    ];
    protected $casts = [
        'payment_date' => 'date',
    ];

    public function credit()
    {
        return $this->belongsTo(Credit::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
