import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import type { NavigationLink } from '../types/app';

const DESKTOP_NAVIGATION_QUERY = '(min-width: 1024px)';

interface NavigationDrawerProps {
    links: NavigationLink[];
    footer?: ReactNode;
}

export default function NavigationDrawer({ links, footer }: NavigationDrawerProps) {
    const menuRef = useRef<HTMLDialogElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const desktop = window.matchMedia(DESKTOP_NAVIGATION_QUERY);
        const closeOnDesktop = (event: MediaQueryListEvent) => {
            if (event.matches) menuRef.current?.close();
        };
        desktop.addEventListener('change', closeOnDesktop);
        return () => desktop.removeEventListener('change', closeOnDesktop);
    }, []);

    useEffect(() => {
        document.body.classList.toggle('is-menu-open', isOpen);
        return () => document.body.classList.remove('is-menu-open');
    }, [isOpen]);

    function openMenu() {
        if (menuRef.current && !menuRef.current.open) {
            menuRef.current.showModal();
            setIsOpen(true);
        }
    }

    function closeMenu() {
        menuRef.current?.close();
    }

    function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
        if (event.target === event.currentTarget) closeMenu();
    }

    return (
        <>
            <button className="icon-button mobile-menu-toggle" type="button" onClick={openMenu} aria-label="Buka menu navigasi" aria-expanded={isOpen} aria-controls="mobile-navigation" aria-haspopup="dialog">
                <Menu aria-hidden="true" />
            </button>
            <dialog ref={menuRef} id="mobile-navigation" className="navigation-dialog" aria-labelledby="mobile-navigation-title" onClose={() => setIsOpen(false)} onClick={handleBackdropClick}>
                <div className="navigation-dialog-content">
                    <div className="navigation-dialog-header">
                        <span id="mobile-navigation-title">RuangTemu</span>
                        <button className="icon-button" type="button" onClick={closeMenu} aria-label="Tutup menu navigasi" autoFocus><X aria-hidden="true" /></button>
                    </div>
                    <span className="eyebrow">Menu utama</span>
                    <nav aria-label="Navigasi mobile">
                        {links.map((link) => (
                            <a href={link.href} key={link.href} onClick={closeMenu} aria-current={link.active ? 'page' : undefined}>{link.label}<ArrowUpRight aria-hidden="true" /></a>
                        ))}
                    </nav>
                    <div className="navigation-dialog-footer">{footer ?? <p>Ruang untuk bertemu. Waktu untuk fokus.</p>}</div>
                </div>
            </dialog>
        </>
    );
}
