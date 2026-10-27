import { useEffect, useState } from 'react';

export function useDebouncedValue(value: string, delay = 300): string {
    const [settled, setSettled] = useState(value);
    useEffect(() => {
        if (value === '') { setSettled(''); return; }
        const timer = window.setTimeout(() => setSettled(value), delay);
        return () => window.clearTimeout(timer);
    }, [value, delay]);
    return value === '' ? '' : settled;
}
