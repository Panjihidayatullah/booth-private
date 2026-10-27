import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { AppConfig } from '../../types/app';
import { describeRequestError, http } from '../../lib/http';
import type { Room } from './types';
import { BusinessDialog, EmptyState, ErrorNotice, LoadingState, RoomCard, RoomPlan, roomTypeLabel } from './shared';

export default function PublicRoomCatalog({ config }: { config: AppConfig }) {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [selected, setSelected] = useState<Room | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const destination = config.user?.role === 'admin' ? config.urls.admin.rooms : config.user ? config.urls.customer.rooms : config.urls.login;

    useEffect(() => {
        const controller = new AbortController();
        http.get<{ data: Room[] }>(`${config.apiBaseUrl}/catalog/rooms`, { signal: controller.signal }).then(({ data }) => {
            if (!controller.signal.aborted) setRooms(data.data.slice(0, 3));
        }).catch((requestError: unknown) => {
            if (!controller.signal.aborted) setError(describeRequestError(requestError).message);
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [config.apiBaseUrl]);

    return <div className="rt-public-catalog">
        {loading ? <LoadingState>Memuat pilihan ruangan...</LoadingState> : error ? <ErrorNotice message={error} /> : rooms.length ? <><div className="rt-grid rt-grid-3">{rooms.map((room) => <RoomCard key={room.id} room={room} onDetail={setSelected} />)}</div><div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}><a className="button button-lime" href={destination}>Lihat ketersediaan dan pesan<ArrowUpRight aria-hidden="true" /></a></div></> : <EmptyState title="Ruangan sedang disiapkan" action={<a className="button button-lime" href={destination}>{config.user?.role === 'admin' ? 'Tambahkan ruangan' : 'Masuk ke akun'}<ArrowUpRight aria-hidden="true" /></a>}>Pilihan ruang akan tampil setelah pengelola menambahkan ruangan aktif.</EmptyState>}
        <BusinessDialog open={Boolean(selected)} title={selected?.name ?? 'Detail ruangan'} onClose={() => setSelected(null)} footer={<a className="rt-button primary" href={destination}>{config.user ? 'Buka katalog ruangan' : 'Masuk untuk memesan'}<ArrowUpRight aria-hidden="true" /></a>}>
            {selected ? <><p className="rt-muted">{roomTypeLabel(selected.type)} · {selected.capacity} orang · {selected.location} · Lantai {selected.floor}</p>{selected.description ? <p>{selected.description}</p> : null}<div><h3>Fasilitas</h3><div className="rt-chip-list">{selected.facilities.length ? selected.facilities.map((facility) => <span className="rt-chip" key={facility.id}>{facility.name}</span>) : <span className="rt-muted">Belum ada fasilitas tercatat.</span>}</div></div><div><h3>Aturan penggunaan</h3><p style={{ whiteSpace: 'pre-line' }}>{selected.rules}</p></div><RoomPlan room={selected} /></> : null}
        </BusinessDialog>
    </div>;
}
