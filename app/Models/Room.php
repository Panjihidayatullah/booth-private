<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Room extends Model
{
    use SoftDeletes;

    public const DEFAULT_FLOOR_PLAN = ['width' => 6, 'depth' => 4, 'desks' => 1, 'door' => 'bottom'];

    protected $fillable = ['name', 'type', 'capacity', 'location', 'floor', 'rules', 'description', 'is_active', 'maintenance_notes', 'image_url', 'floor_plan'];

    protected function casts(): array
    {
        return ['capacity' => 'integer', 'is_active' => 'boolean', 'floor_plan' => 'array'];
    }

    public function facilities(): BelongsToMany
    {
        return $this->belongsToMany(Facility::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function maintenanceBlocks(): HasMany
    {
        return $this->hasMany(MaintenanceBlock::class);
    }

    public function statusPeriods(): HasMany
    {
        return $this->hasMany(RoomStatusPeriod::class);
    }
}
