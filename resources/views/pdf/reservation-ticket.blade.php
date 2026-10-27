<!DOCTYPE html>
<html lang="id">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>Tiket reservasi {{ $reservation->code }}</title>
    <style>
        @page { margin: 36pt; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #1c362b; font-family: 'DejaVu Sans', sans-serif; font-size: 10pt; line-height: 1.6; }
        .brand { padding: 22pt 24pt; border-radius: 16pt; color: #ffffff; background: #1b4333; }
        .brand-name { margin: 0; font-size: 23pt; font-weight: bold; letter-spacing: -1pt; }
        .brand-symbol { color: #a3e615; }
        .brand-caption { margin: 4pt 0 0; color: #d4e1d6; font-size: 9pt; }
        .eyebrow { margin: 25pt 0 6pt; color: #6a7b70; font-size: 8pt; letter-spacing: 1pt; text-transform: uppercase; }
        h1 { margin: 0; font-size: 24pt; line-height: 1.3; letter-spacing: -.7pt; word-wrap: break-word; }
        .location { margin: 9pt 0 22pt; color: #6a7b70; word-wrap: break-word; }
        .ticket-code { padding: 16pt 18pt; border: 1pt dashed #a9c183; border-radius: 11pt; background: #f2f7e9; page-break-inside: avoid; }
        .ticket-code-label { margin: 0 0 5pt; color: #617254; font-size: 8pt; }
        .ticket-code-value { margin: 0; font-size: 11pt; font-weight: bold; letter-spacing: .5pt; word-wrap: break-word; }
        .status { display: inline-block; margin-top: 13pt; padding: 5pt 10pt; border: 1pt solid #d4e2c3; border-radius: 12pt; background: #f2f7e9; color: #42622b; font-size: 9pt; }
        .status-cancelled, .status-no_show { border-color: #efd5cb; background: #fff2ed; color: #9d5039; }
        .status-checked_in { border-color: #c2ded0; background: #edf8f2; color: #1c624c; }
        .status-completed { border-color: #cddde8; background: #f0f5fa; color: #39586c; }
        .details { width: 100%; margin-top: 22pt; border-collapse: collapse; table-layout: fixed; }
        .details td { width: 50%; padding: 0 18pt 20pt 0; vertical-align: top; word-wrap: break-word; }
        .details td + td { padding-right: 0; padding-left: 12pt; }
        .label { margin: 0 0 5pt; color: #6a7b70; font-size: 8pt; }
        .value { margin: 0; font-size: 10pt; word-wrap: break-word; }
        .purpose { padding-top: 2pt; }
        .purpose-text { margin: 0; white-space: pre-line; word-wrap: break-word; }
        .notice { margin-top: 25pt; padding: 17pt 18pt; border-radius: 11pt; background: #f5f7f2; page-break-inside: avoid; }
        .notice-title { margin: 0 0 6pt; font-size: 9pt; font-weight: bold; }
        .notice p { margin: 0; color: #566a5c; font-size: 8pt; line-height: 1.7; }
        .downloaded { margin-top: 18pt; color: #849087; font-size: 7pt; }
    </style>
</head>
<body>
    <div class="brand">
        <p class="brand-name"><span class="brand-symbol">*</span> RuangTemu</p>
        <p class="brand-caption">Ruang untuk bertemu. Waktu untuk fokus.</p>
    </div>

    <p class="eyebrow">Bukti reservasi ruangan</p>
    <h1>{{ $reservation->room->name }}</h1>
    <p class="location">{{ $reservation->room->type === 'booth' ? 'Booth Privat' : 'Ruang Kerja' }} - {{ $reservation->room->location }} - Lantai {{ $reservation->room->floor }}</p>

    <div class="ticket-code">
        <p class="ticket-code-label">KODE TIKET</p>
        <p class="ticket-code-value">{{ $reservation->code }}</p>
    </div>
    <span class="status status-{{ $reservation->status }}">{{ $statusLabel }}</span>

    <table class="details">
        <tr>
            <td>
                <p class="label">Tanggal penggunaan</p>
                <p class="value">{{ $reservation->starts_at->copy()->timezone('Asia/Jakarta')->locale('id')->translatedFormat('l, j F Y') }}</p>
            </td>
            <td>
                <p class="label">Waktu penggunaan (WIB)</p>
                <p class="value">{{ $reservation->starts_at->copy()->timezone('Asia/Jakarta')->format('H:i') }} - {{ $reservation->ends_at->copy()->timezone('Asia/Jakarta')->format('H:i') }} WIB</p>
            </td>
        </tr>
        <tr>
            <td>
                <p class="label">Penyewa</p>
                <p class="value">{{ $reservation->user->name }}</p>
            </td>
            <td>
                <p class="label">Jumlah orang</p>
                <p class="value">{{ $reservation->attendees }} orang</p>
            </td>
        </tr>
    </table>

    <div class="purpose">
        <p class="label">Keperluan penggunaan</p>
        <p class="purpose-text">{{ $reservation->purpose }}</p>
    </div>

    <div class="notice">
        <p class="notice-title">Simpan tiket dan tunjukkan kepada petugas saat datang.</p>
        <p>Pembayaran dilakukan langsung di lokasi. Kehadiran dicatat oleh petugas; keterlambatan lebih dari 15 menit dapat ditandai Tidak Hadir.</p>
        @if (in_array($reservation->status, ['cancelled', 'no_show'], true))
            <p>Reservasi ini {{ $reservation->status === 'cancelled' ? 'telah dibatalkan' : 'telah ditandai Tidak Hadir' }}. Tiket ini disimpan sebagai riwayat dan tidak dapat digunakan untuk check-in.</p>
        @endif
    </div>
    <p class="downloaded">Diunduh {{ $downloadedAt->locale('id')->translatedFormat('j F Y, H:i') }} WIB. Status sesuai catatan sistem saat diunduh.</p>
</body>
</html>
