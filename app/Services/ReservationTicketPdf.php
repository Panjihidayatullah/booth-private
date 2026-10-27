<?php

namespace App\Services;

use App\Models\Reservation;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\HeaderUtils;

class ReservationTicketPdf
{
    public function render(Reservation $reservation): string
    {
        $statusLabel = match ($reservation->status) {
            'confirmed' => 'Terkonfirmasi',
            'checked_in' => 'Sedang digunakan',
            'completed' => 'Selesai',
            'cancelled' => 'Dibatalkan',
            'no_show' => 'Tidak hadir',
            default => 'Status tidak tersedia',
        };

        return Pdf::loadView('pdf.reservation-ticket', [
            'reservation' => $reservation,
            'statusLabel' => $statusLabel,
            'downloadedAt' => now()->timezone('Asia/Jakarta'),
        ])->setPaper('a4')->setOptions([
            'defaultFont' => 'DejaVu Sans',
            'isRemoteEnabled' => false,
            'isPhpEnabled' => false,
            'isJavascriptEnabled' => false,
            'isFontSubsettingEnabled' => true,
        ])->output();
    }

    public function download(Reservation $reservation): Response
    {
        $code = preg_replace('/[^A-Za-z0-9_-]/', '_', $reservation->code);
        $filename = 'tiket-'.($code ?: $reservation->id).'.pdf';

        return response($this->render($reservation), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $filename),
            'Cache-Control' => 'private, no-store, max-age=0, must-revalidate',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
