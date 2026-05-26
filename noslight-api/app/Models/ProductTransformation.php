<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductTransformation extends Model
{
    use HasFactory;

    protected $table = 'product_transformations';

    protected $fillable = [
        'raw_product_id',
        'raw_amperage',
        'finished_product_id',
        'finished_amperage',
        'conversion_rate',
        'extra_cost',
        'notes',
    ];

    protected $casts = [
        'conversion_rate' => 'decimal:2',
        'extra_cost'      => 'decimal:2',
        'raw_amperage'    => 'integer',
        'finished_amperage'=> 'integer',
    ];

    // Relaciones
    public function rawProduct()
    {
        return $this->belongsTo(Product::class, 'raw_product_id');
    }

    public function finishedProduct()
    {
        return $this->belongsTo(Product::class, 'finished_product_id');
    }
}
