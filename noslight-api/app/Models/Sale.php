<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    use HasFactory;

    // ESTA ES LA LÍNEA MÁGICA QUE ARREGLA EL ERROR:
    protected $guarded = [];

    public function items()
    {
        return $this->hasMany(SaleItem::class);
    }

    // 👇 AGREGA ESTA RELACIÓN HACIA EL CLIENTE (La que pedía el error)
    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    // 👇 Y AGREGA ESTA RELACIÓN HACIA EL VENDEDOR (Por si acaso la pide luego)
    public function user()
    {
        return $this->belongsTo(User::class);
    }


    public function payments()
    {
        return $this->hasMany(SalePayment::class);
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class);
    }


}
