<?php

namespace App\Http\Controllers;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\Admin;
use App\Services\OccupancyReportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ReportController extends Controller
{
    public function index(Request $request, OccupancyReportService $service): JsonResponse
    {
        $input = $request->validate(['from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d'], 'room_id' => ['nullable', 'integer', 'exists:rooms,id']]);
        $from = isset($input['from']) ? Carbon::parse($input['from'], config('reservations.timezone'))->startOfDay() : now()->startOfMonth();
        $to = isset($input['to']) ? Carbon::parse($input['to'], config('reservations.timezone'))->startOfDay() : now()->endOfMonth()->startOfDay();
        if ($to->lt($from)) throw ValidationException::withMessages(['to' => 'Tanggal akhir harus sama atau setelah tanggal awal.']);
        $until = $to->copy()->addDay();
        if ($from->diffInDays($until) > 366) throw ValidationException::withMessages(['to' => 'Pilih periode laporan maksimal 366 hari.']);
        return response()->json(['data' => $service->make($from, $until, isset($input['room_id']) ? (int) $input['room_id'] : null)]);
    }

    public function summary(Request $request): JsonResponse
    {
        $isAdmin = $request->user() instanceof Admin;
        $query = Reservation::query()->when(! $isAdmin, fn ($q) => $q->where('user_id', $request->user()->getAuthIdentifier()));
        return response()->json(['data' => [
            'rooms' => Room::query()->when(! $isAdmin, fn ($q) => $q->where('is_active', true))->count(),
            'upcoming' => (clone $query)->where('status', 'confirmed')->where('starts_at', '>', now())->count(),
            'active' => (clone $query)->where('status', 'checked_in')->count(),
            'today' => (clone $query)->whereDate('starts_at', now()->toDateString())->count(),
            'completed' => (clone $query)->where('status', 'completed')->count(),
            'cancelled' => (clone $query)->where('status', 'cancelled')->count(),
            'no_show' => (clone $query)->where('status', 'no_show')->count(),
        ]]);
    }
}
