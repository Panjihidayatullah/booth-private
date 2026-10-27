<?php

namespace App\Http\Controllers;

use App\Models\MaintenanceBlock;
use App\Models\Room;
use App\Services\ReservationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MaintenanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate(['room_id' => ['nullable', 'integer'], 'date' => ['nullable', 'date_format:Y-m-d']]);
        $query = MaintenanceBlock::query()->with('room.facilities');
        if (! empty($input['room_id'])) $query->where('room_id', $input['room_id']);
        if (! empty($input['date'])) $query->whereDate('starts_at', $input['date']);
        return response()->json(['data' => $query->orderByDesc('starts_at')->limit(500)->get()]);
    }

    public function store(Request $request, ReservationService $service): JsonResponse
    {
        $input = $request->validate(['room_id' => ['required', 'integer', 'exists:rooms,id'], 'reason' => ['required', 'string', 'max:3000']]);
        [$start, $end] = $service->window($request);
        return response()->json(['data' => $service->createMaintenance($input, $start, $end), 'message' => 'Rentang pemeliharaan berhasil diblokir.'], 201);
    }

    public function destroy(MaintenanceBlock $maintenance): JsonResponse
    {
        DB::transaction(function () use ($maintenance) {
            Room::withTrashed()->lockForUpdate()->findOrFail($maintenance->room_id);
            $maintenance->delete();
        });
        return response()->json(['message' => 'Blok pemeliharaan dihapus. Ketersediaan ruangan diperbarui.']);
    }
}
