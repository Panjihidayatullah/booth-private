import { useLayoutEffect, useRef, type ElementType } from 'react';

export const mobileNavIndicatorDuration = 220;

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
    animateIndicator?: boolean;
}

export default function MobileBottomNav({ items, ariaLabel, animateIndicator = false }: MobileBottomNavProps) {
    const indicatorRef = useRef<HTMLSpanElement>(null);
    const previousPosition = useRef<string>(undefined);
    const animationRef = useRef<Animation>(undefined);
    const activeIndex = items.findIndex((item) => item.active);
    const position = activeIndex < 0 ? undefined : `${(activeIndex + 0.5) / items.length * 100}%`;

    useLayoutEffect(() => {
        const indicator = indicatorRef.current;
        const from = previousPosition.current;
        previousPosition.current = position;
        if (!indicator || !from || !position || from === position || !indicator.getClientRects().length ||
            !indicator.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            animationRef.current?.cancel();
            return;
        }

        const current = window.getComputedStyle(indicator);
        const isMoving = animationRef.current?.playState === 'running';
        const start = isMoving
            ? { left: current.left, width: current.width, height: current.height }
            : { left: from, width: current.width, height: current.height };
        const end = { left: position, width: '38px', height: '28px' };
        animationRef.current?.cancel();
        animationRef.current = indicator.animate([
            { ...start, easing: 'ease-out' },
            { left: start.left, width: '12px', height: '12px', offset: 0.24, easing: 'cubic-bezier(.35, 0, .25, 1)' },
            { left: position, width: '12px', height: '12px', offset: 0.72, easing: 'ease-out' },
            end,
        ], { duration: mobileNavIndicatorDuration });
    }, [position]);

    if (!items || items.length === 0) return null;

    return (
        <nav className={`mobile-bottom-nav${animateIndicator ? ' has-moving-indicator' : ''}`} aria-label={ariaLabel ?? 'Navigasi bawah mobile'}>
            <div className="mobile-bottom-nav-inner">
                {animateIndicator && position && (
                    <div className="mobile-bottom-nav-indicator-track" aria-hidden="true">
                        <span className="mobile-bottom-nav-indicator" ref={indicatorRef} style={{ left: position }} />
                    </div>
                )}
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
