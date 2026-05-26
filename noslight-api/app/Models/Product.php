<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'base_code',
        'model',
        'brand',
        'package_size',
        'is_raw',
        'cost_price',
        'supplier',
        'notes',
        'initial_stock',
        'is_direct_sale',
        'raw_product_id',
        'amperage',
        'poles',
    ];

    protected $casts = [
        'is_raw'       => 'boolean',
        'is_direct_sale' => 'boolean',
        'cost_price'   => 'decimal:2',
        'package_size' => 'integer',
    ];

    // SKU automático
    public function getSkuAttribute()
    {
        return $this->is_raw ? 'M-' . $this->base_code : $this->base_code;
    }



    public function scopeFinished($query)
    {
        return $query->where('is_raw', false);
    }

        // ==================== TRANSFORMACIONES ====================

    public function rawTransformations()
    {
        return $this->hasMany(ProductTransformation::class, 'raw_product_id');
    }

    /**
     * Productos terminados que se pueden obtener desde este Raw
     */
    public function possibleFinishedProducts()
    {
        return $this->belongsToMany(
            Product::class,
            'product_transformations',
            'raw_product_id',
            'finished_product_id'
        )
        ->withPivot('id','raw_amperage', 'finished_amperage', 'conversion_rate', 'extra_cost', 'notes')
        ->withTimestamps();
    }

    /**
     * Scope para obtener solo productos Raw
     */
    public function scopeRaw($query)
    {
        return $query->where('is_raw', true);
    }

    /**
     * Trazabilidad: Si este es un producto terminado, ¿de qué Materia Prima está hecho?
     */
    public function rawProduct()
    {
        return $this->belongsTo(Product::class, 'raw_product_id');
    }

    /**
     * Si este es un producto RAW, ¿qué productos terminados se pueden hacer con él?
     */
    public function finishedProducts()
    {
        return $this->hasMany(Product::class, 'raw_product_id');
    }

}
