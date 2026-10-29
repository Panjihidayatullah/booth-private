<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ReservationEventNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Reservation $reservation,
        public string $action
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];

        // Only add mail channel if user has email address configured
        if (! empty($notifiable->email)) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $room = $this->reservation->room;
        $startFormatted = $this->reservation->starts_at->timezone('Asia/Jakarta')->translatedFormat('d M Y, H:i');
        $endFormatted = $this->reservation->ends_at->timezone('Asia/Jakarta')->format('H:i');

        $mail = (new MailMessage)
            ->subject($this->getSubject())
            ->greeting('Halo, '.$notifiable->name.'!')
            ->line($this->getIntroLine())
            ->line('**Kode Tiket:** '.$this->reservation->code)
            ->line('**Ruangan:** '.$room->name.' ('.($room->type === 'booth' ? 'Booth Privat' : 'Ruang Kerja').')')
            ->line('**Lokasi:** '.$room->location.' · '.$room->floor)
            ->line('**Jadwal:** '.$startFormatted.' – '.$endFormatted.' WIB')
            ->line('**Jumlah Orang:** '.$this->reservation->attendees.' orang');

        if ($this->action === 'created') {
            $mail->line('**Keperluan:** '.$this->reservation->purpose)
                ->line('Tunjukkan kode tiket ini kepada petugas di lokasi saat kedatangan. Pembayaran dilakukan langsung di tempat kepada petugas.')
                ->action('Buka Reservasi Saya', url('/reservasi'));
        } elseif ($this->action === 'check_in') {
            $mail->line('Kehadiranmu telah dicatat oleh petugas. Selamat menggunakan fasilitas RuangTemu!')
                ->action('Buka Reservasi Saya', url('/reservasi'));
        } elseif ($this->action === 'check_out') {
            $mail->line('Penggunaan ruangan telah selesai dicatat. Terima kasih telah menggunakan layanan RuangTemu!')
                ->action('Buka Reservasi Saya', url('/reservasi'));
        } elseif ($this->action === 'cancelled') {
            $mail->line('Reservasi telah berhasil dibatalkan dan slot ruangan telah dibuka kembali.')
                ->action('Cari Ruangan Lain', url('/ruangan'));
        } elseif ($this->action === 'no_show') {
            $mail->line('Reservasi ditandai Tidak Hadir karena telah melewati toleransi keterlambatan 15 menit dari jam mulai.')
                ->action('Buka Reservasi Saya', url('/reservasi'));
        }

        $mail->salutation("Salam hangat,\nTim RuangTemu");

        return $mail;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'reservation_id' => $this->reservation->id,
            'code' => $this->reservation->code,
            'room_name' => $this->reservation->room->name,
            'room_type' => $this->reservation->room->type,
            'action' => $this->action,
            'title' => $this->getTitle(),
            'message' => $this->getMessage(),
            'starts_at' => $this->reservation->starts_at->toIso8601String(),
            'ends_at' => $this->reservation->ends_at->toIso8601String(),
        ];
    }

    private function getSubject(): string
    {
        return match ($this->action) {
            'created' => 'Konfirmasi Tiket Reservasi RuangTemu - '.$this->reservation->code,
            'cancelled' => 'Pemberitahuan Pembatalan Reservasi - '.$this->reservation->code,
            'check_in' => 'Check-in Berhasil Dicatat - '.$this->reservation->code,
            'check_out' => 'Penggunaan Ruangan Selesai (Check-out) - '.$this->reservation->code,
            'no_show' => 'Pemberitahuan Tidak Hadir - '.$this->reservation->code,
            default => 'Pembaruan Reservasi RuangTemu - '.$this->reservation->code,
        };
    }

    private function getTitle(): string
    {
        return match ($this->action) {
            'created' => 'Tiket Reservasi Terbit',
            'cancelled' => 'Reservasi Dibatalkan',
            'check_in' => 'Check-in Berhasil',
            'check_out' => 'Sesi Penggunaan Selesai',
            'no_show' => 'Reservasi Ditandai Tidak Hadir',
            default => 'Status Reservasi Diperbarui',
        };
    }

    private function getIntroLine(): string
    {
        return match ($this->action) {
            'created' => 'Reservasimu telah berhasil dibuat di sistem RuangTemu.',
            'cancelled' => 'Reservasi berikut telah resmi dibatalkan.',
            'check_in' => 'Petugas telah mencatat kedatangan dan check-in kamu.',
            'check_out' => 'Waktu check-out penggunaan ruangan telah dicatat.',
            'no_show' => 'Reservasi ditandai Tidak Hadir karena melewati toleransi waktu.',
            default => 'Terdapat pembaruan pada reservasi ruangan kamu.',
        };
    }

    private function getMessage(): string
    {
        $room = $this->reservation->room;

        return match ($this->action) {
            'created' => 'Reservasi ruangan '.$room->name.' telah berhasil dikonfirmasi dengan kode tiket '.$this->reservation->code.'.',
            'cancelled' => 'Reservasi '.$this->reservation->code.' untuk ruangan '.$room->name.' telah dibatalkan.',
            'check_in' => 'Check-in untuk ruangan '.$room->name.' telah dicatat oleh petugas.',
            'check_out' => 'Check-out untuk ruangan '.$room->name.' selesai. Terima kasih!',
            'no_show' => 'Reservasi '.$this->reservation->code.' ditandai Tidak Hadir setelah melewati toleransi 15 menit.',
            default => 'Status reservasi '.$this->reservation->code.' telah diperbarui.',
        };
    }
}
