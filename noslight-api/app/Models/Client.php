<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'phone', 'address', 'credit_limit'
    ];

    public function credits()
    {
        return $this->hasMany(Credit::class);
    }
}
