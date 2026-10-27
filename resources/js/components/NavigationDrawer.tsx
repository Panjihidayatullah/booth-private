import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react';
import { ArrowUpRight, Menu, UserRound, X, type LucideIcon } from 'lucide-react';
import type { NavigationLink } from '../types/app';

const DESKTOP_NAVIGATION_QUERY = '(min-width: 1024px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DRAWER_TRANSITION_MS = 320;

interface DrawerNavigationLink extends NavigationLink {
    icon?: LucideIcon;
}

interface NavigationDrawerProps {
    links: DrawerNavigationLink[];
    footer?: ReactNode;
    variant?: 'default' | 'workspace';
    title?: ReactNode;
    caption?: string;
    account?: { name: string; roleLabel: string };
}

export default function NavigationDrawer({ links, footer, variant = 'default', title, caption, account }: NavigationDrawerProps) {
    const menuRef = useRef<HTMLDialogElement>(null);
    const closeTimerRef = useRef<number | null>(null);
    const openFrameRef = useRef<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const desktop = window.matchMedia(DESKTOP_NAVIGATION_QUERY);
        const closeOnDesktop = (event: MediaQueryListEvent) => {
            if (event.matches) finishClose();
        };
        desktop.addEventListener('change', closeOnDesktop);
        return () => {
            desktop.removeEventListener('change', closeOnDesktop);
            clearPendingAnimation();
        };
    }, []);

    useEffect(() => {
        document.body.classList.toggle('is-menu-open', isOpen);
        return () => document.body.classList.remove('is-menu-open');
    }, [isOpen]);

    function openMenu() {
        if (menuRef.current && !menuRef.current.open) {
            clearPendingAnimation();
            setIsVisible(false);
            menuRef.current.showModal();
            setIsOpen(true);
            openFrameRef.current = window.requestAnimationFrame(() => {
                openFrameRef.current = null;
                if (menuRef.current?.open) setIsVisible(true);
            });
        }
    }

    function closeMenu() {
        if (!menuRef.current?.open) return;

        clearPendingAnimation();
        setIsVisible(false);

        if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
            finishClose();
            return;
        }

        closeTimerRef.current = window.setTimeout(finishClose, DRAWER_TRANSITION_MS);
    }

    function finishClose() {
        clearPendingAnimation();
        menuRef.current?.close();
    }

    function clearPendingAnimation() {
        if (openFrameRef.current !== null) {
            window.cancelAnimationFrame(openFrameRef.current);
            openFrameRef.current = null;
        }
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }

    function handleClosed() {
        clearPendingAnimation();
        setIsVisible(false);
        setIsOpen(false);
    }

    function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
        event.preventDefault();
        closeMenu();
    }

    function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
        if (event.target === event.currentTarget) closeMenu();
    }

    const isWorkspace = variant === 'workspace';

    return (
        <>
            <button className="icon-button mobile-menu-toggle" type="button" onClick={openMenu} aria-label="Buka menu navigasi" aria-expanded={isOpen} aria-controls="mobile-navigation" aria-haspopup="dialog">
                <Menu aria-hidden="true" />
            </button>
            <dialog ref={menuRef} id="mobile-navigation" className={`navigation-dialog${isWorkspace ? ' navigation-dialog-workspace' : ''}${isVisible ? ' is-visible' : ''}`} aria-labelledby="mobile-navigation-title" onCancel={handleCancel} onClose={handleClosed} onClick={handleBackdropClick}>
                <div className="navigation-dialog-content">
                    <div className="navigation-dialog-header">
                        <div id="mobile-navigation-title" className="navigation-dialog-title">{title ?? 'RuangTemu'}</div>
                        <button className="icon-button" type="button" onClick={closeMenu} aria-label="Tutup menu navigasi" autoFocus><X aria-hidden="true" /></button>
                    </div>
                    <span className={isWorkspace ? 'workspace-drawer-caption' : 'eyebrow'}>{caption ?? 'Menu utama'}</span>
                    <nav className={isWorkspace ? 'workspace-drawer-navigation' : undefined} aria-label="Navigasi mobile">
                        {links.map((link) => {
                            const Icon = link.icon;
                            return (
                                <a href={link.href} key={link.href} onClick={closeMenu} aria-current={link.active ? 'page' : undefined}>
                                    {isWorkspace && Icon ? <Icon aria-hidden="true" /> : null}
                                    <span>{link.label}</span>
                                    {isWorkspace ? null : <ArrowUpRight aria-hidden="true" />}
                                </a>
                            );
                        })}
                    </nav>
                    <div className={`navigation-dialog-footer${isWorkspace ? ' workspace-drawer-footer' : ''}`}>
                        {isWorkspace && account ? (
                            <div className="workspace-drawer-account">
                                <span className="account-avatar"><UserRound aria-hidden="true" /></span>
                                <div><strong>{account.name}</strong><span>{account.roleLabel}</span></div>
                            </div>
                        ) : null}
                        {footer ?? <p>Ruang untuk bertemu. Waktu untuk fokus.</p>}
                    </div>
                </div>
            </dialog>
        </>
    );
}
