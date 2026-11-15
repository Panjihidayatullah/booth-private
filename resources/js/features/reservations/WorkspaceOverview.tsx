import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, RefreshCw } from 'lucide-react';
import type { AppConfig } from '../../types/app';
import { describeRequestError, http } from '../../lib/http';
import type { Reservation } from './types';
import { EmptyState, ErrorNotice, LoadingState, StatusBadge, formatDateTime, todayInJakarta } from './shared';

interface Summary {
    rooms: number;
    upcoming: number;
    active: number;
    today: number;
    completed: number;
    cancelled: number;
    no_show: number;
}

export default function WorkspaceOverview({ config }: { config: AppConfig }) {
    const isAdmin = config.portal === 'admin';
    const [summary, setSummary] = useState<Summary | null>(null);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        const path = isAdmin ? '/admin/reservations' : '/customer/reservations';
        const params = isAdmin ? { date: todayInJakarta() } : { view: 'upcoming' };
        Promise.all([
            http.get<{ data: Summary }>(`${config.apiBaseUrl}/workspace/summary`, { signal: controller.signal }),
            http.get<{ data: Reservation[] }>(`${config.apiBaseUrl}${path}`, { params, signal: controller.signal }),
        ]).then(([totals, bookings]) => {
            if (controller.signal.aborted) return;
            setSummary(totals.data.data);
            setReservations(bookings.data.data.slice(0, 4));
        }).catch((requestError: unknown) => {
            if (!controller.signal.aborted) setError(describeRequestError(requestError).message);
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [config.apiBaseUrl, isAdmin, revision]);

    const roomsUrl = isAdmin ? config.urls.admin.rooms : config.urls.customer.rooms;
    const bookingsUrl = isAdmin ? config.urls.admin.reservations : config.urls.customer.bookings;
    const stats = isAdmin
        ? [['Ruangan aktif', summary?.rooms], ['Reservasi hari ini', summary?.today], ['Sedang digunakan', summary?.active], ['Tidak hadir', summary?.no_show]]
        : [['Reservasi mendatang', summary?.upcoming], ['Sedang digunakan', summary?.active], ['Selesai', summary?.completed], ['Dibatalkan', summary?.cancelled]];

    return <div className="rt-page">
        <section className="workspace-welcome">
            <span className="tag-pill tag-pill-inverse">{isAdmin ? 'Portal pengelolaan RuangTemu' : 'Ruang untuk rencana berikutnya'}</span>
            <h2>Halo, {config.user?.name}.</h2>
            <p>{isAdmin ? 'Kelola ruangan, pantau kedatangan, dan lihat penggunaan fasilitas dalam satu tempat.' : 'Cari ruang yang tersedia, simpan tiketmu, dan ikuti setiap rencana penggunaan ruang.'}</p>
            <a className="button button-lime" href={roomsUrl}>{isAdmin ? 'Kelola Ruangan' : 'Cari Ruangan'}<ArrowUpRight aria-hidden="true" /></a>
        </section>
        {error ? <><ErrorNotice message={error} /><div><button className="rt-button secondary" onClick={() => setRevision((value) => value + 1)}><RefreshCw aria-hidden="true" />Coba lagi</button></div></> : null}
        {loading ? <LoadingState>Memuat ringkasan ruang...</LoadingState> : summary ? <div className="rt-stats">{stats.map(([label, value]) => <div className="rt-stat" key={String(label)}><span>{label}</span><strong>{value ?? 0}</strong><small>{isAdmin ? 'Berdasarkan data reservasi' : 'Berdasarkan akunmu'}</small></div>)}</div> : null}
        <section className="rt-card">
            <div className="rt-overview-heading"><h3>{isAdmin ? 'Agenda hari ini' : 'Rencana terdekat'}</h3><a className="rt-button secondary small" href={bookingsUrl}>Lihat semua<ArrowUpRight aria-hidden="true" /></a></div>
            {!loading && !error && reservations.length === 0 ? <EmptyState title={isAdmin ? 'Belum ada agenda hari ini' : 'Belum ada reservasi mendatang'} action={<a className="rt-button primary" href={roomsUrl}>{isAdmin ? 'Kelola ruangan' : 'Temukan ruangan'}</a>}>{isAdmin ? 'Reservasi akan muncul di sini setelah penyewa melakukan pemesanan.' : 'Pilih ruangan dan waktu yang sesuai untuk memulai reservasi pertamamu.'}</EmptyState> : null}
            <div className="rt-overview-list">{reservations.map((reservation) => <div className="rt-overview-row" key={reservation.id}><div><strong>{reservation.room.name}</strong><p><CalendarDays aria-hidden="true" style={{ display: 'inline', width: 13, height: 13, marginRight: 5 }} />{formatDateTime(reservation.starts_at)} · {reservation.code}</p>{isAdmin ? <p>{reservation.user?.name} · {reservation.attendees} orang</p> : null}</div><StatusBadge status={reservation.status} /></div>)}</div>
        </section>
    </div>;
}
