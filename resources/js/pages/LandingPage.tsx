import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, CalendarDays, LayoutDashboard, LogIn, Mic, ShieldCheck, TicketCheck, Users } from 'lucide-react';
import Brand from '../components/Brand';
import NavigationDrawer from '../components/NavigationDrawer';
import PublicRoomCatalog from '../features/reservations/PublicRoomCatalog';
import type { AppConfig } from '../types/app';

interface LandingPageProps {
    config: AppConfig;
}

const MAIN_NAVIGATION = [
    { href: '#home', label: 'Home' },
    { href: '#about', label: 'About' },
    { href: '#ruangan', label: 'Ruangan' },
    { href: '#cara-reservasi', label: 'Cara Reservasi' },
];

export default function LandingPage({ config }: LandingPageProps) {
    const accountUrl = config.user ? config.urls.dashboard : config.urls.login;
    const [isHeaderScrolled, setIsHeaderScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 24);

    useEffect(() => {
        const updateHeader = () => setIsHeaderScrolled(window.scrollY > 24);

        updateHeader();
        window.addEventListener('scroll', updateHeader, { passive: true });

        return () => {
            window.removeEventListener('scroll', updateHeader);
        };
    }, []);

    return (
        <div className="landing-page">
            <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
            <div className={`landing-header${isHeaderScrolled ? ' is-scrolled' : ''}`}>
                <div className="hero-navigation page-container">
                    <Brand href={config.urls.home} light={!isHeaderScrolled} />
                    <nav className="desktop-navigation" aria-label="Navigasi utama">
                        {MAIN_NAVIGATION.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
                    </nav>
                    <div className="hero-utilities">
                        <a className="icon-button icon-button-lime" href={accountUrl} aria-label={config.user ? 'Buka dashboard' : 'Sign in'} title={config.user ? 'Dashboard' : 'Sign in'}>
                            {config.user ? <LayoutDashboard aria-hidden="true" /> : <LogIn aria-hidden="true" />}
                        </a>
                        <NavigationDrawer links={MAIN_NAVIGATION} footer={<a className="button button-lime" href={accountUrl}>{config.user ? 'Buka Dashboard' : 'Sign in'}<ArrowUpRight aria-hidden="true" /></a>} />
                    </div>
                </div>
            </div>
            <header id="home" className="hero-frame">
                <img className="hero-background" src={config.heroImageUrl} alt="Area booth dengan sofa melengkung, meja bundar, dan kursi di dekat jendela" width="1170" height="780" fetchPriority="high" />
                <div className="hero-overlay" aria-hidden="true" />
                <div className="hero-content page-container">
                    <span className="tag-pill tag-pill-inverse">Ruang kerja & booth privat</span>
                    <h1>Ruang yang tepat.<br /><span>Untuk setiap ide.</span></h1>
                    <p>Tempat untuk fokus, bertemu, dan berkolaborasi. Rencanakan penggunaan ruang dengan cara yang lebih sederhana.</p>
                    <div className="hero-actions">
                        <a className="button button-lime" href="#ruangan">Temukan Ruangmu<ArrowUpRight aria-hidden="true" /></a>
                        <a className="hero-secondary-link" href="#cara-reservasi">Kenali Alurnya<ArrowDown aria-hidden="true" /></a>
                    </div>
                </div>
                <div className="hero-bottom page-container"><p>Ruang untuk bertemu. Waktu untuk fokus.</p><a href="#about" aria-label="Jelajahi RuangTemu"><ArrowDown aria-hidden="true" /></a></div>
            </header>

            <main id="main-content">
                <section id="about" className="content-section page-container" aria-labelledby="about-title">
                    <div className="split-section-heading">
                        <div><span className="tag-pill">Tentang RuangTemu</span><h2 id="about-title">Lebih dari sekadar ruang.<br /><span>Tempat rencana dimulai.</span></h2></div>
                        <p>Setiap aktivitas membutuhkan suasana yang berbeda. RuangTemu membantu mengenali pilihan ruang kerja dan booth privat, lalu merencanakan penggunaannya dalam satu alur.</p>
                    </div>
                    <div className="feature-grid">
                        <article className="feature-card"><span className="feature-icon"><Mic aria-hidden="true" /></span><span className="eyebrow">Untuk waktu fokusmu</span><h3>Booth Privat</h3><p>Kenali ruang untuk sesi kerja pribadi, panggilan daring, atau percakapan yang memerlukan suasana lebih tenang.</p><a href="#ruangan" className="text-link">Jelajahi Ruang<ArrowUpRight aria-hidden="true" /></a></article>
                        <article className="feature-card"><span className="feature-icon"><Users aria-hidden="true" /></span><span className="eyebrow">Untuk ide bersama</span><h3>Ruang Kerja Kolaborasi</h3><p>Temukan pilihan ruang untuk diskusi dan kerja bersama. Periksa kapasitas serta fasilitas sesuai informasi dari pengelola.</p><a href="#ruangan" className="text-link">Temukan Ruang Tim<ArrowUpRight aria-hidden="true" /></a></article>
                        <article className="feature-card feature-card-forest"><span className="feature-icon"><ShieldCheck aria-hidden="true" /></span><span className="eyebrow">Untuk rencana yang tertata</span><h3>Satu Alur Penggunaan</h3><p>Mulai dari mengenali ruang, menentukan jadwal, hingga mengikuti ketentuan penggunaan yang disiapkan pengelola.</p><a href="#cara-reservasi" className="text-link">Lihat Alurnya<ArrowUpRight aria-hidden="true" /></a></article>
                    </div>
                </section>

                <section id="ruangan" className="rooms-section section-frame" aria-labelledby="rooms-title">
                    <div className="page-container">
                        <div className="split-section-heading"><div><span className="tag-pill tag-pill-inverse">Pilihan ruang</span><h2 id="rooms-title">Temukan ruang.<br /><span>Sesuaikan dengan rencanamu.</span></h2></div><p>Informasi ruangan, kapasitas, serta fasilitas mengikuti data yang disiapkan oleh pengelola.</p></div>
                        <PublicRoomCatalog config={config} />
                    </div>
                </section>

                <section id="cara-reservasi" className="content-section page-container" aria-labelledby="workflow-title">
                    <div className="split-section-heading"><div><span className="tag-pill">Cara reservasi</span><h2 id="workflow-title">Dari rencana,<br /><span>menjadi pertemuan.</span></h2></div><p>Kenali alur pemesanan agar penggunaan ruang dapat direncanakan dengan lebih terarah.</p></div>
                    <ol className="workflow-grid">
                        <li><div className="workflow-top"><span>01</span><Users aria-hidden="true" /></div><h3>Pilih Ruangan</h3><p>Lihat detail ruang, kapasitas, dan fasilitas sesuai kebutuhanmu.</p></li>
                        <li><div className="workflow-top"><span>02</span><CalendarDays aria-hidden="true" /></div><h3>Tentukan Jadwal</h3><p>Sesuaikan tanggal dan waktu dengan rencana penggunaan serta ketersediaan ruang.</p></li>
                        <li><div className="workflow-top"><span>03</span><TicketCheck aria-hidden="true" /></div><h3>Kelola Reservasi</h3><p>Ikuti status reservasi dan ketentuan check-in serta check-out dari pengelola.</p></li>
                    </ol>
                </section>
            </main>

            <footer className="site-footer section-frame">
                <div className="page-container">
                    <div className="footer-intro"><div><span className="tag-pill tag-pill-inverse">Mulai bersama RuangTemu</span><h2>Rencana berikutnya,<br /><span>dimulai dari sini.</span></h2></div><a className="button button-lime" href={config.user ? config.urls.dashboard : config.urls.register}>{config.user ? 'Buka Dashboard' : 'Buat Akun'}<ArrowUpRight aria-hidden="true" /></a></div>
                    <div className="footer-bottom"><Brand href={config.urls.home} light /><p>Ruang untuk bertemu. Waktu untuk fokus.</p><nav aria-label="Navigasi footer"><a href="#home">Home</a><a href="#about">About</a><a href={accountUrl}>{config.user ? 'Dashboard' : 'Sign in'}</a></nav></div>
                </div>
            </footer>
        </div>
    );
}
