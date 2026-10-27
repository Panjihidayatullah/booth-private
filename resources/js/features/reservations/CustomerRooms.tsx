import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { DatePicker } from '../../components/fields/DatePicker';
import { SelectField } from '../../components/fields/SelectField';
import { TimePicker } from '../../components/fields/TimePicker';
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, Clock3, MapPin, SlidersHorizontal, Users } from 'lucide-react';
import type { AppConfig } from '../../types/app';
import { describeRequestError, http, type ValidationErrors } from '../../lib/http';
import { BusinessDialog, EmptyState, ErrorNotice, FieldError, LoadingState, ReservationTicket, RoomCard, RoomPlan, formatDate, roomTypeLabel, todayInJakarta } from './shared';
import type { BookingValues, Facility, Reservation, Room } from './types';

interface RoomFilters {
    date: string;
    start_time: string;
    end_time: string;
    attendees: number;
    type: string;
    facility_ids: number[];
    q: string;
}

function initialFilters(): RoomFilters {
    const date = todayInJakarta();
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 9);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
    const nextSlot = Math.max(7 * 60, Math.ceil((hour * 60 + minute + 15) / 30) * 30);
    const tomorrow = nextSlot > 21 * 60;
    const start = tomorrow ? 9 * 60 : nextSlot;
    const toTime = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
    return { date: tomorrow ? new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10) : date, start_time: toTime(start), end_time: toTime(Math.min(start + 60, 22 * 60)), attendees: 1, type: '', facility_ids: [], q: '' };
}

function validateBooking(values: BookingValues, capacity: number): ValidationErrors {
    const result: ValidationErrors = {};
    if (!values.date || values.date < todayInJakarta()) result.date = ['Pilih tanggal hari ini atau setelahnya.'];
    const minutes = (value: string) => { const [hours, mins] = value.split(':').map(Number); return hours * 60 + mins; };
    const start = minutes(values.start_time);
    const end = minutes(values.end_time);
    if (!values.start_time || !Number.isFinite(start) || start < 420 || start >= 1320) result.start_time = ['Jam mulai harus berada dalam jam operasional 07:00–22:00 WIB.'];
    if (!values.end_time || !Number.isFinite(end) || end > 1320 || end - start < 30) result.end_time = ['Durasi minimal 30 menit dan berakhir paling lambat 22:00 WIB.'];
    if (!Number.isInteger(values.attendees) || values.attendees < 1 || values.attendees > capacity) result.attendees = [`Jumlah orang harus antara 1 dan ${capacity}.`];
    if (!values.purpose.trim()) result.purpose = ['Tuliskan keperluan penggunaan ruangan.'];
    return result;
}

function validateSearchFilters(filters: RoomFilters): ValidationErrors {
    const errors: ValidationErrors = {};
    const date = new Date(`${filters.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== filters.date || filters.date < todayInJakarta()) errors.date = ['Pilih tanggal hari ini atau setelahnya.'];
    const minutes = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
    const start = minutes(filters.start_time);
    const end = minutes(filters.end_time);
    if (!Number.isFinite(start) || start < 420 || start >= 1320) errors.start_time = ['Pilih jam mulai dalam jam operasional 07:00–22:00 WIB.'];
    if (!Number.isFinite(end) || end > 1320 || end < 450 || Number.isFinite(start) && end - start < 30) errors.end_time = ['Jam selesai harus sesudah jam mulai, dengan durasi minimal 30 menit dan paling lambat 22:00 WIB.'];
    if (!Number.isInteger(filters.attendees) || filters.attendees < 1 || filters.attendees > 1000) errors.attendees = ['Jumlah orang harus antara 1 dan 1000.'];
    return errors;
}

export default function CustomerRooms({ config }: { config: AppConfig }) {
    const [filters, setFilters] = useState<RoomFilters>(initialFilters);
    const debouncedQuery = useDebouncedValue(filters.q.trim());
    const waitingForQuery = debouncedQuery !== filters.q.trim();
    const applied = useMemo<RoomFilters>(() => ({ date: filters.date, start_time: filters.start_time, end_time: filters.end_time, attendees: filters.attendees, type: filters.type, facility_ids: filters.facility_ids, q: debouncedQuery }), [filters.date, filters.start_time, filters.end_time, filters.attendees, filters.type, filters.facility_ids, debouncedQuery]);
    const localErrors = validateSearchFilters(filters);
    const filtersValid = Object.keys(localErrors).length === 0;
    const canSearch = filtersValid && !waitingForQuery;
    const queryKey = JSON.stringify(applied);
    const activeQuery = useRef<string | null>(null);
    activeQuery.current = canSearch ? queryKey : null;
    const [settledQuery, setSettledQuery] = useState<string | null>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchErrors, setSearchErrors] = useState<ValidationErrors>({});
    const [facilityError, setFacilityError] = useState('');
    const [room, setRoom] = useState<Room | null>(null);
    const [mode, setMode] = useState<'detail' | 'booking' | 'review' | 'ticket'>('detail');
    const [booking, setBooking] = useState<BookingValues>({ ...initialFilters(), purpose: '' });
    const [bookingErrors, setBookingErrors] = useState<ValidationErrors>({});
    const [bookingError, setBookingError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [ticket, setTicket] = useState<Reservation | null>(null);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const request = new AbortController();
        http.get<{ data: Facility[] }>(`${config.apiBaseUrl}/catalog/facilities`, { signal: request.signal }).then(({ data }) => setFacilities(data.data)).catch((requestError) => { if (!request.signal.aborted) setFacilityError(describeRequestError(requestError).message); });
        return () => request.abort();
    }, [config.apiBaseUrl]);

    useEffect(() => {
        const request = new AbortController();
        if (!canSearch) { setLoading(false); setError(''); setSearchErrors({}); return () => request.abort(); }
        const isCurrent = () => !request.signal.aborted && activeQuery.current === queryKey;
        setLoading(true);
        setError('');
        setSearchErrors({});
        http.get<{ data: Room[] }>(`${config.apiBaseUrl}/catalog/rooms`, { params: applied, signal: request.signal }).then(({ data }) => { if (isCurrent()) setRooms(data.data); }).catch((requestError) => {
            if (!isCurrent()) return;
            const failure = describeRequestError(requestError);
            setError(failure.message);
            setSearchErrors(failure.errors);
        }).finally(() => { if (isCurrent()) { setSettledQuery(queryKey); setLoading(false); } });
        return () => request.abort();
    }, [config.apiBaseUrl, applied, queryKey, canSearch, refresh]);

    function openRoom(selected: Room, nextMode: 'detail' | 'booking') {
        setRoom(selected);
        setMode(nextMode);
        setBooking({ date: applied.date, start_time: applied.start_time, end_time: applied.end_time, attendees: applied.attendees, purpose: '' });
        setBookingErrors({});
        setBookingError('');
        setTicket(null);
    }

    function closeRoom() { if (!submitting) setRoom(null); }

    function reviewBooking(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!room) return;
        const validation = validateBooking(booking, room.capacity);
        setBookingErrors(validation);
        setBookingError('');
        if (Object.keys(validation).length === 0) setMode('review');
    }

    async function confirmBooking() {
        if (!room || submitting) return;
        setSubmitting(true);
        setBookingError('');
        setBookingErrors({});
        try {
            const { data } = await http.post<{ data: Reservation }>(`${config.apiBaseUrl}/customer/reservations`, { room_id: room.id, ...booking, purpose: booking.purpose.trim() });
            setTicket(data.data);
            setMode('ticket');
            setRefresh((value) => value + 1);
        } catch (requestError) {
            const failure = describeRequestError(requestError);
            setBookingError(failure.message);
            setBookingErrors(failure.errors);
        } finally { setSubmitting(false); }
    }

    const dialogTitle = mode === 'detail' ? 'Detail ruangan' : mode === 'booking' ? 'Pesan ruangan' : mode === 'review' ? 'Periksa reservasimu' : 'Reservasi berhasil';
    const searchBusy = filtersValid && (waitingForQuery || loading || settledQuery !== queryKey);
    const currentError = canSearch && settledQuery === queryKey ? error : '';
    const visibleSearchErrors = filtersValid && !waitingForQuery && settledQuery === queryKey ? searchErrors : localErrors;

    return <div className="rt-page">
        <div className="rt-page-heading"><div><span className="rt-eyebrow">Tempat untuk rencanamu</span><h2>Temukan ruang yang sesuai.</h2><p>Pilih jadwal dan kebutuhanmu. Ruang yang ditampilkan menyesuaikan kapasitas, fasilitas, serta ketersediaan pada waktu pilihanmu.</p></div><span className="rt-chip"><Clock3 aria-hidden="true" />07:00–22:00 WIB</span></div>
        <section className="rt-card rt-filters" aria-label="Filter pencarian ruangan">
            <div className="rt-room-filters-grid">
                <div className="rt-field rt-filter-wide"><label htmlFor="room-date">Tanggal</label><DatePicker id="room-date" required min={todayInJakarta()} value={filters.date} aria-invalid={Boolean(visibleSearchErrors.date)} onChange={(value) => setFilters({ ...filters, date: value })} /><FieldError errors={visibleSearchErrors} field="date" /></div>
                <div className="rt-field"><label htmlFor="room-start">Jam mulai</label><TimePicker id="room-start" autoApply required min="07:00" max="21:30" step={60} value={filters.start_time} aria-invalid={Boolean(visibleSearchErrors.start_time)} onChange={(value) => setFilters({ ...filters, start_time: value })} /><FieldError errors={visibleSearchErrors} field="start_time" /></div>
                <div className="rt-field"><label htmlFor="room-end">Jam selesai</label><TimePicker id="room-end" autoApply required min="07:30" max="22:00" step={60} value={filters.end_time} aria-invalid={Boolean(visibleSearchErrors.end_time)} onChange={(value) => setFilters({ ...filters, end_time: value })} /><FieldError errors={visibleSearchErrors} field="end_time" /></div>
                <div className="rt-field rt-filter-wide"><label htmlFor="room-people">Jumlah orang</label><input id="room-people" type="number" required min={1} max={1000} value={filters.attendees} aria-invalid={Boolean(visibleSearchErrors.attendees)} onChange={(event) => setFilters({ ...filters, attendees: Number(event.target.value) })} /><FieldError errors={visibleSearchErrors} field="attendees" /></div>
                <div className="rt-field rt-filter-wide"><label htmlFor="room-type">Jenis ruangan</label><SelectField id="room-type" value={filters.type} onChange={(value) => setFilters({ ...filters, type: value })} options={[{ value: '', label: 'Semua jenis' }, { value: 'workspace', label: 'Ruang Kerja' }, { value: 'booth', label: 'Booth Privat' }]} /></div>
            </div>
            <div className="rt-field"><label htmlFor="room-search">Nama atau lokasi ruangan</label><input id="room-search" type="search" value={filters.q} placeholder="Cari nama ruangan atau lokasi" maxLength={150} onChange={(event) => setFilters({ ...filters, q: event.target.value })} /></div>
            <div className="rt-search-bottom"><div className="rt-filter-facility-group"><span>Fasilitas</span><div className="rt-filter-facilities">{facilities.map((facility) => <label className="rt-facility-option" key={facility.id}><input type="checkbox" checked={filters.facility_ids.includes(facility.id)} onChange={(event) => setFilters({ ...filters, facility_ids: event.target.checked ? [...filters.facility_ids, facility.id] : filters.facility_ids.filter((id) => id !== facility.id) })} /><span><Check width={12} height={12} aria-hidden="true" />{facility.name}</span></label>)}{facilities.length === 0 && !facilityError ? <span className="rt-muted">Belum ada fasilitas yang terdaftar.</span> : null}</div></div><div className="rt-actions"><button className="rt-button secondary" type="button" onClick={() => setFilters(initialFilters())}><SlidersHorizontal aria-hidden="true" />Reset</button></div></div>
        </section>
        <ErrorNotice message={facilityError} /><ErrorNotice message={currentError} errors={visibleSearchErrors} />
        <div className="rt-results-heading" aria-live="polite"><h3>{!filtersValid ? 'Lengkapi filter pencarian' : searchBusy ? 'Mencari ruangan...' : currentError ? 'Pencarian belum dapat dimuat' : `${rooms.length} ruangan tersedia`}</h3><p>{filtersValid ? `${formatDate(applied.date)} · ${applied.start_time}–${applied.end_time} WIB · ${applied.attendees} orang` : 'Pilih jadwal dan jumlah orang yang valid.'}</p></div>
        {!filtersValid ? <EmptyState title="Sesuaikan filter pencarian">Pilih tanggal, jumlah orang, dan rentang jam yang valid. Durasi penggunaan minimal 30 menit.</EmptyState> : searchBusy ? <LoadingState>Memeriksa ketersediaan ruangan...</LoadingState> : !currentError && rooms.length === 0 ? <EmptyState title="Belum ada ruang yang sesuai">Coba ganti jadwal, jumlah orang, atau fasilitas. Ruangan nonaktif dan jadwal yang sedang digunakan tidak ditampilkan.</EmptyState> : !currentError ? <div className="rt-grid rt-grid-3">{rooms.map((item) => <RoomCard key={item.id} room={item} onDetail={(selected) => openRoom(selected, 'detail')} onBook={(selected) => openRoom(selected, 'booking')} />)}</div> : null}
        <BusinessDialog open={Boolean(room)} title={dialogTitle} onClose={closeRoom} closeDisabled={submitting} footer={room ? <>
            {mode === 'detail' ? <><button className="rt-button secondary" type="button" onClick={closeRoom}>Tutup</button><button className="rt-button primary" type="button" onClick={() => setMode('booking')}>Pesan ruangan<ArrowUpRight aria-hidden="true" /></button></> : null}
            {mode === 'booking' ? <><button className="rt-button secondary" type="button" onClick={() => setMode('detail')}><ArrowLeft aria-hidden="true" />Detail ruangan</button><button className="rt-button primary" type="submit" form="customer-booking-form">Lihat ringkasan<ArrowUpRight aria-hidden="true" /></button></> : null}
            {mode === 'review' ? <><button className="rt-button secondary" type="button" onClick={() => setMode('booking')} disabled={submitting}><ArrowLeft aria-hidden="true" />Ubah isian</button><button className="rt-button primary" type="button" onClick={confirmBooking} disabled={submitting}>{submitting ? 'Memproses...' : 'Konfirmasi reservasi'}<Check aria-hidden="true" /></button></> : null}
            {mode === 'ticket' ? <><button className="rt-button secondary" type="button" onClick={closeRoom}>Tutup</button><a className="rt-button primary" href={config.urls.customer.bookings}>Reservasi saya<ArrowUpRight aria-hidden="true" /></a></> : null}
        </> : undefined}>
            {room && mode === 'detail' ? <div className="rt-room-detail"><div className="rt-room-detail-title"><h3>{room.name}</h3><p>{room.description || 'Informasi penggunaan ruang disiapkan oleh pengelola.'}</p></div><div className="rt-room-detail-meta"><span><Users aria-hidden="true" />Maksimal {room.capacity} orang</span><span><MapPin aria-hidden="true" />{room.location} · Lantai {room.floor}</span><span>{roomTypeLabel(room.type)}</span></div><div><h4>Fasilitas ruangan</h4><div className="rt-chip-list">{room.facilities.length ? room.facilities.map((facility) => <span className="rt-chip" key={facility.id}>{facility.name}</span>) : <span className="rt-muted">Belum ada fasilitas tambahan.</span>}</div></div><div><h4>Aturan penggunaan</h4><p className="rt-room-rules">{room.rules || 'Silakan ikuti arahan pengelola saat menggunakan ruangan.'}</p></div><div><h4>Denah skematik</h4><RoomPlan room={room} /></div></div> : null}
            {room && mode === 'booking' ? <><div className="rt-booking-step"><span className="is-current">1. Lengkapi isian</span><i /><span>2. Periksa ringkasan</span><i /><span>3. Tiket</span></div><div className="rt-booking-head"><h3>{room.name}</h3><p>{roomTypeLabel(room.type)} · {room.location} · Kapasitas {room.capacity} orang</p></div><form id="customer-booking-form" className="rt-booking-form" onSubmit={reviewBooking}><div className="rt-form-grid"><div className="rt-field"><label htmlFor="booking-date">Tanggal penggunaan</label><DatePicker id="booking-date" min={todayInJakarta()} required value={booking.date} onChange={(value) => setBooking({ ...booking, date: value })} /><FieldError errors={bookingErrors} field="date" /></div><div className="rt-field"><label htmlFor="booking-people">Jumlah orang</label><input id="booking-people" type="number" min={1} max={room.capacity} required value={booking.attendees} onChange={(event) => setBooking({ ...booking, attendees: Number(event.target.value) })} /><FieldError errors={bookingErrors} field="attendees" /></div><div className="rt-field"><label htmlFor="booking-start">Jam mulai (WIB)</label><TimePicker id="booking-start" min="07:00" max="21:30" step={60} required value={booking.start_time} onChange={(value) => setBooking({ ...booking, start_time: value })} /><FieldError errors={bookingErrors} field="start_time" /></div><div className="rt-field"><label htmlFor="booking-end">Jam selesai (WIB)</label><TimePicker id="booking-end" min="07:30" max="22:00" step={60} required value={booking.end_time} onChange={(value) => setBooking({ ...booking, end_time: value })} /><FieldError errors={bookingErrors} field="end_time" /></div><div className="rt-field rt-field-full"><label htmlFor="booking-purpose">Keperluan penggunaan</label><textarea id="booking-purpose" required maxLength={2000} rows={3} placeholder="Misalnya: diskusi tim, belajar, atau panggilan daring" value={booking.purpose} onChange={(event) => setBooking({ ...booking, purpose: event.target.value })} /><FieldError errors={bookingErrors} field="purpose" /></div></div><div className="rt-booking-policy"><p>Operasional 07:00–22:00 WIB, durasi minimal 30 menit. Kapasitas dan ketersediaan akan diperiksa kembali saat reservasi dikonfirmasi.</p></div></form></> : null}
            {room && mode === 'review' ? <div className="rt-booking-review"><div className="rt-booking-step"><span>1. Lengkapi isian</span><i /><span className="is-current">2. Periksa ringkasan</span><i /><span>3. Tiket</span></div><ErrorNotice message={bookingError} errors={bookingErrors} /><dl><div><dt>Ruangan</dt><dd>{room.name}</dd></div><div><dt>Penyewa</dt><dd>{config.user?.name}</dd></div><div><dt><CalendarDays aria-hidden="true" /> Tanggal</dt><dd>{formatDate(booking.date)}</dd></div><div><dt>Waktu (WIB)</dt><dd>{booking.start_time}–{booking.end_time}</dd></div><div><dt>Jumlah orang</dt><dd>{booking.attendees} orang</dd></div><div><dt>Lokasi</dt><dd>{room.location} · Lantai {room.floor}</dd></div><div className="rt-field-full"><dt>Keperluan</dt><dd>{booking.purpose}</dd></div></dl><div className="rt-booking-policy"><p>Dengan mengonfirmasi, kamu menyetujui aturan penggunaan ruangan. Pembatalan mandiri hanya tersedia sebelum jam mulai. Pembayaran dilakukan langsung kepada petugas di lokasi.</p></div></div> : null}
            {mode === 'ticket' && ticket ? <div className="rt-booking-success"><p>Reservasi telah tersimpan. Simpan kode tiket dan tunjukkan kepada petugas saat datang.</p><ReservationTicket reservation={ticket} apiBaseUrl={config.apiBaseUrl} /></div> : null}
        </BusinessDialog>
    </div>;
}
