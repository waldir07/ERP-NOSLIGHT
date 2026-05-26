<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductVariant extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'amperage',
        'sku',
        'cost_price',
        'sale_price',
        'is_finished',
        'notes',
    ];

    protected $casts = [
        'cost_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'is_finished' => 'boolean',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
