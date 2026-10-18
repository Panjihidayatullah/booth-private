import { useState } from 'react';
import { ArrowUpRight, Building2, CalendarDays, ClipboardList, Home, LayoutDashboard, LogOut, Settings2, ShieldCheck, Ticket, UserRound, Wrench } from 'lucide-react';
import Brand from '../components/Brand';
import NavigationDrawer from '../components/NavigationDrawer';
import { describeRequestError, http } from '../lib/http';
import type { AppConfig } from '../types/app';

interface WorkspacePageProps {
    config: AppConfig;
}

export default function WorkspacePage({ config }: WorkspacePageProps) {
    const isAdmin = config.portal === 'admin';
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
    const CurrentIcon = current.icon;

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

    const logoutButton = <button className="logout-button" type="button" onClick={logout} disabled={isLoggingOut}><LogOut aria-hidden="true" />{isLoggingOut ? 'Keluar...' : 'Sign out'}</button>;

    return (
        <div className="workspace-layout">
            <a className="skip-link" href="#workspace-content">Lewati ke konten utama</a>
            <aside className="workspace-sidebar">
                <Brand href={config.urls.home} />
                <span className="sidebar-caption">{isAdmin ? 'Portal Admin' : 'Portal Pelanggan'}</span>
                <nav aria-label="Navigasi sistem">
                    {menu.map((item) => { const Icon = item.icon; return <a key={item.key} href={item.href} aria-current={config.section === item.key ? 'page' : undefined}><Icon aria-hidden="true" />{item.label}</a>; })}
                </nav>
                <div className="sidebar-account"><span className="account-avatar"><UserRound aria-hidden="true" /></span><div><strong>{config.user?.name}</strong><span>{isAdmin ? 'Administrator' : 'Pelanggan'}</span></div></div>
                {logoutButton}
            </aside>
            <div className="workspace-body">
                <header className="workspace-header">
                    <div><span className="eyebrow">{isAdmin ? 'Portal Admin' : 'Portal Pelanggan'}</span><h1>{current.label}</h1></div>
                    <div className="workspace-header-actions"><a href={config.urls.home} className="icon-button" aria-label="Kembali ke Home"><Home aria-hidden="true" /></a><NavigationDrawer links={menu.map((item) => ({ href: item.href, label: item.label, active: item.key === config.section }))} footer={logoutButton} /></div>
                </header>
                <main id="workspace-content" className="workspace-content">
                    {error ? <div className="form-alert" role="alert">{error}</div> : null}
                    {config.section === 'home' ? (
                        <>
                            <section className="workspace-welcome">
                                <span className="tag-pill tag-pill-inverse">{isAdmin ? 'Kelola dengan lebih terarah' : 'Rencanakan ruangmu'}</span>
                                <h2>Halo, {config.user?.name}.</h2>
                                <p>{isAdmin ? 'Satu tempat untuk mengatur ruangan, fasilitas, dan penggunaan ruang.' : 'Temukan ruang yang sesuai, lalu kelola rencana penggunaanmu di sini.'}</p>
                                <a className="button button-lime" href={isAdmin ? config.urls.admin.rooms : config.urls.customer.rooms}>{isAdmin ? 'Lihat Ruangan' : 'Cari Ruangan'}<ArrowUpRight aria-hidden="true" /></a>
                            </section>
                            <div className="workspace-shortcuts">
                                {menu.filter((item) => !['home', 'account'].includes(item.key)).slice(0, 3).map((item) => { const Icon = item.icon; return <a href={item.href} key={item.key}><span className="shortcut-icon"><Icon aria-hidden="true" /></span><h3>{item.label}</h3><span>Buka halaman<ArrowUpRight aria-hidden="true" /></span></a>; })}
                            </div>
                        </>
                    ) : config.section === 'account' ? (
                        <section className="profile-panel" aria-labelledby="profile-title">
                            <span className="auth-icon"><UserRound aria-hidden="true" /></span><h2 id="profile-title">Informasi akunmu</h2>
                            <dl><div><dt>Nama lengkap</dt><dd>{config.user?.name}</dd></div><div><dt>Username</dt><dd>{config.user?.username ?? 'Belum diisi'}</dd></div><div><dt>Alamat email</dt><dd>{config.user?.email ?? 'Belum diisi'}</dd></div><div><dt>Jenis akun</dt><dd>{config.user?.role === 'admin' ? 'Administrator' : 'Pelanggan'}</dd></div></dl>
                            {logoutButton}
                        </section>
                    ) : (
                        <section className="workspace-empty" aria-labelledby="workspace-empty-title">
                            <span className="empty-icon"><CurrentIcon aria-hidden="true" /></span>
                            <span className="tag-pill">{current.label}</span>
                            <h2 id="workspace-empty-title">{config.section === 'rooms' ? 'Ruang berikutnya dimulai di sini.' : `Data ${current.label.toLowerCase()} belum tersedia.`}</h2>
                            <p>{isAdmin ? 'Halaman pengelolaan ini sudah disiapkan. Pengolahan data ruangan, fasilitas, reservasi, dan laporan belum diaktifkan.' : 'Informasi ruang dan reservasi akan tersedia setelah pengelola menyiapkan layanan pemesanan.'}</p>
                            {config.section === 'rooms' && !isAdmin ? <div className="booking-flow-note"><span>Pilih ruang</span><ArrowUpRight aria-hidden="true" /><span>Tentukan jadwal</span><ArrowUpRight aria-hidden="true" /><span>Konfirmasi reservasi</span></div> : null}
                            <a href={isAdmin ? config.urls.admin.home : config.urls.customer.home} className="button button-outline">Kembali ke Beranda<ArrowUpRight aria-hidden="true" /></a>
                        </section>
                    )}
                    <p className="workspace-footer"><ShieldCheck aria-hidden="true" />{isAdmin ? 'Akses administrator' : 'Akun pelanggan'} · RuangTemu</p>
                </main>
            </div>
        </div>
    );
}
