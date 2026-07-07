<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    use HasFactory;

    // ESTA ES LA LÍNEA MÁGICA QUE ARREGLA EL ERROR:
    protected $guarded = [];

    // 👇 Le decimos a Laravel qué tipo de dato es cada cosa
    protected $casts = [
        'has_credit' => 'boolean',
        'credit_limit' => 'decimal:2',
        'credit_balance' => 'decimal:2',
    ];

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

        /**
     * 🟢 RELACIÓN CON LOS DOCUMENTOS DE COBRO UNIFICADOS (LOTES CERRADOS)
     */
    public function credits()
    {
        // Un cliente tiene muchos registros de deudas en la tabla credits
        return $this->hasMany(Credit::class, 'customer_id');
    }

}
