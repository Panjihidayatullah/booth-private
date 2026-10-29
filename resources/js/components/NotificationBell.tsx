import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Calendar, Check, CheckCheck, Clock, LogIn, LogOut, Ticket, X, XCircle } from 'lucide-react';
import { http } from '../lib/http';

export interface AppNotification {
    id: string;
    data: {
        reservation_id?: number;
        code?: string;
        room_name?: string;
        room_type?: string;
        action?: string;
        title?: string;
        message?: string;
        starts_at?: string;
        ends_at?: string;
    };
    read_at: string | null;
    created_at: string;
}

function timeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Baru saja';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari yang lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function NotificationIcon({ action }: { action?: string }) {
    switch (action) {
        case 'created':
            return <span className="rt-notif-badge-icon is-created"><Ticket aria-hidden="true" /></span>;
        case 'check_in':
            return <span className="rt-notif-badge-icon is-checkin"><LogIn aria-hidden="true" /></span>;
        case 'check_out':
            return <span className="rt-notif-badge-icon is-checkout"><LogOut aria-hidden="true" /></span>;
        case 'cancelled':
            return <span className="rt-notif-badge-icon is-cancelled"><XCircle aria-hidden="true" /></span>;
        case 'no_show':
            return <span className="rt-notif-badge-icon is-noshow"><AlertTriangle aria-hidden="true" /></span>;
        default:
            return <span className="rt-notif-badge-icon is-default"><Bell aria-hidden="true" /></span>;
    }
}

export default function NotificationBell({ apiBaseUrl }: { apiBaseUrl: string }) {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    async function fetchNotifications() {
        try {
            const { data } = await http.get<{ data: AppNotification[]; unread_count: number }>(
                `${apiBaseUrl.replace(/\/$/, '')}/customer/notifications`
            );
            setNotifications(data.data);
            setUnreadCount(data.unread_count);
        } catch {
            // Silently ignore if unauthenticated or offline
        }
    }

    useEffect(() => {
        fetchNotifications();
        const interval = window.setInterval(fetchNotifications, 30000);
        return () => window.clearInterval(interval);
    }, [apiBaseUrl]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    async function markAsRead(id: string) {
        try {
            await http.post(`${apiBaseUrl.replace(/\/$/, '')}/customer/notifications/${id}/read`);
            setNotifications(prev =>
                prev.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {
            // ignore
        }
    }

    async function markAllAsRead() {
        if (unreadCount === 0 || loading) return;
        setLoading(true);
        try {
            await http.post(`${apiBaseUrl.replace(/\/$/, '')}/customer/notifications/read-all`);
            setNotifications(prev =>
                prev.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() }))
            );
            setUnreadCount(0);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="rt-notif-wrapper" ref={dropdownRef}>
            <button
                type="button"
                className="icon-button rt-notif-button"
                aria-label={unreadCount > 0 ? `${unreadCount} notifikasi belum dibaca` : 'Notifikasi'}
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                <Bell aria-hidden="true" />
                {unreadCount > 0 ? (
                    <span className="rt-notif-counter" aria-hidden="true">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                ) : null}
            </button>

            {open ? (
                <div className="rt-notif-dropdown" role="dialog" aria-label="Daftar Notifikasi">
                    <div className="rt-notif-header">
                        <div className="rt-notif-header-title">
                            <h3>Notifikasi</h3>
                            {unreadCount > 0 ? (
                                <span className="rt-notif-unread-tag">{unreadCount} baru</span>
                            ) : null}
                        </div>
                        <div className="rt-notif-header-actions">
                            {unreadCount > 0 ? (
                                <button
                                    type="button"
                                    className="rt-notif-mark-btn"
                                    onClick={markAllAsRead}
                                    disabled={loading}
                                    title="Tandai semua dibaca"
                                >
                                    <CheckCheck aria-hidden="true" />
                                    <span>Tandai dibaca</span>
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="rt-notif-close-btn"
                                onClick={() => setOpen(false)}
                                aria-label="Tutup notifikasi"
                            >
                                <X aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    <div className="rt-notif-body">
                        {notifications.length === 0 ? (
                            <div className="rt-notif-empty">
                                <span className="rt-notif-empty-icon"><Bell aria-hidden="true" /></span>
                                <p><strong>Belum ada notifikasi</strong></p>
                                <small>Pembaruan status reservasi dan kehadiran akan tampil di sini.</small>
                            </div>
                        ) : (
                            <ul className="rt-notif-list">
                                {notifications.map(item => {
                                    const isUnread = !item.read_at;
                                    return (
                                        <li
                                            key={item.id}
                                            className={`rt-notif-item ${isUnread ? 'is-unread' : ''}`}
                                            onClick={() => {
                                                if (isUnread) markAsRead(item.id);
                                            }}
                                            tabIndex={0}
                                            role="button"
                                        >
                                            <NotificationIcon action={item.data.action} />
                                            <div className="rt-notif-content">
                                                <div className="rt-notif-top-line">
                                                    <span className="rt-notif-item-title">{item.data.title || 'Pemberitahuan'}</span>
                                                    <span className="rt-notif-time">{timeAgo(item.created_at)}</span>
                                                </div>
                                                <p className="rt-notif-message">{item.data.message}</p>
                                                {item.data.code ? (
                                                    <span className="rt-notif-code-badge">{item.data.code}</span>
                                                ) : null}
                                            </div>
                                            {isUnread ? (
                                                <span className="rt-notif-dot" title="Belum dibaca" aria-hidden="true" />
                                            ) : null}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
