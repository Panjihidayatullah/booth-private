import { useState } from 'react';
import { DatePicker } from '../../components/fields/DatePicker';
import { SelectField } from '../../components/fields/SelectField';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Eye, LogIn, LogOut, RefreshCw, UserX } from 'lucide-react';
import type { AppConfig } from '../../types/app';
import { http } from '../../lib/http';
import { AdminDialog, ConfirmDialog, Empty, Feedback, Field, Loading, StatusBadge, adminError, api, formatDate, formatDateTime, formatTime, statusLabels, useAdminResource, type AdminReservation, type AdminRoom } from './admin-shared';

const actionLabels: Record<string, string> = { check_in: 'Check-in', check_out: 'Check-out', no_show: 'Tidak hadir' };
const actionPaths: Record<string, string> = { check_in: 'check-in', check_out: 'check-out', no_show: 'no-show' };
const actionCopy: Record<string, string> = { check_in: 'Catat bahwa penyewa sudah datang dan mulai menggunakan ruangan.', check_out: 'Catat waktu selesai penggunaan ruangan oleh penyewa.', no_show: 'Tandai penyewa tidak hadir. Aksi ini hanya diizinkan setelah lewat 15 menit dari jam mulai.' };
const attendanceActions = ['check_in', 'check_out', 'no_show'];

function attendanceHint(reservation: AdminReservation): string {
    if (reservation.status === 'completed') return 'Penggunaan sudah selesai. Pencatatan kehadiran untuk reservasi ini telah ditutup.';
    if (reservation.status === 'cancelled') return 'Reservasi sudah dibatalkan sehingga tindakan kehadiran tidak tersedia.';
    if (reservation.status === 'no_show') return 'Reservasi sudah ditandai Tidak hadir. Tindakan kehadiran tidak tersedia lagi.';
    if (reservation.status === 'checked_in') return 'Check-in sudah tercatat. Pilih Check-out setelah penyewa selesai menggunakan ruangan.';
    if (reservation.allowed_actions.includes('check_in')) return 'Waktu check-in sudah dibuka. Pilih Check-in ketika penyewa datang. Check-out tersedia setelah check-in.';
    if (reservation.allowed_actions.includes('no_show')) return 'Batas keterlambatan 15 menit sudah lewat. Pilih Tidak hadir jika penyewa belum datang.';
    const deadline = new Date(new Date(reservation.starts_at).getTime() + 15 * 60 * 1000).toISOString();
    return `Check-in belum dibuka. Jadwal check-in: ${formatDateTime(reservation.starts_at)}–${formatTime(deadline)} WIB. Check-out tersedia setelah check-in; Tidak hadir tersedia setelah lewat batas keterlambatan tersebut.`;
}

export default function AdminReservations({ config }: { config: AppConfig }) {
    const [filters, setFilters] = useState({ date: '', status: '', room_id: '', q: '' });
    const query = useDebouncedValue(filters.q.trim(), 300);
    const waitingForQuery = query !== filters.q.trim();
    const dateValid = filters.date === '' || /^\d{4}-\d{2}-\d{2}$/.test(filters.date) && !Number.isNaN(Date.parse(`${filters.date}T00:00:00Z`)) && new Date(`${filters.date}T00:00:00Z`).toISOString().slice(0, 10) === filters.date;
    const reservations = useAdminResource<AdminReservation[]>(config, '/admin/reservations', { ...filters, q: query }, 30000, dateValid && !waitingForQuery);
    const rooms = useAdminResource<AdminRoom[]>(config, '/admin/rooms');
    const [detailId, setDetailId] = useState<number | null>(null);
    const detail = reservations.data?.find(reservation => reservation.id === detailId) ?? null;
    const [action, setAction] = useState<{ reservation: AdminReservation; type: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    async function applyAction() {
        if (!action || busy) return; setBusy(true); setError('');
        try {
            const { data } = await http.post<{ data: AdminReservation }>(api(config, `/admin/reservations/${action.reservation.id}/${actionPaths[action.type]}`));
            reservations.setData(items => items?.map(item => item.id === data.data.id ? data.data : item) ?? null);
            setSuccess(`${actionLabels[action.type]} untuk tiket ${action.reservation.code} berhasil dicatat.`); setAction(null); reservations.refresh();
        } catch (reason) { setError(adminError(reason).message); setAction(null); reservations.refresh(); }
        finally { setBusy(false); }
    }
    function attendanceButton(reservation: AdminReservation, type: string, showDisabled = false) {
        const allowed = reservation.allowed_actions.includes(type);
        if (!allowed && !showDisabled) return null;
        return <button key={type} type="button" className={`rt-button ${type === 'no_show' ? 'secondary' : 'primary'}`} disabled={!allowed || busy || reservations.loading || Boolean(reservations.error)} aria-describedby={showDisabled ? 'reservation-attendance-hint' : undefined} title={actionCopy[type]} onClick={() => { setError(''); setSuccess(''); setAction({ reservation, type }); }}>{type === 'check_in' ? <LogIn /> : type === 'check_out' ? <LogOut /> : <UserX />}{actionLabels[type]}</button>;
    }
    function actionButtons(reservation: AdminReservation) {
        return <div><div className="rt-actions"><button className="rt-button secondary" type="button" onClick={() => { setError(''); setSuccess(''); setDetailId(reservation.id); }} aria-label={`Detail tiket ${reservation.code}`}><Eye />Detail</button>{attendanceActions.map(type => attendanceButton(reservation, type))}</div>{reservation.status === 'confirmed' && reservation.allowed_actions.length === 0 ? <small className="rta-action-hint">Check-in belum dibuka.</small> : null}</div>;
    }
    return <div className="rt-page rta-admin-page">
        <div className="rt-page-heading"><div><span className="rt-eyebrow">Kendali operasional</span><h2>Setiap kedatangan tercatat.</h2><p>Pantau reservasi dan catat penggunaan ruangan sesuai waktu aktual.</p></div><button type="button" className="rt-button secondary" onClick={reservations.refresh} disabled={reservations.loading || waitingForQuery || !dateValid}><RefreshCw className={reservations.loading ? 'loading-icon' : ''} />Segarkan</button></div>
        <Feedback error={error || reservations.error || rooms.error} success={success} />
        <section className="rt-card rt-filters rta-reservation-filters" aria-label="Filter reservasi">
            <Field label="Tanggal reservasi" htmlFor="reservation-date"><DatePicker id="reservation-date" value={filters.date} onChange={value => setFilters({ ...filters, date: value })} /></Field>
            <Field label="Status" htmlFor="reservation-status"><SelectField id="reservation-status" value={filters.status} onChange={value => setFilters({ ...filters, status: value })} options={[{ value: '', label: 'Semua status' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} /></Field>
            <Field label="Ruangan" htmlFor="reservation-room" full><SelectField id="reservation-room" value={filters.room_id} onChange={value => setFilters({ ...filters, room_id: value })} options={[{ value: '', label: 'Semua ruangan' }, ...(rooms.data ?? []).map(room => ({ value: String(room.id), label: room.name }))]} /></Field>
            <Field label="Nama penyewa / kode tiket" htmlFor="reservation-query" full><input id="reservation-query" value={filters.q} maxLength={150} placeholder="Cari reservasi..." onChange={event => setFilters({ ...filters, q: event.target.value })} /></Field>
            <button className="rt-button secondary rta-filter-end" type="button" onClick={() => setFilters({ date: '', status: '', room_id: '', q: '' })}>Reset</button>
        </section>
        <p className="rta-note">Hasil mengikuti filter secara otomatis. Check-in tersedia sejak jam mulai hingga toleransi 15 menit. Status Tidak Hadir hanya dapat dicatat setelah lewat 15 menit. Daftar juga diperbarui setiap 30 detik.</p>
        {!dateValid ? <Empty title="Pilih tanggal yang valid">Lengkapi tanggal reservasi atau kosongkan untuk melihat semua tanggal.</Empty> : waitingForQuery || reservations.loading && !reservations.data ? <Loading /> : reservations.error ? null : reservations.data?.length ? <>
            <div className="rt-table-wrap rta-reservation-table"><table className="rt-table"><thead><tr><th>Tiket & penyewa</th><th>Ruangan</th><th>Jadwal (WIB)</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>{reservations.data.map(reservation => <tr key={reservation.id}><td><span className="rta-item-name">{reservation.code}</span><span className="rta-item-sub">{reservation.user?.name ?? 'Penyewa'} · {reservation.attendees} orang</span></td><td>{reservation.room.name}</td><td><span>{formatDate(reservation.starts_at)}</span><span className="rta-item-sub">{formatTime(reservation.starts_at)}–{formatTime(reservation.ends_at)}</span></td><td><StatusBadge status={reservation.status} /></td><td>{actionButtons(reservation)}</td></tr>)}</tbody></table></div>
            <div className="rta-reservation-cards">{reservations.data.map(reservation => <article className="rta-reservation-card" key={reservation.id}><header><strong>{reservation.code}</strong><StatusBadge status={reservation.status} /></header><h3>{reservation.room.name}</h3><p>{reservation.user?.name ?? 'Penyewa'} · {reservation.attendees} orang</p><p>{formatDate(reservation.starts_at)}<br />{formatTime(reservation.starts_at)}–{formatTime(reservation.ends_at)} WIB</p>{actionButtons(reservation)}</article>)}</div>
        </> : <Empty title="Belum ada reservasi yang sesuai">Reservasi pelanggan akan muncul di sini. Sesuaikan filter untuk melihat tanggal atau status lainnya.</Empty>}
        {detail && !action ? <AdminDialog title="Detail reservasi" onClose={() => setDetailId(null)} wide footer={<><button type="button" className="rt-button secondary" onClick={reservations.refresh} disabled={reservations.loading}><RefreshCw className={reservations.loading ? 'loading-icon' : ''} />Perbarui status</button><button type="button" className="rt-button secondary" onClick={() => setDetailId(null)}>Tutup</button></>}>
            <p className="rta-ticket-code">{detail.code}</p>
            <section className="rta-attendance" aria-labelledby="reservation-attendance-title">
                <h3 id="reservation-attendance-title">Catat kehadiran</h3>
                <Feedback error={error || reservations.error} success={success} />
                <div className="rta-attendance-actions">{attendanceActions.map(type => attendanceButton(detail, type, true))}</div>
                <p id="reservation-attendance-hint" className="rta-note" role="status">{attendanceHint(detail)}</p>
            </section>
            <dl className="rta-details"><div><dt>Penyewa</dt><dd>{detail.user?.name ?? 'Penyewa'}{detail.user?.email ? <><br />{detail.user.email}</> : null}</dd></div><div><dt>Status</dt><dd><StatusBadge status={detail.status} /></dd></div><div><dt>Ruangan</dt><dd>{detail.room.name}<br />{detail.room.location} · {detail.room.floor}</dd></div><div><dt>Jumlah orang</dt><dd>{detail.attendees} dari kapasitas {detail.room.capacity} orang</dd></div><div><dt>Jadwal</dt><dd>{formatDate(detail.starts_at)}<br />{formatTime(detail.starts_at)}–{formatTime(detail.ends_at)} WIB</dd></div><div><dt>Keperluan</dt><dd>{detail.purpose}</dd></div></dl>
            <div className="rta-timeline"><p><span>Check-in</span>{formatDateTime(detail.checked_in_at)}</p><p><span>Check-out</span>{formatDateTime(detail.checked_out_at)}</p><p><span>Dibatalkan</span>{formatDateTime(detail.cancelled_at)}</p><p><span>Tidak hadir</span>{formatDateTime(detail.no_show_at)}</p></div>
        </AdminDialog> : null}
        {action ? <ConfirmDialog title={`${actionLabels[action.type]} reservasi?`} onClose={() => setAction(null)} onConfirm={applyAction} busy={busy} danger={action.type === 'no_show'} label={actionLabels[action.type]}><p><strong>{action.reservation.code}</strong> · {action.reservation.user?.name ?? 'Penyewa'}</p><p>{actionCopy[action.type]}</p><p>{action.reservation.room.name}, {formatDate(action.reservation.starts_at)}, {formatTime(action.reservation.starts_at)}–{formatTime(action.reservation.ends_at)} WIB.</p></ConfirmDialog> : null}
    </div>;
}
