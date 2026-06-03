<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasFactory;

    protected $fillable = ['key', 'value'];

    // Esta es la magia: Laravel convierte el JSON a Array automáticamente
    protected $casts = [
        'value' => 'array',
    ];
}
