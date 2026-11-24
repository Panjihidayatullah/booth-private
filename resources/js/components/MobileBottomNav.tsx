import type { ElementType } from 'react';

export interface MobileNavItem {
    key: string;
    label: string;
    href: string;
    icon: ElementType;
    active?: boolean;
    badgeCount?: number;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

interface MobileBottomNavProps {
    items: MobileNavItem[];
    ariaLabel?: string;
}

export default function MobileBottomNav({ items, ariaLabel }: MobileBottomNavProps) {
    if (!items || items.length === 0) return null;

    return (
        <nav className="mobile-bottom-nav" aria-label={ariaLabel ?? 'Navigasi bawah mobile'}>
            <div className="mobile-bottom-nav-inner">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <a
                            key={item.key}
                            href={item.href}
                            className={`mobile-bottom-nav-item${item.active ? ' is-active' : ''}`}
                            aria-current={item.active ? 'page' : undefined}
                            onClick={item.onClick}
                        >
                            <span className="mobile-bottom-nav-icon-wrap">
                                <Icon className="mobile-bottom-nav-icon" aria-hidden="true" />
                                {item.badgeCount && item.badgeCount > 0 ? (
                                    <span className="mobile-bottom-nav-badge">
                                        {item.badgeCount > 9 ? '9+' : item.badgeCount}
                                    </span>
                                ) : null}
                            </span>
                            <span className="mobile-bottom-nav-label">{item.label}</span>
                        </a>
                    );
                })}
            </div>
        </nav>
    );
}
