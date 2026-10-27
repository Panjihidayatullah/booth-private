<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use App\Models\Reservation;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RoomController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate(['q' => ['nullable', 'string', 'max:150'], 'type' => ['nullable', 'in:workspace,booth'], 'is_active' => ['nullable', 'boolean']]);
        $query = Room::query()->with('facilities');
        if (! empty($input['q'])) $query->where('name', 'like', '%'.$input['q'].'%');
        if (! empty($input['type'])) $query->where('type', $input['type']);
        if (isset($input['is_active'])) $query->where('is_active', $input['is_active']);
        return response()->json(['data' => $query->orderBy('name')->limit(300)->get()]);
    }

    public function show(Room $room): JsonResponse
    {
        return response()->json(['data' => $room->load('facilities')]);
    }

    public function store(Request $request): JsonResponse
    {
        $input = $this->validated($request, true);
        $room = DB::transaction(function () use ($input) {
            $this->lockFacilities($input['facility_ids'] ?? []);
            $room = Room::create([...$input, 'is_active' => $input['is_active'] ?? true, 'floor_plan' => $input['floor_plan'] ?? Room::DEFAULT_FLOOR_PLAN]);
            $room->facilities()->sync($input['facility_ids'] ?? []);
            if ($room->is_active) $room->statusPeriods()->create(['starts_at' => now()]);
            return $room->load('facilities');
        });
        return response()->json(['data' => $room, 'message' => 'Ruangan berhasil ditambahkan.'], 201);
    }

    public function update(Request $request, Room $room): JsonResponse
    {
        $input = $this->validated($request, false);
        $room = DB::transaction(function () use ($room, $input) {
            $current = Room::query()->lockForUpdate()->findOrFail($room->id);
            if (array_key_exists('facility_ids', $input)) $this->lockFacilities($input['facility_ids']);
            $future = $current->reservations()->whereIn('status', Reservation::ACTIVE_STATUSES)->where('ends_at', '>', now());
            if (array_key_exists('is_active', $input) && ! $input['is_active'] && $future->exists()) {
                throw ValidationException::withMessages(['is_active' => 'Ruangan masih memiliki reservasi aktif. Selesaikan atau batalkan reservasi sebelum menonaktifkan.']);
            }
            if (isset($input['capacity']) && (clone $future)->where('attendees', '>', $input['capacity'])->exists()) {
                throw ValidationException::withMessages(['capacity' => 'Kapasitas baru lebih kecil dari jumlah peserta reservasi aktif.']);
            }
            $wasActive = $current->is_active;
            $current->update($input);
            if ($wasActive && ! $current->is_active) $current->statusPeriods()->whereNull('ends_at')->update(['ends_at' => now()]);
            if (! $wasActive && $current->is_active) $current->statusPeriods()->create(['starts_at' => now()]);
            if (array_key_exists('facility_ids', $input)) $current->facilities()->sync($input['facility_ids']);
            return $current->load('facilities');
        });
        return response()->json(['data' => $room, 'message' => 'Perubahan ruangan berhasil disimpan.']);
    }

    public function destroy(Room $room): JsonResponse
    {
        DB::transaction(function () use ($room) {
            $current = Room::query()->lockForUpdate()->findOrFail($room->id);
            if ($current->reservations()->whereIn('status', Reservation::ACTIVE_STATUSES)->where('ends_at', '>', now())->exists()) {
                throw ValidationException::withMessages(['room' => 'Ruangan masih memiliki reservasi aktif dan belum dapat diarsipkan.']);
            }
            $current->statusPeriods()->whereNull('ends_at')->update(['ends_at' => now()]);
            $current->delete();
        });
        return response()->json(['message' => 'Ruangan diarsipkan. Riwayat reservasi tetap tersimpan.']);
    }

    private function lockFacilities(array $ids): void
    {
        if ($ids === []) return;
        $existing = Facility::query()->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->pluck('id');
        if ($existing->count() !== count(array_unique($ids))) {
            throw ValidationException::withMessages(['facility_ids' => 'Pilihan fasilitas telah berubah. Muat ulang dan pilih fasilitas yang masih tersedia.']);
        }
    }

    private function validated(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';
        return $request->validate([
            'name' => [$required, 'string', 'max:150'], 'type' => [$required, Rule::in(['workspace', 'booth'])],
            'capacity' => [$required, 'integer', 'min:1', 'max:1000'], 'location' => [$required, 'string', 'max:200'],
            'floor' => [$required, 'string', 'max:80'], 'rules' => [$required, 'string', 'max:5000'],
            'description' => ['nullable', 'string', 'max:5000'], 'is_active' => ['sometimes', 'boolean'],
            'maintenance_notes' => ['nullable', 'string', 'max:5000'],
            'image_url' => ['nullable', 'string', 'max:1000', 'regex:#^(?:https?://[^\s]+|/(?:images|storage)/[A-Za-z0-9/_\.\-]+)$#'],
            'facility_ids' => ['sometimes', 'array', 'max:50'], 'facility_ids.*' => ['integer', 'distinct', 'exists:facilities,id'],
            'floor_plan' => ['sometimes', 'array:width,depth,desks,door'],
            'floor_plan.width' => ['required_with:floor_plan', 'numeric', 'min:1', 'max:100'],
            'floor_plan.depth' => ['required_with:floor_plan', 'numeric', 'min:1', 'max:100'],
            'floor_plan.desks' => ['required_with:floor_plan', 'integer', 'min:0', 'max:100'],
            'floor_plan.door' => ['required_with:floor_plan', 'in:top,right,bottom,left'],
        ]);
    }
}
