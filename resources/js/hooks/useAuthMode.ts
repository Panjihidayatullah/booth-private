import { useCallback, useEffect, useRef, useState } from 'react';

export type AuthMode = 'signin' | 'signup';

interface UseAuthModeOptions {
    initialMode: AuthMode;
    loginUrl: string;
    registerUrl: string;
    enabled?: boolean;
}

const FADE_OUT_MS = 140;

function normalizePath(path: string) {
    return path.replace(/\/+$/, '') || '/';
}

export default function useAuthMode({ initialMode, loginUrl, registerUrl, enabled = true }: UseAuthModeOptions) {
    const [selectedMode, setSelectedMode] = useState<AuthMode>(initialMode);
    const [displayedMode, setDisplayedMode] = useState<AuthMode>(initialMode);
    const [isFading, setIsFading] = useState(false);
    const selectedModeRef = useRef(initialMode);
    const displayedModeRef = useRef(initialMode);
    const timerRef = useRef<number | null>(null);
    const frameRef = useRef<number | null>(null);

    const clearPendingTransition = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (frameRef.current !== null) {
            window.cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }
    }, []);

    const changeMode = useCallback((mode: AuthMode, pushHistory: boolean) => {
        if (!enabled || mode === selectedModeRef.current) return;

        const destination = new URL(mode === 'signup' ? registerUrl : loginUrl, window.location.href);
        if (destination.origin !== window.location.origin) return;

        clearPendingTransition();
        selectedModeRef.current = mode;
        setSelectedMode(mode);

        if (pushHistory && destination.href !== window.location.href) {
            window.history.pushState(window.history.state, '', destination.href);
        }

        if (mode === displayedModeRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            displayedModeRef.current = mode;
            setDisplayedMode(mode);
            setIsFading(false);
            return;
        }

        setIsFading(true);
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            displayedModeRef.current = mode;
            setDisplayedMode(mode);
            frameRef.current = window.requestAnimationFrame(() => {
                frameRef.current = window.requestAnimationFrame(() => {
                    frameRef.current = null;
                    setIsFading(false);
                });
            });
        }, FADE_OUT_MS);
    }, [clearPendingTransition, enabled, loginUrl, registerUrl]);

    const selectMode = useCallback((mode: AuthMode) => changeMode(mode, true), [changeMode]);

    useEffect(() => {
        if (!enabled) return;

        const handlePopState = () => {
            const currentPath = normalizePath(window.location.pathname);
            const loginPath = normalizePath(new URL(loginUrl, window.location.href).pathname);
            const registerPath = normalizePath(new URL(registerUrl, window.location.href).pathname);
            if (currentPath === loginPath) changeMode('signin', false);
            else if (currentPath === registerPath) changeMode('signup', false);
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
            clearPendingTransition();
        };
    }, [changeMode, clearPendingTransition, enabled, loginUrl, registerUrl]);

    return { selectedMode, displayedMode, isFading, selectMode };
}
