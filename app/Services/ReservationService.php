<?php

namespace App\Services;

use App\Models\MaintenanceBlock;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use App\Notifications\ReservationEventNotification;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ReservationService
{
    public function window(Request $request, bool $future = false): array
    {
        $input = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
        ]);
        $timezone = config('reservations.timezone');
        $start = Carbon::createFromFormat('Y-m-d H:i', $input['date'].' '.$input['start_time'], $timezone)->startOfMinute();
        $end = Carbon::createFromFormat('Y-m-d H:i', $input['date'].' '.$input['end_time'], $timezone)->startOfMinute();
        if ($input['start_time'] < config('reservations.opens_at') || $input['end_time'] > config('reservations.closes_at')) {
            throw ValidationException::withMessages(['start_time' => 'Jam penggunaan ruangan adalah 07.00–22.00 WIB.']);
        }
        if ($end->lte($start) || $start->diffInMinutes($end) < config('reservations.minimum_minutes')) {
            throw ValidationException::withMessages(['end_time' => 'Jam selesai harus sesudah jam mulai dengan durasi minimal 30 menit.']);
        }
        if ($future && $start->lte(now())) {
            throw ValidationException::withMessages(['start_time' => 'Pilih waktu pemesanan yang belum dimulai.']);
        }
        return [$start, $end];
    }

    public function assertAvailable(Room $room, Carbon $start, Carbon $end, int $attendees): void
    {
        if (! $room->is_active) throw ValidationException::withMessages(['room_id' => 'Ruangan sedang nonaktif. Pilih ruangan lain.']);
        if ($attendees > $room->capacity) throw ValidationException::withMessages(['attendees' => 'Jumlah orang melebihi kapasitas ruangan.']);
        if ($room->reservations()->whereIn('status', Reservation::ACTIVE_STATUSES)->where('starts_at', '<', $end)->where('ends_at', '>', $start)->exists()) {
            throw ValidationException::withMessages(['start_time' => 'Jadwal sudah dipesan. Silakan pilih waktu lain.']);
        }
        if ($room->maintenanceBlocks()->where('starts_at', '<', $end)->where('ends_at', '>', $start)->exists()) {
            throw ValidationException::withMessages(['start_time' => 'Ruangan sedang diblokir untuk pemeliharaan pada waktu tersebut.']);
        }
    }

    public function create(User $user, array $input, Carbon $start, Carbon $end): Reservation
    {
        $reservation = DB::transaction(function () use ($user, $input, $start, $end) {
            $room = Room::query()->lockForUpdate()->findOrFail($input['room_id']);
            if ($start->lte(now())) {
                throw ValidationException::withMessages(['start_time' => 'Waktu pemesanan sudah dimulai. Pilih jadwal lain.']);
            }
            $this->assertAvailable($room, $start, $end, $input['attendees']);
            $reservation = Reservation::create([
                'code' => 'RT-'.$start->format('ymd').'-'.Str::upper((string) Str::ulid()),
                'user_id' => $user->id, 'room_id' => $room->id,
                'purpose' => $input['purpose'], 'attendees' => $input['attendees'],
                'starts_at' => $start, 'ends_at' => $end, 'status' => 'confirmed',
            ]);
            return $reservation->load(['room.facilities', 'user']);
        });

        $this->notifyUser($reservation, 'created');

        return $reservation;
    }

    public function cancel(Reservation $reservation, User $user): Reservation
    {
        abort_unless($reservation->user_id === $user->id, 404);
        $updated = DB::transaction(function () use ($reservation) {
            Room::withTrashed()->lockForUpdate()->findOrFail($reservation->room_id);
            $current = Reservation::query()->lockForUpdate()->findOrFail($reservation->id);
            if (! $current->can_cancel) throw ValidationException::withMessages(['reservation' => 'Reservasi hanya dapat dibatalkan sebelum jam mulai dan sebelum check-in.']);
            $current->update(['status' => 'cancelled', 'cancelled_at' => now()]);
            return $current->load(['room.facilities', 'user']);
        });

        $this->notifyUser($updated, 'cancelled');

        return $updated;
    }

    public function transition(Reservation $reservation, string $action): Reservation
    {
        $updated = DB::transaction(function () use ($reservation, $action) {
            Room::withTrashed()->lockForUpdate()->findOrFail($reservation->room_id);
            $current = Reservation::query()->lockForUpdate()->findOrFail($reservation->id);
            if (! in_array($action, $current->allowed_actions, true)) {
                $message = match ($action) {
                    'check_in' => 'Check-in hanya dapat dicatat sejak jam mulai hingga batas keterlambatan 15 menit dan sebelum jam selesai.',
                    'check_out' => 'Check-out hanya dapat dicatat setelah penyewa check-in.',
                    default => 'Tidak Hadir hanya dapat ditandai setelah lewat 15 menit dari jam mulai pada reservasi terkonfirmasi.',
                };
                throw ValidationException::withMessages(['status' => $message]);
            }
            $values = match ($action) {
                'check_in' => ['status' => 'checked_in', 'checked_in_at' => now()],
                'check_out' => ['status' => 'completed', 'checked_out_at' => now()],
                default => ['status' => 'no_show', 'no_show_at' => now()],
            };
            $current->update($values);
            return $current->load(['room.facilities', 'user']);
        });

        $this->notifyUser($updated, $action);

        return $updated;
    }

    private function notifyUser(Reservation $reservation, string $action): void
    {
        try {
            if ($reservation->user) {
                $reservation->user->notify(new ReservationEventNotification($reservation, $action));
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirimkan notifikasi reservasi: '.$e->getMessage(), [
                'reservation_id' => $reservation->id,
                'action' => $action,
            ]);
        }
    }

    public function createMaintenance(array $input, Carbon $start, Carbon $end): MaintenanceBlock
    {
        return DB::transaction(function () use ($input, $start, $end) {
            $room = Room::query()->lockForUpdate()->findOrFail($input['room_id']);
            if ($room->reservations()->whereIn('status', Reservation::ACTIVE_STATUSES)->where('starts_at', '<', $end)->where('ends_at', '>', $start)->exists()) {
                throw ValidationException::withMessages(['start_time' => 'Blokir pemeliharaan bertabrakan dengan reservasi aktif.']);
            }
            if ($room->maintenanceBlocks()->where('starts_at', '<', $end)->where('ends_at', '>', $start)->exists()) {
                throw ValidationException::withMessages(['start_time' => 'Sudah ada blokir pemeliharaan pada rentang waktu tersebut.']);
            }
            return MaintenanceBlock::create(['room_id' => $room->id, 'starts_at' => $start, 'ends_at' => $end, 'reason' => $input['reason']])->load('room.facilities');
        });
    }
}
