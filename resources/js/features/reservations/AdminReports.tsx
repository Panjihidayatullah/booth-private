import { useState } from 'react';
import { DatePicker } from '../../components/fields/DatePicker';
import { SelectField } from '../../components/fields/SelectField';
import { BarChart3, CalendarDays, Clock3, Ticket, UserX, XCircle } from 'lucide-react';
import type { AppConfig } from '../../types/app';
import { Empty, Feedback, Field, Loading, formatDate, formatNumber, todayWib, useAdminResource, type AdminRoom } from './admin-shared';

interface ReportNumbers { effective_hours: number; reserved_hours: number; available_hours: number; utilization_rate: number; cancellations: number; no_shows: number; total_reservations: number; }
interface ReportData { period: { from: string; to: string }; summary: ReportNumbers; rooms: (ReportNumbers & { room_id: number; room_name: string })[]; }

function periodError(from: string, to: string): string {
    if (!from || !to) return 'Pilih tanggal mulai dan tanggal selesai untuk melihat laporan.';
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!validDate(from) || !validDate(to)) return 'Pilih tanggal yang valid untuk periode laporan.';
    if (from > to) return 'Tanggal selesai harus sama dengan atau setelah tanggal mulai.';
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
    return days > 366 ? 'Periode laporan maksimal 366 hari. Sesuaikan tanggal mulai atau tanggal selesai.' : '';
}

export default function AdminReports({ config }: { config: AppConfig }) {
    const today = todayWib();
    const [filters, setFilters] = useState({ from: `${today.slice(0, 8)}01`, to: today, room_id: '' });
    const validationError = periodError(filters.from, filters.to);
    const report = useAdminResource<ReportData>(config, '/admin/reports', filters, 0, !validationError);
    const rooms = useAdminResource<AdminRoom[]>(config, '/admin/rooms');
    const summary = report.data?.summary;
    const stats = summary ? [
        { label: 'Jam efektif', value: formatNumber(summary.effective_hours), suffix: 'jam', text: 'Penggunaan aktual yang tercatat', icon: Clock3 },
        { label: 'Tingkat penggunaan', value: formatNumber(summary.utilization_rate), suffix: '%', text: 'Jam efektif ÷ jam tersedia', icon: BarChart3 },
        { label: 'Jam terpesan', value: formatNumber(summary.reserved_hours), suffix: 'jam', text: 'Jadwal reservasi yang tidak dibatalkan', icon: CalendarDays },
        { label: 'Total reservasi', value: formatNumber(summary.total_reservations, 0), suffix: '', text: 'Reservasi yang mulai pada periode ini', icon: Ticket },
        { label: 'Pembatalan', value: formatNumber(summary.cancellations, 0), suffix: '', text: 'Reservasi berstatus dibatalkan', icon: XCircle },
        { label: 'Tidak hadir', value: formatNumber(summary.no_shows, 0), suffix: '', text: 'Penyewa yang ditandai tidak hadir', icon: UserX },
    ] : [];
    return <div className="rt-page rta-admin-page">
        <div className="rt-page-heading"><div><span className="rt-eyebrow">Laporan okupansi</span><h2>Kenali bagaimana ruang digunakan.</h2><p>Ringkasan penggunaan dan hasil reservasi pada periode yang dipilih.</p></div></div>
        <Feedback error={validationError || report.error || rooms.error} />
        <section className="rt-card rt-filters" aria-label="Filter laporan okupansi">
            <Field label="Tanggal mulai" htmlFor="report-from"><DatePicker id="report-from" value={filters.from} max={filters.to || undefined} required onChange={value => setFilters({ ...filters, from: value })} /></Field>
            <Field label="Tanggal selesai" htmlFor="report-to"><DatePicker id="report-to" value={filters.to} min={filters.from || undefined} required onChange={value => setFilters({ ...filters, to: value })} /></Field>
            <Field label="Ruangan" htmlFor="report-room" full><SelectField id="report-room" value={filters.room_id} onChange={value => setFilters({ ...filters, room_id: value })} options={[{ value: '', label: 'Semua ruangan' }, ...(rooms.data ?? []).map(room => ({ value: String(room.id), label: room.name }))]} /></Field>
        </section>
        {report.loading && !report.data ? <Loading /> : summary && report.data ? <>
            <p className="rta-report-meta" role="status">Periode {formatDate(`${report.data.period.from.slice(0, 10)}T00:00:00+07:00`)}–{formatDate(`${report.data.period.to.slice(0, 10)}T00:00:00+07:00`)} · seluruh waktu dalam WIB.</p>
            <div className="rt-grid rt-grid-3">{stats.map(stat => { const Icon = stat.icon; return <article className="rt-card" key={stat.label}><span className="rt-stat-icon"><Icon /></span><p className="rt-eyebrow">{stat.label}</p><p className="rta-stat-value">{stat.value} <small>{stat.suffix}</small></p><p className="rta-stat-caption">{stat.text}</p></article>; })}</div>
            <div className="rt-card rta-report-method"><h3>Dasar perhitungan</h3><p className="rta-note">Tersedia <strong>{formatNumber(summary.available_hours)} jam operasional</strong> pada periode ini. Jam tersedia mengikuti riwayat status aktif ruangan pada pukul 07.00–22.00 WIB, dikurangi blok pemeliharaan. Jam efektif dihitung dari check-in hingga check-out, dibatasi akhir reservasi dan periode laporan. Penggunaan yang masih berjalan dihitung sampai waktu saat ini.</p><p className="rta-note">Tingkat penggunaan = jam efektif ÷ jam tersedia × 100%. Jumlah reservasi, pembatalan, dan Tidak Hadir dikelompokkan berdasarkan tanggal mulai reservasi. Rentang laporan maksimal 366 hari.</p></div>
            {report.data.rooms.length ? <div className="rt-table-wrap"><table className="rt-table"><thead><tr><th>Ruangan</th><th>Jam efektif</th><th>Jam terpesan</th><th>Jam tersedia</th><th>Penggunaan</th><th>Reservasi</th><th>Batal</th><th>Tidak hadir</th></tr></thead><tbody>{report.data.rooms.map(room => <tr key={room.room_id}><td><strong className="rta-item-name">{room.room_name}</strong></td><td>{formatNumber(room.effective_hours)} jam</td><td>{formatNumber(room.reserved_hours)} jam</td><td>{formatNumber(room.available_hours)} jam</td><td><div className="rta-utilization"><div className="rta-utilization-bar" role="progressbar" aria-label={`Penggunaan ${room.room_name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, Number(room.utilization_rate)))}><span style={{ width: `${Math.max(0, Math.min(100, Number(room.utilization_rate)))}%` }} /></div><strong>{formatNumber(room.utilization_rate)}%</strong></div></td><td>{room.total_reservations}</td><td>{room.cancellations}</td><td>{room.no_shows}</td></tr>)}</tbody></table></div> : <Empty title="Belum ada data ruangan">Tambahkan ruangan dan catat penggunaan untuk melihat rincian okupansi. Angka laporan hanya dihitung dari data yang tersimpan.</Empty>}
        </> : null}
    </div>;
}
