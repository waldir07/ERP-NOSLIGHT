<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SaleItem extends Model
{
    use HasFactory;

    // Nuestro escudo desactivado para que acepte datos
    protected $guarded = [];

    // ESTA ES LA RELACIÓN QUE LARAVEL ESTABA BUSCANDO
    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    // Y esta es la relación de vuelta hacia la venta (por buenas prácticas)
    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }
}
