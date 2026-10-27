import { useEffect, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { Inbox, LoaderCircle, X } from 'lucide-react';
import { http, describeRequestError, type ValidationErrors } from '../../lib/http';
import type { AppConfig } from '../../types/app';
import '../../../css/reservations-admin.css';

export interface AdminFacility { id: number; name: string; description: string | null; }
export interface AdminRoom {
    id: number; name: string; type: 'workspace' | 'booth'; capacity: number;
    location: string; floor: string; rules: string; description: string | null;
    is_active: boolean; maintenance_notes: string | null; image_url: string | null;
    floor_plan: { width: number; depth: number; desks: number; door: 'top' | 'right' | 'bottom' | 'left' } | null;
    facilities: AdminFacility[];
}
export interface AdminReservation {
    id: number; code: string; user_id: number; room_id: number; purpose: string; attendees: number;
    starts_at: string; ends_at: string; status: 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';
    checked_in_at: string | null; checked_out_at: string | null; cancelled_at: string | null; no_show_at: string | null;
    room: AdminRoom; user?: { id: number; name: string; username?: string | null; email?: string | null };
    can_cancel: boolean; allowed_actions: string[];
}
export interface AdminMaintenance { id: number; room_id: number; room: AdminRoom; starts_at: string; ends_at: string; reason: string; }

export const api = (config: AppConfig, path: string) => `${config.apiBaseUrl.replace(/\/$/, '')}${path}`;
export const todayWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const formatDate = (value: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium' }).format(new Date(value));
export const formatTime = (value: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
export const formatDateTime = (value: string | null) => value ? `${formatDate(value)}, ${formatTime(value)} WIB` : 'Belum tercatat';
export const formatNumber = (value: number, digits = 1) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(Number(value) || 0);
export const statusLabels: Record<AdminReservation['status'], string> = { confirmed: 'Terkonfirmasi', checked_in: 'Sedang digunakan', completed: 'Selesai', cancelled: 'Dibatalkan', no_show: 'Tidak hadir' };

export function adminError(error: unknown): { message: string; errors: ValidationErrors } {
    const described = describeRequestError(error);
    if (axios.isAxiosError<{ message?: string; errors?: ValidationErrors }>(error) && error.response) {
        const errors = error.response.data?.errors ?? {};
        const first = Object.values(errors).flat()[0];
        if (first) return { message: first, errors };
        if ([400, 403, 404, 409, 422].includes(error.response.status) && error.response.data?.message) return { message: error.response.data.message, errors };
    }
    return described;
}

export function useAdminResource<T>(config: AppConfig, path: string, params: Record<string, string | number> = {}, refreshMs = 0, enabled = true) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const paramKey = JSON.stringify(params);
    const queryKey = `${config.apiBaseUrl}|${path}|${paramKey}`;
    const activeQuery = useRef<string | null>(null);
    const dataQuery = useRef<string | null>(null);
    const settledQuery = useRef<string | null>(null);
    activeQuery.current = enabled ? queryKey : null;
    useEffect(() => {
        const controller = new AbortController();
        if (!enabled) { setLoading(false); return () => controller.abort(); }
        const isCurrent = () => !controller.signal.aborted && activeQuery.current === queryKey;
        setLoading(true);
        setError('');
        http.get<{ data: T }>(api(config, path), { params: JSON.parse(paramKey), signal: controller.signal })
            .then(response => { if (isCurrent()) { dataQuery.current = queryKey; setData(response.data.data); } })
            .catch(reason => { if (isCurrent()) setError(adminError(reason).message); })
            .finally(() => { if (isCurrent()) { settledQuery.current = queryKey; setLoading(false); } });
        return () => controller.abort();
    }, [config.apiBaseUrl, path, paramKey, queryKey, revision, enabled]);
    useEffect(() => {
        if (!refreshMs || !enabled) return;
        const timer = window.setInterval(() => setRevision(value => value + 1), refreshMs);
        return () => window.clearInterval(timer);
    }, [refreshMs, enabled]);
    return {
        data: enabled && dataQuery.current === queryKey ? data : null,
        loading: enabled && (loading || settledQuery.current !== queryKey),
        error: enabled && settledQuery.current === queryKey ? error : '',
        setData,
        refresh: () => setRevision(value => value + 1),
    };
}

export function AdminDialog({ title, children, footer, onClose, busy = false, wide = false }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (dialog && !dialog.open) dialog.showModal();
        return () => dialog?.close();
    }, []);
    return <dialog ref={ref} className={`rt-dialog rta-dialog${wide ? ' rta-dialog-wide' : ''}`} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }} aria-labelledby="admin-dialog-title">
        <div className="rt-dialog-content rta-dialog-content">
            <div className="rt-dialog-header"><div><span className="rt-eyebrow">Portal admin</span><h2 id="admin-dialog-title">{title}</h2></div><button type="button" className="rta-icon-button" aria-label="Tutup dialog" onClick={onClose} disabled={busy} autoFocus><X /></button></div>
            <div className="rt-dialog-body">{children}</div>
            {footer ? <div className="rt-dialog-footer">{footer}</div> : null}
        </div>
    </dialog>;
}

export function ConfirmDialog({ title, children, onClose, onConfirm, busy = false, label = 'Konfirmasi', danger = false }: { title: string; children: ReactNode; onClose: () => void; onConfirm: () => void; busy?: boolean; label?: string; danger?: boolean }) {
    return <AdminDialog title={title} onClose={onClose} busy={busy} footer={<><button className="rt-button secondary" type="button" onClick={onClose} disabled={busy}>Batal</button><button className={`rt-button ${danger ? 'danger' : 'primary'}`} type="button" onClick={onConfirm} disabled={busy}>{busy ? <LoaderCircle className="loading-icon" /> : null}{busy ? 'Memproses...' : label}</button></>}><div className="rta-confirm-copy">{children}</div></AdminDialog>;
}

export function Field({ label, htmlFor, error, children, full = false }: { label: string; htmlFor: string; error?: string; children: ReactNode; full?: boolean }) {
    return <div className={`rt-field${full ? ' rta-span-2' : ''}`}><label htmlFor={htmlFor}>{label}</label>{children}{error ? <p className="field-error" role="alert">{error}</p> : null}</div>;
}
export const Feedback = ({ error, success }: { error?: string; success?: string }) => <>{error ? <div className="rt-alert error" role="alert">{error}</div> : null}{success ? <div className="rt-alert success" role="status">{success}</div> : null}</>;
export const Loading = () => <div className="rt-loading" role="status"><LoaderCircle className="loading-icon" />Memuat data...</div>;
export const Empty = ({ title, children }: { title: string; children: ReactNode }) => <div className="rt-empty"><Inbox /><h3>{title}</h3><p>{children}</p></div>;
export const StatusBadge = ({ status }: { status: AdminReservation['status'] }) => <span className={`rt-badge ${status}`}>{statusLabels[status]}</span>;
