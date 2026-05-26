<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{

    use HasFactory;

    // ESTA ES LA LÍNEA MÁGICA QUE ARREGLA EL ERROR:
    protected $guarded = [];

    // 👇 ESTA ES LA CONEXIÓN QUE LARAVEL ESTABA BUSCANDO
    public function sales()
    {
        return $this->hasMany(Sale::class);
    }

    // 👇 LA NUEVA: Para conectar con sus abonos
    public function creditPayments()
    {
        return $this->hasMany(CreditPayment::class);
    }

}
