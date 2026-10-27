import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

const TRACK_INSET = 3;
const MIN_THUMB_HEIGHT = 40;
const ARROW_SCROLL_STEP = 40;
const AUTO_HIDE_DELAY = 500;

interface OverlayScrollbarProps {
    scrollTargetId?: string;
}

interface ScrollMetrics {
    controlsId: string;
    maxScroll: number;
    scrollTop: number;
    thumbHeight: number;
    thumbTop: number;
    thumbTravel: number;
    viewportHeight: number;
    visible: boolean;
}

const INITIAL_METRICS: ScrollMetrics = {
    controlsId: 'app',
    maxScroll: 0,
    scrollTop: 0,
    thumbHeight: 0,
    thumbTop: TRACK_INSET,
    thumbTravel: 0,
    viewportHeight: 0,
    visible: false,
};

function resolveScrollTarget(targetId?: string): HTMLElement {
    const panel = targetId ? document.getElementById(targetId) : null;
    if (panel && ['auto', 'scroll'].includes(window.getComputedStyle(panel).overflowY)) return panel;
    return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement;
}

function scrollToPosition(top: number, targetId?: string) {
    const target = resolveScrollTarget(targetId);
    if (target === document.scrollingElement || target === document.documentElement) {
        window.scrollTo({ top, behavior: 'auto' });
    } else {
        target.scrollTo({ top, behavior: 'auto' });
    }
}

function readScrollMetrics(target: HTMLElement): ScrollMetrics {
    const root = document.documentElement;
    const body = document.body;
    const isDocument = target === document.scrollingElement || target === root;
    const viewportHeight = isDocument ? window.innerHeight : target.clientHeight;
    const viewportTop = isDocument ? 0 : target.getBoundingClientRect().top;
    const scrollHeight = isDocument ? Math.max(root.scrollHeight, body.scrollHeight, root.offsetHeight, body.offsetHeight) : target.scrollHeight;
    const maxScroll = Math.max(0, scrollHeight - viewportHeight);
    const scrollTop = Math.min(maxScroll, Math.max(0, isDocument ? target.scrollTop || window.scrollY : target.scrollTop));
    const trackHeight = Math.max(0, viewportHeight - (TRACK_INSET * 2));
    const proportionalHeight = scrollHeight > 0 ? trackHeight * (viewportHeight / scrollHeight) : trackHeight;
    const thumbHeight = Math.min(trackHeight, Math.max(MIN_THUMB_HEIGHT, proportionalHeight));
    const thumbTravel = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = viewportTop + TRACK_INSET + (maxScroll > 0 ? (scrollTop / maxScroll) * thumbTravel : 0);

    return {
        controlsId: isDocument ? 'app' : target.id,
        maxScroll,
        scrollTop,
        thumbHeight,
        thumbTop,
        thumbTravel,
        viewportHeight,
        visible: maxScroll > 1 && thumbTravel > 0,
    };
}

export default function OverlayScrollbar({ scrollTargetId }: OverlayScrollbarProps) {
    const [metrics, setMetrics] = useState<ScrollMetrics>(INITIAL_METRICS);
    const [isDragging, setIsDragging] = useState(false);
    const [isScrollbarActive, setIsScrollbarActive] = useState(true);
    const dragState = useRef<{ pointerId: number; startY: number; startScrollTop: number } | null>(null);
    const hideTimer = useRef<number | null>(null);
    const thumbRef = useRef<HTMLDivElement>(null);

    const revealScrollbar = useCallback(() => {
        if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
        setIsScrollbarActive(true);
        hideTimer.current = window.setTimeout(() => {
            hideTimer.current = null;
            const thumb = thumbRef.current;
            if (dragState.current || document.activeElement === thumb || thumb?.matches(':hover')) return;
            setIsScrollbarActive(false);
        }, AUTO_HIDE_DELAY);
    }, []);

    useLayoutEffect(() => {
        document.documentElement.classList.add('has-overlay-scrollbar');
        return () => document.documentElement.classList.remove('has-overlay-scrollbar');
    }, []);

    useEffect(() => {
        let animationFrame: number | null = null;
        let isActive = true;

        const updateMetrics = () => {
            animationFrame = null;
            setMetrics(readScrollMetrics(resolveScrollTarget(scrollTargetId)));
        };
        const scheduleUpdate = () => {
            if (!isActive) return;
            if (animationFrame === null) animationFrame = window.requestAnimationFrame(updateMetrics);
        };

        const handleScroll = (event: Event) => {
            if (event.target !== document && event.target !== resolveScrollTarget(scrollTargetId)) return;
            revealScrollbar();
            scheduleUpdate();
        };
        const handleResize = () => {
            revealScrollbar();
            scheduleUpdate();
        };

        updateMetrics();
        revealScrollbar();
        document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('load', scheduleUpdate);

        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate);
        resizeObserver?.observe(document.documentElement);
        resizeObserver?.observe(document.body);
        const app = document.getElementById('app');
        if (app) resizeObserver?.observe(app);
        const panel = scrollTargetId ? document.getElementById(scrollTargetId) : null;
        if (panel) {
            resizeObserver?.observe(panel);
            for (const child of panel.children) resizeObserver?.observe(child);
        }

        void document.fonts?.ready.then(scheduleUpdate);

        return () => {
            isActive = false;
            document.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('load', scheduleUpdate);
            resizeObserver?.disconnect();
            if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
            if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
        };
    }, [revealScrollbar, scrollTargetId]);

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        dragState.current = { pointerId: event.pointerId, startY: event.clientY, startScrollTop: metrics.scrollTop };
        setIsDragging(true);
        revealScrollbar();
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        const drag = dragState.current;
        if (!drag || drag.pointerId !== event.pointerId || metrics.thumbTravel <= 0) return;

        const scrollDelta = ((event.clientY - drag.startY) / metrics.thumbTravel) * metrics.maxScroll;
        scrollToPosition(drag.startScrollTop + scrollDelta, scrollTargetId);
    }

    function finishPointerDrag(event: PointerEvent<HTMLDivElement>) {
        if (dragState.current?.pointerId !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        dragState.current = null;
        setIsDragging(false);
        revealScrollbar();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        let nextScrollTop: number | null = null;

        switch (event.key) {
            case 'ArrowUp':
                nextScrollTop = metrics.scrollTop - ARROW_SCROLL_STEP;
                break;
            case 'ArrowDown':
                nextScrollTop = metrics.scrollTop + ARROW_SCROLL_STEP;
                break;
            case 'PageUp':
                nextScrollTop = metrics.scrollTop - (metrics.viewportHeight * 0.9);
                break;
            case 'PageDown':
            case ' ':
                nextScrollTop = metrics.scrollTop + (metrics.viewportHeight * 0.9 * (event.shiftKey ? -1 : 1));
                break;
            case 'Home':
                nextScrollTop = 0;
                break;
            case 'End':
                nextScrollTop = metrics.maxScroll;
                break;
            default:
                return;
        }

        event.preventDefault();
        revealScrollbar();
        scrollToPosition(Math.min(metrics.maxScroll, Math.max(0, nextScrollTop)), scrollTargetId);
    }

    if (!metrics.visible) return null;

    const scrollPercentage = metrics.maxScroll > 0 ? Math.round((metrics.scrollTop / metrics.maxScroll) * 100) : 0;

    return (
        <div className={`site-scrollbar${isScrollbarActive || isDragging ? ' is-active' : ''}`}>
            <div
                ref={thumbRef}
                className={`site-scrollbar-thumb${isDragging ? ' is-dragging' : ''}`}
                style={{ height: metrics.thumbHeight, transform: `translateY(${metrics.thumbTop}px)` }}
                role="scrollbar"
                aria-label={metrics.controlsId === 'app' ? 'Posisi gulir halaman' : 'Posisi gulir formulir akun'}
                aria-controls={metrics.controlsId}
                aria-orientation="vertical"
                aria-valuemin={0}
                aria-valuemax={Math.round(metrics.maxScroll)}
                aria-valuenow={Math.round(metrics.scrollTop)}
                aria-valuetext={`${scrollPercentage}%`}
                tabIndex={0}
                onFocus={revealScrollbar}
                onBlur={revealScrollbar}
                onPointerEnter={revealScrollbar}
                onPointerLeave={revealScrollbar}
                onKeyDown={handleKeyDown}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointerDrag}
                onPointerCancel={finishPointerDrag}
                onLostPointerCapture={() => {
                    dragState.current = null;
                    setIsDragging(false);
                    revealScrollbar();
                }}
            />
        </div>
    );
}
