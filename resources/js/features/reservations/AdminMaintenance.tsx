import { useState, type FormEvent } from 'react';
import { DatePicker } from '../../components/fields/DatePicker';
import { SelectField } from '../../components/fields/SelectField';
import { TimePicker } from '../../components/fields/TimePicker';
import { CalendarRange, Plus, Trash2 } from 'lucide-react';
import type { AppConfig } from '../../types/app';
import { http, type ValidationErrors } from '../../lib/http';
import { AdminDialog, ConfirmDialog, Empty, Feedback, Field, Loading, adminError, api, formatDate, formatTime, todayWib, useAdminResource, type AdminMaintenance, type AdminRoom } from './admin-shared';

export default function AdminMaintenance({ config }: { config: AppConfig }) {
    const [filters, setFilters] = useState({ date: '', room_id: '' });
    const blocks = useAdminResource<AdminMaintenance[]>(config, '/admin/maintenance', filters);
    const rooms = useAdminResource<AdminRoom[]>(config, '/admin/rooms');
    const [draft, setDraft] = useState<{ room_id: string; date: string; start_time: string; end_time: string; reason: string } | null>(null);
    const [deleting, setDeleting] = useState<AdminMaintenance | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (!draft || busy) return;
        setBusy(true); setError(''); setErrors({});
        try {
            await http.post(api(config, '/admin/maintenance'), { ...draft, room_id: Number(draft.room_id) });
            setSuccess('Waktu pemeliharaan berhasil diblokir. Ruangan tidak dapat dipesan pada rentang tersebut.'); setDraft(null); blocks.refresh();
        } catch (reason) { const result = adminError(reason); setError(result.message); setErrors(result.errors); }
        finally { setBusy(false); }
    }
    async function remove() {
        if (!deleting || busy) return; setBusy(true); setError('');
        try { await http.delete(api(config, `/admin/maintenance/${deleting.id}`)); setSuccess('Blok pemeliharaan dihapus. Ketersediaan ruangan sudah diperbarui.'); setDeleting(null); blocks.refresh(); }
        catch (reason) { setError(adminError(reason).message); setDeleting(null); }
        finally { setBusy(false); }
    }
    return <div className="rt-page rta-admin-page">
        <div className="rt-page-heading"><div><span className="rt-eyebrow">Jaga kesiapan ruangan</span><h2>Waktu untuk merawat ruang.</h2><p>Blokir waktu pemeliharaan agar tidak bertabrakan dengan pemesanan.</p></div><button className="rt-button primary" type="button" disabled={!rooms.data?.length} onClick={() => { setError(''); setSuccess(''); setErrors({}); setDraft({ room_id: '', date: todayWib(), start_time: '07:00', end_time: '08:00', reason: '' }); }}><Plus />Jadwalkan pemeliharaan</button></div>
        {!draft ? <Feedback error={error || blocks.error || rooms.error} success={success} /> : null}
        <div className="rt-card rt-filters"><Field label="Tanggal" htmlFor="maintenance-filter-date" full><DatePicker id="maintenance-filter-date" value={filters.date} onChange={value => setFilters({ ...filters, date: value })} /></Field><Field label="Ruangan" htmlFor="maintenance-filter-room" full><SelectField id="maintenance-filter-room" value={filters.room_id} onChange={value => setFilters({ ...filters, room_id: value })} options={[{ value: '', label: 'Semua ruangan' }, ...(rooms.data ?? []).map(room => ({ value: String(room.id), label: room.name }))]} /></Field><button className="rt-button secondary rta-filter-end" type="button" onClick={() => setFilters({ date: '', room_id: '' })}>Reset filter</button></div>
        <p className="rta-note">Sistem menolak jadwal pemeliharaan yang berbenturan dengan reservasi aktif. Jam operasional 07.00–22.00 WIB.</p>
        {blocks.loading && !blocks.data ? <Loading /> : blocks.data?.length ? <div className="rt-grid rt-grid-2">{blocks.data.map(block => <article className="rt-card" key={block.id}><div className="rta-room-title"><div><span className="rt-eyebrow">Blok pemeliharaan</span><h3>{block.room.name}</h3></div><span className="rt-stat-icon"><CalendarRange /></span></div><p className="rt-muted">{formatDate(block.starts_at)} · {formatTime(block.starts_at)}–{formatTime(block.ends_at)} WIB</p><p className="rta-note">{block.reason}</p><div className="rta-card-actions"><button type="button" className="rt-button secondary" onClick={() => { setError(''); setSuccess(''); setDeleting(block); }}><Trash2 />Hapus blok waktu</button></div></article>)}</div> : <Empty title={rooms.data?.length ? 'Tidak ada blok pemeliharaan' : 'Tambahkan ruangan terlebih dahulu'}>{rooms.data?.length ? 'Jadwal pemeliharaan yang sesuai filter akan ditampilkan di sini.' : 'Ruangan perlu tersedia sebelum Anda dapat menjadwalkan pemeliharaan.'}</Empty>}
        {draft ? <AdminDialog title="Jadwalkan pemeliharaan" busy={busy} onClose={() => setDraft(null)} footer={<><button type="button" className="rt-button secondary" onClick={() => setDraft(null)} disabled={busy}>Batal</button><button type="submit" form="maintenance-form" className="rt-button primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Blokir waktu'}</button></>}><Feedback error={error} /><form id="maintenance-form" className="rt-form-grid" onSubmit={save}>
            <Field label="Ruangan" htmlFor="maintenance-room" error={errors.room_id?.[0]} full><SelectField id="maintenance-room" value={draft.room_id} required onChange={value => setDraft({ ...draft, room_id: value })} options={[{ value: '', label: 'Pilih ruangan' }, ...(rooms.data ?? []).map(room => ({ value: String(room.id), label: room.name }))]} /></Field>
            <Field label="Tanggal" htmlFor="maintenance-date" error={errors.date?.[0]} full><DatePicker id="maintenance-date" value={draft.date} min={todayWib()} required onChange={value => setDraft({ ...draft, date: value })} /></Field>
            <Field label="Jam mulai (WIB)" htmlFor="maintenance-start" error={errors.start_time?.[0]}><TimePicker id="maintenance-start" min="07:00" max="21:30" step={60} value={draft.start_time} required onChange={value => setDraft({ ...draft, start_time: value })} /></Field>
            <Field label="Jam selesai (WIB)" htmlFor="maintenance-end" error={errors.end_time?.[0]}><TimePicker id="maintenance-end" min="07:30" max="22:00" step={60} value={draft.end_time} required onChange={value => setDraft({ ...draft, end_time: value })} /></Field>
            <Field label="Keperluan pemeliharaan" htmlFor="maintenance-reason" error={errors.reason?.[0]} full><textarea id="maintenance-reason" value={draft.reason} rows={3} required maxLength={2000} placeholder="Contoh: pemeriksaan perangkat dan pembersihan ruangan." onChange={event => setDraft({ ...draft, reason: event.target.value })} /></Field>
        </form></AdminDialog> : null}
        {deleting ? <ConfirmDialog title="Hapus blok pemeliharaan?" busy={busy} danger label="Hapus blok waktu" onClose={() => setDeleting(null)} onConfirm={remove}><p>Waktu <strong>{formatDate(deleting.starts_at)}, {formatTime(deleting.starts_at)}–{formatTime(deleting.ends_at)} WIB</strong> pada <strong>{deleting.room.name}</strong> akan dibuka kembali untuk pemesanan jika tidak ada blok lain.</p></ConfirmDialog> : null}
    </div>;
}
