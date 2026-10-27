<?php

namespace App\Http\Controllers;

use App\Models\Reservation;
use App\Services\ReservationService;
use App\Services\ReservationTicketPdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

class ReservationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Reservation::query()->with(['room.facilities', 'user'])->where('user_id', Auth::guard('web')->id());
        $this->filter($request, $query);
        $query->orderBy('starts_at', $request->input('view') === 'upcoming' ? 'asc' : 'desc');
        return response()->json(['data' => $query->limit(500)->get()]);
    }

    public function show(Reservation $reservation): JsonResponse
    {
        abort_unless($reservation->user_id === Auth::guard('web')->id(), 404);
        return response()->json(['data' => $reservation->load(['room.facilities', 'user'])]);
    }

    public function ticket(Reservation $reservation, ReservationTicketPdf $pdf): Response
    {
        abort_unless($reservation->user_id === Auth::guard('web')->id(), 404);

        return $pdf->download($reservation->load(['room', 'user']));
    }

    public function store(Request $request, ReservationService $service): JsonResponse
    {
        $input = $request->validate([
            'room_id' => ['required', 'integer', 'exists:rooms,id'], 'attendees' => ['required', 'integer', 'min:1', 'max:1000'],
            'purpose' => ['required', 'string', 'max:2000'],
        ]);
        [$start, $end] = $service->window($request, true);
        $reservation = $service->create(Auth::guard('web')->user(), $input, $start, $end);
        return response()->json(['data' => $reservation, 'message' => 'Reservasi berhasil. Simpan kode tiket untuk ditunjukkan kepada petugas.'], 201);
    }

    public function cancel(Reservation $reservation, ReservationService $service): JsonResponse
    {
        return response()->json(['data' => $service->cancel($reservation, Auth::guard('web')->user()), 'message' => 'Reservasi dibatalkan. Slot ruangan kembali tersedia.']);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $query = Reservation::query()->with(['room.facilities', 'user']);
        $this->filter($request, $query);
        return response()->json(['data' => $query->orderByDesc('starts_at')->limit(500)->get()]);
    }

    public function checkIn(Reservation $reservation, ReservationService $service): JsonResponse
    {
        return response()->json(['data' => $service->transition($reservation, 'check_in'), 'message' => 'Check-in berhasil dicatat.']);
    }

    public function checkOut(Reservation $reservation, ReservationService $service): JsonResponse
    {
        return response()->json(['data' => $service->transition($reservation, 'check_out'), 'message' => 'Check-out berhasil dicatat.']);
    }

    public function noShow(Reservation $reservation, ReservationService $service): JsonResponse
    {
        return response()->json(['data' => $service->transition($reservation, 'no_show'), 'message' => 'Reservasi ditandai Tidak Hadir.']);
    }

    private function filter(Request $request, Builder $query): void
    {
        $input = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'], 'status' => ['nullable', 'in:'.implode(',', Reservation::STATUSES)],
            'room_id' => ['nullable', 'integer'], 'q' => ['nullable', 'string', 'max:150'], 'view' => ['nullable', 'in:upcoming,history,all'],
        ]);
        if (! empty($input['date'])) $query->whereDate('starts_at', $input['date']);
        if (! empty($input['status'])) $query->where('status', $input['status']);
        if (! empty($input['room_id'])) $query->where('room_id', $input['room_id']);
        if (($input['view'] ?? '') === 'upcoming') $query->whereIn('status', Reservation::ACTIVE_STATUSES)->where('ends_at', '>', now());
        if (($input['view'] ?? '') === 'history') $query->where(fn ($q) => $q->whereNotIn('status', Reservation::ACTIVE_STATUSES)->orWhere('ends_at', '<=', now()));
        if (! empty($input['q'])) {
            $query->where(fn ($q) => $q->where('code', 'like', '%'.$input['q'].'%')->orWhereHas('user', fn ($u) => $u->where(fn ($names) => $names->where('name', 'like', '%'.$input['q'].'%')->orWhere('username', 'like', '%'.$input['q'].'%'))));
        }
    }
}
