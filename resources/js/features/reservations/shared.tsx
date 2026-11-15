import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { ArrowUpRight, Building2, CalendarDays, Clock3, DoorOpen, Download, Info, LoaderCircle, MapPin, Ticket, Users, X } from 'lucide-react';
import { http, type ValidationErrors } from '../../lib/http';
import type { Reservation, ReservationStatus, Room } from './types';
import '../../../css/reservations-customer.css';

const TIME_ZONE = 'Asia/Jakarta';

export function todayInJakarta() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')}`;
}

export function formatDate(value: string) {
    const date = new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value);
    return Number.isNaN(date.getTime()) ? 'Tanggal belum tersedia' : new Intl.DateTimeFormat('id-ID', { timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function formatTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replace('.', ':');
}

export function formatDateTime(value: string) {
    return `${formatDate(value)}, ${formatTime(value)} WIB`;
}

export const roomTypeLabel = (type: Room['type']) => type === 'booth' ? 'Booth Privat' : 'Ruang Kerja';

export const STATUS_LABELS: Record<ReservationStatus, string> = {
    confirmed: 'Terkonfirmasi', checked_in: 'Sedang digunakan', completed: 'Selesai', cancelled: 'Dibatalkan', no_show: 'Tidak hadir',
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
    return <span className={`rt-badge rt-status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function FieldError({ errors, field }: { errors: ValidationErrors; field: string }) {
    return errors[field]?.[0] ? <span className="rt-field-error" role="alert">{errors[field][0]}</span> : null;
}

export function ErrorNotice({ message, errors }: { message: string; errors?: ValidationErrors }) {
    if (!message) return null;
    const details = errors ? [...new Set(Object.values(errors).flat())] : [];
    return <div className="rt-alert" role="alert"><Info aria-hidden="true" /><div><p>{message}</p>{details.length > 0 ? <ul>{details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}</div></div>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
    return <div className="rt-empty"><span className="rt-empty-symbol"><Building2 aria-hidden="true" /></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function LoadingState({ children = 'Memuat data...' }: { children?: ReactNode }) {
    return <div className="rt-loading" role="status"><LoaderCircle aria-hidden="true" className="loading-icon" /><span>{children}</span></div>;
}

export function BusinessDialog({ open, title, children, footer, onClose, closeDisabled = false, className = '' }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; closeDisabled?: boolean; className?: string }) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog || !open) return;
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (!dialog.open) dialog.showModal();
        document.body.classList.add('rt-dialog-open');
        return () => {
            document.body.classList.remove('rt-dialog-open');
            if (dialog.open) dialog.close();
            active?.focus({ preventScroll: true });
        };
    }, [open]);
    if (!open) return null;
    return <dialog ref={ref} className={`rt-dialog ${className}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!closeDisabled) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !closeDisabled) onClose(); }}>
        <div className="rt-dialog-content"><div className="rt-dialog-header"><h2 id={titleId}>{title}</h2><button className="rt-icon-button" type="button" onClick={onClose} disabled={closeDisabled} aria-label="Tutup dialog"><X aria-hidden="true" /></button></div><div className="rt-dialog-body">{children}</div>{footer ? <div className="rt-dialog-footer">{footer}</div> : null}</div>
    </dialog>;
}

export function RoomPlan({ room }: { room: Room }) {
    const plan = room.floor_plan;
    if (!plan) return <p className="rt-muted">Denah ruangan belum tersedia.</p>;
    const width = Math.max(1, Math.min(100, Number(plan.width) || 1));
    const depth = Math.max(1, Math.min(100, Number(plan.depth) || 1));
    const desks = Math.max(0, Math.min(100, Math.floor(Number(plan.desks) || 0)));
    const columns = Math.max(1, Math.ceil(Math.sqrt(desks * (width / depth))));
    const rows = Math.max(1, Math.ceil(desks / columns));
    const horizontalGap = 240 / columns;
    const verticalGap = 140 / rows;
    return <figure className="rt-floor-plan"><svg viewBox="0 0 320 240" role="img" aria-label={`Denah skematik ${room.name}, ukuran ${width} kali ${depth} meter, ${desks} meja, pintu di sisi ${plan.door}`}>
        <rect x="22" y="28" width="276" height="180" rx="8" fill="#f7f7f5" stroke="#6c7971" strokeWidth="2" />
        <text x="160" y="18" textAnchor="middle" fill="#6c7971" fontSize="10">{width} m</text><text x="310" y="118" textAnchor="middle" fill="#6c7971" fontSize="10" transform="rotate(90 310 118)">{depth} m</text>
        {Array.from({ length: desks }, (_, i) => { const x = 40 + (i % columns) * horizontalGap + horizontalGap / 2; const y = 48 + Math.floor(i / columns) * verticalGap + verticalGap / 2; return <g key={i}><rect x={x - Math.min(22, horizontalGap * .3)} y={y - Math.min(12, verticalGap * .25)} width={Math.min(44, horizontalGap * .6)} height={Math.min(24, verticalGap * .5)} rx="4" fill="#a3e615" stroke="#7da72c" strokeWidth="1" /><circle cx={x} cy={y + Math.min(19, verticalGap * .38)} r={Math.min(5, verticalGap * .12)} fill="#1c362b" /></g>; })}
        {plan.door === 'top' ? <path d="M138 28h44" stroke="white" strokeWidth="6" /> : plan.door === 'bottom' ? <path d="M138 208h44" stroke="white" strokeWidth="6" /> : plan.door === 'left' ? <path d="M22 96v44" stroke="white" strokeWidth="6" /> : <path d="M298 96v44" stroke="white" strokeWidth="6" />}
        <text x="160" y="231" textAnchor="middle" fill="#6c7971" fontSize="10">Denah skematik · meja dan akses pintu</text>
    </svg><figcaption><DoorOpen aria-hidden="true" />{width} × {depth} m · {desks} meja · kapasitas {room.capacity} orang</figcaption></figure>;
}

export function RoomCard({ room, onDetail, onBook }: { room: Room; onDetail: (room: Room) => void; onBook?: (room: Room) => void }) {
    return <article className="rt-room-card rt-card"><div className={`rt-room-visual ${room.type === 'booth' ? 'is-booth' : ''}`}>
        {room.image_url ? <img src={room.image_url} alt={room.name} loading="lazy" /> : <Building2 aria-hidden="true" />}
        <span className="rt-room-type">{roomTypeLabel(room.type)}</span><span className="rt-room-capacity"><Users aria-hidden="true" />{room.capacity} orang</span>
    </div><div className="rt-room-body"><div><h3>{room.name}</h3><p className="rt-room-location"><MapPin aria-hidden="true" />{room.location} · Lantai {room.floor}</p></div><p className="rt-room-description">{room.description || 'Ruang untuk rencana dan kegiatanmu.'}</p><div className="rt-chip-list">{room.facilities.slice(0, 4).map((facility) => <span className="rt-chip" key={facility.id}>{facility.name}</span>)}{room.facilities.length > 4 ? <span className="rt-chip">+{room.facilities.length - 4} lainnya</span> : null}</div><div className="rt-room-actions"><button className="rt-button secondary" type="button" onClick={() => onDetail(room)}>Lihat detail</button>{onBook ? <button className="rt-button primary" type="button" onClick={() => onBook(room)}>Pesan<ArrowUpRight aria-hidden="true" /></button> : null}</div></div></article>;
}

export function ReservationTicket({ reservation, apiBaseUrl }: { reservation: Reservation; apiBaseUrl: string }) {
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState('');
    const downloadRequest = useRef<AbortController | null>(null);

    useEffect(() => () => downloadRequest.current?.abort(), []);

    async function downloadTicket() {
        if (downloadRequest.current) return;
        const controller = new AbortController();
        downloadRequest.current = controller;
        setDownloading(true);
        setDownloadError('');
        try {
            const response = await http.get<Blob>(`${apiBaseUrl.replace(/\/$/, '')}/customer/reservations/${reservation.id}/ticket`, { responseType: 'blob', timeout: 30000, signal: controller.signal });
            const isPdf = String(response.headers['content-type']).toLowerCase().includes('application/pdf') && await response.data.slice(0, 5).text() === '%PDF-';
            if (controller.signal.aborted) return;
            if (!isPdf) throw new Error('Invalid PDF response');
            const url = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tiket-${reservation.code.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
            link.hidden = true;
            document.body.append(link);
            try { link.click(); } finally {
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            setDownloadError(status === 401 || status === 419 ? 'Sesi kamu sudah berakhir. Masuk kembali untuk mengunduh tiket.' : status === 403 || status === 404 ? 'Tiket tidak ditemukan atau tidak dapat diakses.' : 'PDF belum berhasil diunduh. Silakan coba lagi.');
        } finally {
            if (downloadRequest.current === controller) downloadRequest.current = null;
            if (!controller.signal.aborted) setDownloading(false);
        }
    }
    return <section className="rt-ticket" aria-label={`Tiket reservasi ${reservation.code}`}><div className="rt-ticket-top"><span className="rt-ticket-icon"><Ticket aria-hidden="true" /></span><div><span className="rt-eyebrow">Tiket reservasi RuangTemu</span><strong className="rt-ticket-code">{reservation.code}</strong></div><StatusBadge status={reservation.status} /></div><h3>{reservation.room.name}</h3><p className="rt-muted">{roomTypeLabel(reservation.room.type)} · {reservation.room.location} · Lantai {reservation.room.floor}</p><dl className="rt-ticket-details"><div><dt><CalendarDays aria-hidden="true" />Tanggal</dt><dd>{formatDate(reservation.starts_at)}</dd></div><div><dt><Clock3 aria-hidden="true" />Waktu</dt><dd>{formatTime(reservation.starts_at)}–{formatTime(reservation.ends_at)} WIB</dd></div><div><dt><Users aria-hidden="true" />Jumlah orang</dt><dd>{reservation.attendees} orang</dd></div><div><dt>Penyewa</dt><dd>{reservation.user?.name || 'Akun penyewa'}</dd></div><div className="rt-ticket-purpose"><dt>Keperluan</dt><dd>{reservation.purpose}</dd></div></dl><div className="rt-ticket-note"><Info aria-hidden="true" /><p>Tunjukkan kode tiket kepada petugas saat datang. Pembayaran dilakukan langsung di lokasi. Kehadiran dicatat oleh petugas; keterlambatan lebih dari 15 menit dapat ditandai Tidak Hadir.</p></div><button className="rt-button secondary rt-ticket-download" type="button" onClick={downloadTicket} disabled={downloading} aria-busy={downloading}>{downloading ? <LoaderCircle className="loading-icon" aria-hidden="true" /> : <Download aria-hidden="true" />}{downloading ? 'Menyiapkan PDF...' : 'Unduh PDF'}</button><ErrorNotice message={downloadError} /></section>;
}
