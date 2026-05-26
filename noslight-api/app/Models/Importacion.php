<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Importacion extends Model
{
    use HasFactory;

    /**
     * Nombre explícito de la tabla (ESTO ES LO QUE FALTABA)
     */
    protected $table = 'importaciones';

    protected $fillable = [
        'invoice_code',
        'bl_awb',
        'fecha_aviso',
        'fecha_llegada_almacen',
        'proveedor_id',
        'empresa_importadora_id',
        'valor_dolar',
        'fob_total',
        'gastos_total',
        'factor',
        'estado',
        'notes',
        'user_id',
    ];

    protected $casts = [
        'fecha_aviso'           => 'date',
        'fecha_llegada_almacen' => 'date',
        'valor_dolar'           => 'decimal:4',
        'fob_total'             => 'decimal:2',
        'gastos_total'          => 'decimal:2',
        'factor'                => 'decimal:4',
    ];

    // Relaciones (las mantengo porque las tenías)
    public function user()
    {
        return $this->belongsTo(User::class);
    }



    public function detalles()
    {
        return $this->hasMany(ImportacionDetalle::class);
    }

    public function gastos()
    {
        return $this->hasMany(ImportacionGasto::class);
    }
}
