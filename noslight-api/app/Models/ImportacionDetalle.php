<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ImportacionDetalle extends Model
{
    use HasFactory;

    protected $fillable = [
        'importacion_id',
        'product_id',
        'precio_unitario_proveedor',
        'cantidad',
        'costo_declarado',
        'fob_real',
        'costo_landed_unitario',
    ];

    protected $casts = [
        'precio_unitario_proveedor' => 'decimal:4',
        'costo_declarado' => 'decimal:2',
        'fob_real' => 'decimal:2',
        'costo_landed_unitario' => 'decimal:4',
    ];

    public function importacion()
    {
        return $this->belongsTo(Importacion::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
