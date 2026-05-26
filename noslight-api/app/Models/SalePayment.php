<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalePayment extends Model
{

    // ESTA ES LA LÍNEA MÁGICA QUE ARREGLA EL ERROR:
    protected $guarded = [];

}
