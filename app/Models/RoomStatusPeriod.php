<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoomStatusPeriod extends Model
{
    public $timestamps = false;

    protected $fillable = ['room_id', 'starts_at', 'ends_at'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }
}
