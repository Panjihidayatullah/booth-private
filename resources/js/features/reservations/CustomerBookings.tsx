import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SelectField } from '../../components/fields/SelectField';
import { ArrowUpRight, CalendarDays, Clock3, RefreshCw, Ticket, Users, XCircle } from 'lucide-react';
import type { AppConfig } from '../../types/app';
import { describeRequestError, http, type ValidationErrors } from '../../lib/http';
import { BusinessDialog, EmptyState, ErrorNotice, LoadingState, ReservationTicket, STATUS_LABELS, StatusBadge, formatDate, formatTime } from './shared';
import type { Reservation } from './types';

type ReservationView = 'upcoming' | 'history' | 'all';

function BookingViewTabs({ value, onChange }: { value: ReservationView; onChange: (value: ReservationView) => void }) {
    const tabsRef = useRef<HTMLDivElement>(null);
    const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

    useLayoutEffect(() => {
        const tabs = tabsRef.current;
        if (!tabs) return;
        const updateIndicator = () => {
            const active = tabs.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
            if (!active) return;
            const next = { left: active.offsetLeft, width: active.offsetWidth };
            setIndicator(current => current?.left === next.left && current.width === next.width ? current : next);
        };
        updateIndicator();
        const observer = new ResizeObserver(updateIndicator);
        observer.observe(tabs);
        tabs.querySelectorAll('button').forEach(button => observer.observe(button));
        return () => observer.disconnect();
    }, [value]);

    return <div ref={tabsRef} className="rt-booking-tabs" role="group" aria-label="Kelompok reservasi">
        {indicator ? <span className="rt-booking-tabs-indicator" aria-hidden="true" style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }} /> : null}
        {([{ value: 'upcoming', label: 'Mendatang' }, { value: 'history', label: 'Riwayat' }, { value: 'all', label: 'Semua' }] as const).map(tab => <button key={tab.value} type="button" aria-pressed={value === tab.value} onClick={() => onChange(tab.value)}>{tab.label}</button>)}
    </div>;
}

export default function CustomerBookings({ config }: { config: AppConfig }) {
    const [view, setView] = useState<ReservationView>('upcoming');
    const [status, setStatus] = useState('');
    const [items, setItems] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [success, setSuccess] = useState('');
    const [selected, setSelected] = useState<Reservation | null>(null);
    const [cancelItem, setCancelItem] = useState<Reservation | null>(null);
    const [cancelError, setCancelError] = useState('');
    const [cancelErrors, setCancelErrors] = useState<ValidationErrors>({});
    const [cancelling, setCancelling] = useState(false);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const request = new AbortController();
        setLoading(true);
        setError('');
        setErrors({});
        http.get<{ data: Reservation[] }>(`${config.apiBaseUrl}/customer/reservations`, { params: { view, status: status || undefined }, signal: request.signal }).then(({ data }) => setItems(data.data)).catch((requestError) => {
            if (request.signal.aborted) return;
            const failure = describeRequestError(requestError);
            setError(failure.message);
            setErrors(failure.errors);
        }).finally(() => { if (!request.signal.aborted) setLoading(false); });
        return () => request.abort();
    }, [config.apiBaseUrl, view, status, refresh]);

    async function cancelReservation() {
        if (!cancelItem || cancelling) return;
        setCancelling(true);
        setCancelError('');
        setCancelErrors({});
        try {
            await http.post(`${config.apiBaseUrl}/customer/reservations/${cancelItem.id}/cancel`);
            setSuccess(`Reservasi ${cancelItem.code} telah dibatalkan. Slot waktunya kembali tersedia.`);
            setCancelItem(null);
            setSelected(null);
            setRefresh((value) => value + 1);
        } catch (requestError) {
            const failure = describeRequestError(requestError);
            setCancelError(failure.message);
            setCancelErrors(failure.errors);
        } finally { setCancelling(false); }
    }

    return <div className="rt-page">
        <div className="rt-page-heading"><div><span className="rt-eyebrow">Rencana dan perjalananmu</span><h2>Reservasi saya.</h2><p>Lihat jadwal mendatang, simpan tiket, dan temukan kembali riwayat penggunaan ruangmu. Seluruh waktu ditampilkan dalam WIB.</p></div><a className="rt-button primary" href={config.urls.customer.rooms}>Cari ruangan<ArrowUpRight aria-hidden="true" /></a></div>
        <div className="rt-toolbar rt-booking-toolbar"><BookingViewTabs value={view} onChange={setView} /><div className="rt-actions rt-booking-filter-actions"><div className="rt-field"><label htmlFor="customer-reservation-status">Status</label><SelectField id="customer-reservation-status" value={status} onChange={(value) => setStatus(value)} options={[{ value: '', label: 'Semua status' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]} /></div><button className="rt-button secondary" type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw aria-hidden="true" />Perbarui</button></div></div>
        {success ? <div className="rt-success" role="status">{success}</div> : null}<ErrorNotice message={error} errors={errors} />
        {loading ? <LoadingState>Memuat reservasimu...</LoadingState> : !error && items.length === 0 ? <EmptyState title={view === 'upcoming' ? 'Belum ada rencana berikutnya.' : 'Tidak ada reservasi yang sesuai.'} action={<a className="rt-button primary" href={config.urls.customer.rooms}>Temukan ruang<ArrowUpRight aria-hidden="true" /></a>}>Reservasi yang kamu buat akan muncul di sini. Coba ubah kelompok atau filter status jika reservasi belum terlihat.</EmptyState> : !error ? <div className="rt-reservation-list">{items.map((item) => <article className="rt-card rt-reservation-card" key={item.id}><div className="rt-reservation-main"><div className="rt-reservation-top"><span className="rt-reservation-code">{item.code}</span><StatusBadge status={item.status} /></div><h3>{item.room.name}</h3><div className="rt-reservation-meta"><span><CalendarDays aria-hidden="true" />{formatDate(item.starts_at)}</span><span><Clock3 aria-hidden="true" />{formatTime(item.starts_at)}–{formatTime(item.ends_at)} WIB</span><span><Users aria-hidden="true" />{item.attendees} orang</span></div></div><div className="rt-actions"><button className="rt-button secondary" type="button" onClick={() => setSelected(item)}><Ticket aria-hidden="true" />Lihat tiket</button>{item.can_cancel ? <button className="rt-button danger" type="button" onClick={() => { setCancelItem(item); setCancelError(''); setCancelErrors({}); }}><XCircle aria-hidden="true" />Batalkan</button> : null}</div></article>)}</div> : null}
        <BusinessDialog open={Boolean(selected)} title="Bukti reservasi" onClose={() => setSelected(null)} footer={<button className="rt-button secondary" type="button" onClick={() => setSelected(null)}>Tutup</button>}>{selected ? <ReservationTicket reservation={selected} apiBaseUrl={config.apiBaseUrl} /> : null}</BusinessDialog>
        <BusinessDialog open={Boolean(cancelItem)} title="Batalkan reservasi?" onClose={() => { if (!cancelling) setCancelItem(null); }} closeDisabled={cancelling} footer={<><button className="rt-button secondary" type="button" onClick={() => setCancelItem(null)} disabled={cancelling}>Tetap simpan</button><button className="rt-button danger" type="button" onClick={cancelReservation} disabled={cancelling}>{cancelling ? 'Membatalkan...' : 'Ya, batalkan reservasi'}</button></>}>
            <p className="rt-muted">Reservasi yang dibatalkan tidak dapat digunakan kembali. Slot akan dibuka untuk penyewa lain setelah pembatalan berhasil.</p>{cancelItem ? <div className="rt-cancel-summary"><strong>{cancelItem.room.name}</strong><p>{cancelItem.code} · {formatDate(cancelItem.starts_at)}</p><p>{formatTime(cancelItem.starts_at)}–{formatTime(cancelItem.ends_at)} WIB</p></div> : null}<ErrorNotice message={cancelError} errors={cancelErrors} /><p className="rt-muted">Pembatalan hanya dapat dilakukan sebelum jam mulai dan akan divalidasi kembali oleh sistem.</p>
        </BusinessDialog>
    </div>;
}
