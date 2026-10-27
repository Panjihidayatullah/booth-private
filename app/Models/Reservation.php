<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reservation extends Model
{
    public const ACTIVE_STATUSES = ['confirmed', 'checked_in'];
    public const STATUSES = ['confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'];

    protected $fillable = ['code', 'user_id', 'room_id', 'purpose', 'attendees', 'starts_at', 'ends_at', 'status', 'checked_in_at', 'checked_out_at', 'cancelled_at', 'no_show_at'];
    protected $appends = ['can_cancel', 'allowed_actions'];

    protected function casts(): array
    {
        return ['user_id' => 'integer', 'room_id' => 'integer', 'attendees' => 'integer', 'starts_at' => 'datetime', 'ends_at' => 'datetime', 'checked_in_at' => 'datetime', 'checked_out_at' => 'datetime', 'cancelled_at' => 'datetime', 'no_show_at' => 'datetime'];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->select(['id', 'name', 'username', 'email']);
    }

    public function getCanCancelAttribute(): bool
    {
        return $this->status === 'confirmed' && now()->lt($this->starts_at);
    }

    public function getAllowedActionsAttribute(): array
    {
        if ($this->status === 'checked_in') return $this->checked_in_at && now()->gte($this->checked_in_at) ? ['check_out'] : [];
        if ($this->status !== 'confirmed') return [];
        if (now()->gt($this->starts_at->copy()->addMinutes(config('reservations.late_minutes')))) return ['no_show'];
        return now()->gte($this->starts_at) && now()->lt($this->ends_at) ? ['check_in'] : [];
    }
}
