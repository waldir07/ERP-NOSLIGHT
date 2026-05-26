<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ImportacionGasto extends Model
{
    use HasFactory;

    protected $fillable = [
        'importacion_id',
        'descripcion',
        'monto',
        'moneda',
        'monto_convertido',
    ];

    protected $casts = [
        'monto' => 'decimal:2',
        'monto_convertido' => 'decimal:2',
    ];

    public function importacion()
    {
        return $this->belongsTo(Importacion::class);
    }
}
