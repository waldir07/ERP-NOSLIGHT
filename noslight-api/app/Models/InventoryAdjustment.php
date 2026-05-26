<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryAdjustment extends Model
{
    protected $fillable = [
        'product_id', 'warehouse_id', 'quantity', 'reason', 'notes', 'user_id', 'status', 'approved_by'
    ];

    public function product() {
        return $this->belongsTo(Product::class);
    }

   
    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}