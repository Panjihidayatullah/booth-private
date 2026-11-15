import { useState } from 'react';
import { Building2, CalendarDays, ChevronRight, ClipboardList, Home, LayoutDashboard, LogOut, Settings2, ShieldCheck, Ticket, UserRound, Wrench } from 'lucide-react';
import Brand from '../components/Brand';
import NavigationDrawer from '../components/NavigationDrawer';
import WorkspaceOverview from '../features/reservations/WorkspaceOverview';
import CustomerRooms from '../features/reservations/CustomerRooms';
import CustomerBookings from '../features/reservations/CustomerBookings';
import AdminRooms from '../features/reservations/AdminRooms';
import AdminFacilities from '../features/reservations/AdminFacilities';
import AdminReservations from '../features/reservations/AdminReservations';
import AdminMaintenance from '../features/reservations/AdminMaintenance';
import AdminReports from '../features/reservations/AdminReports';
import CustomerProfile from '../features/account/CustomerProfile';
import MobileBottomNav, { type MobileNavItem } from '../components/MobileBottomNav';
import NotificationBell from '../components/NotificationBell';
import { describeRequestError, http } from '../lib/http';
import type { Account, AppConfig } from '../types/app';

interface WorkspacePageProps {
    config: AppConfig;
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'ruangtemu.workspace.sidebar-collapsed';

function getInitialSidebarState() {
    if (typeof window === 'undefined') return false;

    try {
        return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export default function WorkspacePage({ config }: WorkspacePageProps) {
    const isAdmin = config.portal === 'admin';
    const [currentUser, setCurrentUser] = useState<Account | null>(config.user);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarState);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [error, setError] = useState('');
    const menu = isAdmin ? [
        { key: 'home', label: 'Ringkasan', href: config.urls.admin.home, icon: LayoutDashboard },
        { key: 'rooms', label: 'Ruangan', href: config.urls.admin.rooms, icon: Building2 },
        { key: 'facilities', label: 'Fasilitas', href: config.urls.admin.facilities, icon: Settings2 },
        { key: 'reservations', label: 'Semua Reservasi', href: config.urls.admin.reservations, icon: CalendarDays },
        { key: 'maintenance', label: 'Pemeliharaan', href: config.urls.admin.maintenance, icon: Wrench },
        { key: 'reports', label: 'Laporan', href: config.urls.admin.reports, icon: ClipboardList },
    ] : [
        { key: 'home', label: 'Beranda', href: config.urls.customer.home, icon: Home },
        { key: 'rooms', label: 'Cari Ruangan', href: config.urls.customer.rooms, icon: Building2 },
        { key: 'bookings', label: 'Reservasi Saya', href: config.urls.customer.bookings, icon: Ticket },
        { key: 'account', label: 'Akun Saya', href: config.urls.customer.account, icon: UserRound },
    ];
    const current = menu.find((item) => item.key === config.section) ?? menu[0];
    const mobileNavItems: MobileNavItem[] = menu.map((item) => ({
        key: item.key,
        label: isAdmin
            ? item.key === 'reservations'
                ? 'Reservasi'
                : item.key === 'maintenance'
                ? 'Rawat'
                : item.label
            : item.key === 'rooms'
            ? 'Ruangan'
            : item.key === 'bookings'
            ? 'Reservasi'
            : item.key === 'account'
            ? 'Akun'
            : item.label,
        href: item.href,
        icon: item.icon,
        active: config.section === item.key,
    }));

    async function logout() {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        setError('');
        try {
            await http.post(config.urls.auth.logout);
            window.location.assign(config.urls.home);
        } catch (requestError) {
            setError(describeRequestError(requestError).message);
            setIsLoggingOut(false);
        }
    }

    function toggleSidebar() {
        setIsSidebarCollapsed((isCollapsed) => {
            const nextState = !isCollapsed;

            try {
                window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(nextState));
            } catch {
                // The sidebar still works when browser storage is unavailable.
            }

            return nextState;
        });
    }

    const logoutLabel = isLoggingOut ? 'Keluar...' : 'Sign out';
    const logoutButton = <button className="logout-button" type="button" onClick={logout} disabled={isLoggingOut} aria-label={logoutLabel}><LogOut aria-hidden="true" /><span className="logout-label">{logoutLabel}</span></button>;

    return (
        <div className="workspace-layout">
            <a className="skip-link" href="#workspace-content">Lewati ke konten utama</a>
            <aside className={`workspace-sidebar${isSidebarCollapsed ? ' is-collapsed' : ''}`}>
                <Brand href={config.urls.home} />
                <button
                    className="workspace-sidebar-toggle"
                    type="button"
                    onClick={toggleSidebar}
                    aria-label={isSidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar'}
                    aria-expanded={!isSidebarCollapsed}
                    aria-controls="workspace-navigation"
                    title={isSidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar'}
                >
                    <ChevronRight aria-hidden="true" />
                </button>
                <span className="sidebar-caption">{isAdmin ? 'Portal Admin' : 'Portal Penyewa'}</span>
                <nav id="workspace-navigation" aria-label="Navigasi sistem">
                    {menu.map((item) => { const Icon = item.icon; return <a key={item.key} href={item.href} aria-current={config.section === item.key ? 'page' : undefined} aria-label={item.label} title={isSidebarCollapsed ? item.label : undefined}><Icon aria-hidden="true" /><span className="sidebar-menu-label">{item.label}</span></a>; })}
                </nav>
                <div className="sidebar-account"><span className="account-avatar"><UserRound aria-hidden="true" /></span><div className="sidebar-account-details"><strong>{currentUser?.name}</strong><span>{isAdmin ? 'Administrator' : 'Penyewa'}</span></div></div>
                {logoutButton}
            </aside>
            <div className="workspace-body">
                <header className="workspace-header">
                    <div><span className="eyebrow">{isAdmin ? 'Portal Admin' : 'Portal Penyewa'}</span><h1>{current.label}</h1></div>
                    <div className="workspace-header-actions">
                        {!isAdmin ? <NotificationBell apiBaseUrl={config.apiBaseUrl} /> : null}
                        <a href={config.urls.home} className="icon-button" aria-label="Kembali ke Home"><Home aria-hidden="true" /></a>
                        {isAdmin ? (
                            <button
                                className="icon-button mobile-header-logout"
                                type="button"
                                onClick={logout}
                                disabled={isLoggingOut}
                                aria-label="Sign out"
                                title="Sign out"
                            >
                                <LogOut aria-hidden="true" />
                            </button>
                        ) : null}
                        <NavigationDrawer
                            variant="workspace"
                            title={<Brand href={config.urls.home} />}
                            caption={isAdmin ? 'Portal Admin' : 'Portal Penyewa'}
                            account={{ name: currentUser?.name ?? 'Akun', roleLabel: isAdmin ? 'Administrator' : 'Penyewa' }}
                            links={menu.map((item) => ({ href: item.href, label: item.label, active: item.key === config.section, icon: item.icon }))}
                            footer={logoutButton}
                        />
                    </div>
                </header>
                <main id="workspace-content" className="workspace-content">
                    {error ? <div className="form-alert" role="alert">{error}</div> : null}
                    {config.section === 'home' ? <WorkspaceOverview config={config} /> : config.section === 'account' ? (
                        <CustomerProfile
                            config={config}
                            user={currentUser}
                            onUserUpdated={setCurrentUser}
                            logoutButton={logoutButton}
                        />
                    ) : isAdmin ? config.section === 'rooms' ? <AdminRooms config={config} /> : config.section === 'facilities' ? <AdminFacilities config={config} /> : config.section === 'reservations' ? <AdminReservations config={config} /> : config.section === 'maintenance' ? <AdminMaintenance config={config} /> : <AdminReports config={config} /> : config.section === 'rooms' ? <CustomerRooms config={config} /> : <CustomerBookings config={config} />}
                    <p className="workspace-footer"><ShieldCheck aria-hidden="true" />{isAdmin ? 'Akses administrator' : 'Akun penyewa'} · RuangTemu</p>
                </main>
            </div>
            <MobileBottomNav
                items={mobileNavItems}
                ariaLabel={isAdmin ? 'Navigasi Admin Mobile' : 'Navigasi Penyewa Mobile'}
            />
        </div>
    );
}
