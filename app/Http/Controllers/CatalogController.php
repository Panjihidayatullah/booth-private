<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use App\Models\Reservation;
use App\Models\Room;
use App\Services\ReservationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CatalogController extends Controller
{
    public function rooms(Request $request, ReservationService $service): JsonResponse
    {
        $input = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'], 'start_time' => ['nullable', 'date_format:H:i'], 'end_time' => ['nullable', 'date_format:H:i'],
            'attendees' => ['nullable', 'integer', 'min:1', 'max:1000'], 'type' => ['nullable', 'in:workspace,booth'],
            'facility_ids' => ['nullable', 'array', 'max:50'], 'facility_ids.*' => ['integer', 'distinct', 'exists:facilities,id'],
            'q' => ['nullable', 'string', 'max:150'],
        ]);
        $query = Room::query()->with('facilities')->where('is_active', true);
        if (! empty($input['attendees'])) $query->where('capacity', '>=', $input['attendees']);
        if (! empty($input['type'])) $query->where('type', $input['type']);
        if (! empty($input['q'])) $query->where(fn ($q) => $q->where('name', 'like', '%'.$input['q'].'%')->orWhere('location', 'like', '%'.$input['q'].'%'));
        foreach ($input['facility_ids'] ?? [] as $facilityId) $query->whereHas('facilities', fn ($q) => $q->where('facilities.id', $facilityId));
        if ($request->filled('date') || $request->filled('start_time') || $request->filled('end_time')) {
            [$start, $end] = $service->window($request);
            if ($start->copy()->startOfDay()->lt(now()->startOfDay())) throw ValidationException::withMessages(['date' => 'Pilih tanggal hari ini atau sesudahnya.']);
            $query->whereDoesntHave('reservations', fn ($q) => $q->whereIn('status', Reservation::ACTIVE_STATUSES)->where('starts_at', '<', $end)->where('ends_at', '>', $start));
            $query->whereDoesntHave('maintenanceBlocks', fn ($q) => $q->where('starts_at', '<', $end)->where('ends_at', '>', $start));
        }
        return response()->json(['data' => $query->orderBy('name')->limit(300)->get()]);
    }

    public function show(Room $room): JsonResponse
    {
        abort_unless($room->is_active, 404);
        return response()->json(['data' => $room->load('facilities')]);
    }

    public function facilities(): JsonResponse
    {
        return response()->json(['data' => Facility::query()->orderBy('name')->limit(300)->get()]);
    }
}
