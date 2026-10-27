import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Check, Clock3 } from 'lucide-react';
import { FieldPopover, type FieldControlProps } from './FieldPopover';
import '../../../css/time-picker.css';

export interface TimePickerProps extends FieldControlProps {
    min?: string;
    max?: string;
    /** Native input step in seconds; 60 retains every-minute precision. */
    step?: number;
    /** Apply each selection immediately for live filters. */
    autoApply?: boolean;
}

function parseTime(value: string | undefined): number | null {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
    const [hour, minute] = value.split(':').map(Number);
    return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');
const formatTime = (minutes: number) => `${twoDigits(Math.floor(minutes / 60))}:${twoDigits(minutes % 60)}`;

function closestTime(values: number[], preferred: number): number {
    return values.reduce((closest, candidate) => Math.abs(candidate - preferred) < Math.abs(closest - preferred) ? candidate : closest, values[0] ?? 0);
}

interface TimeColumnProps {
    label: string;
    values: number[];
    selected: number;
    listRef: RefObject<HTMLDivElement | null>;
    disabledValues?: Set<number>;
    onSelect: (value: number) => void;
    onOtherColumn: () => void;
}

function TimeColumn({ label, values, selected, listRef, disabledValues, onSelect, onOtherColumn }: TimeColumnProps) {
    const typed = useRef({ value: '', at: 0 });

    function selectAndFocus(value: number) {
        onSelect(value);
        requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>(`[data-time-value="${value}"]`)?.focus({ preventScroll: true }));
    }

    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const enabled = values.filter(value => !disabledValues?.has(value));
        if (!enabled.length) return;
        const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('[data-time-value]') : null;
        const current = target ? Number(target.dataset.timeValue) : selected;
        const index = Math.max(0, enabled.indexOf(current));
        let next: number | undefined;
        if (event.key === 'ArrowDown') next = enabled[Math.min(index + 1, enabled.length - 1)];
        if (event.key === 'ArrowUp') next = enabled[Math.max(index - 1, 0)];
        if (event.key === 'Home') next = enabled[0];
        if (event.key === 'End') next = enabled[enabled.length - 1];
        if (event.key === 'PageDown') next = enabled[Math.min(index + 5, enabled.length - 1)];
        if (event.key === 'PageUp') next = enabled[Math.max(index - 5, 0)];
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            onOtherColumn();
            return;
        }
        if (/^\d$/.test(event.key)) {
            const now = Date.now();
            typed.current.value = now - typed.current.at > 800 ? event.key : `${typed.current.value}${event.key}`.slice(-2);
            typed.current.at = now;
            const requested = Number(typed.current.value);
            next = enabled.find(value => value === requested);
            if (next === undefined && typed.current.value.length === 2) {
                typed.current.value = event.key;
                next = enabled.find(value => value === Number(event.key));
            }
        }
        if (next !== undefined) {
            event.preventDefault();
            event.stopPropagation();
            selectAndFocus(next);
        }
    }

    return <div className="rt-time-column">
        <span className="rt-time-column-label">{label}</span>
        <div className="rt-time-options" ref={listRef} role="listbox" aria-label={`Pilih ${label.toLowerCase()}`} aria-orientation="vertical" onKeyDown={onKeyDown}>
            {values.map(value => <button key={value} type="button" role="option" aria-selected={value === selected} data-time-value={value} className={`rt-time-option${value === selected ? ' is-selected' : ''}`} disabled={disabledValues?.has(value)} tabIndex={value === selected ? 0 : -1} onClick={() => onSelect(value)}>{twoDigits(value)}{value === selected ? <Check aria-hidden="true" /> : <span className="rt-time-option-spacer" />}</button>)}
        </div>
    </div>;
}

interface TimePanelProps {
    isOpen: boolean;
    close: () => void;
    draft: number;
    setDraft: (value: number) => void;
    allowedTimes: number[];
    min?: string;
    max?: string;
    required?: boolean;
    autoApply?: boolean;
    onChange: (value: string) => void;
}

function TimePanel({ isOpen, close, draft, setDraft, allowedTimes, min, max, required, autoApply, onChange }: TimePanelProps) {
    const hoursRef = useRef<HTMLDivElement>(null);
    const minutesRef = useRef<HTMLDivElement>(null);
    const hours = useMemo(() => [...new Set(allowedTimes.map(value => Math.floor(value / 60)))], [allowedTimes]);
    const minutes = useMemo(() => Array.from({ length: 60 }, (_, index) => index), []);
    const hour = Math.floor(draft / 60);
    const minute = draft % 60;
    const disabledMinutes = useMemo(() => new Set(minutes.filter(value => !allowedTimes.includes(hour * 60 + value))), [allowedTimes, hour, minutes]);

    function focusSelected(ref: RefObject<HTMLDivElement | null>) {
        ref.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
    }

    useEffect(() => {
        if (!isOpen) return;
        const frame = requestAnimationFrame(() => focusSelected(hoursRef));
        return () => cancelAnimationFrame(frame);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        for (const list of [hoursRef.current, minutesRef.current]) {
            const selected = list?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
            if (list && selected) list.scrollTop = selected.offsetTop - list.clientHeight / 2 + selected.clientHeight / 2;
        }
    }, [isOpen, draft]);

    function selectHour(nextHour: number) {
        const candidates = allowedTimes.filter(value => Math.floor(value / 60) === nextHour);
        if (candidates.length) setDraft(closestTime(candidates, nextHour * 60 + minute));
    }

    function apply() {
        if (!allowedTimes.includes(draft)) return;
        onChange(formatTime(draft));
        close();
    }

    return <div className="rt-time-picker">
        <div className="rt-time-heading">
            <div><span className="rt-time-caption">Pilih waktu</span><div className="rt-time-preview">{formatTime(draft)}<span>WIB</span></div></div>
            {min || max ? <span className="rt-time-range">{min || '00:00'}–{max || '23:59'}</span> : <span className="rt-time-range">24 jam</span>}
        </div>
        {allowedTimes.length ? <div className="rt-time-columns">
            <TimeColumn label="Jam" values={hours} selected={hour} listRef={hoursRef} onSelect={selectHour} onOtherColumn={() => focusSelected(minutesRef)} />
            <span className="rt-time-divider" aria-hidden="true">:</span>
            <TimeColumn label="Menit" values={minutes} selected={minute} listRef={minutesRef} disabledValues={disabledMinutes} onSelect={value => setDraft(hour * 60 + value)} onOtherColumn={() => focusSelected(hoursRef)} />
        </div> : <p className="rt-time-empty">Tidak ada waktu yang sesuai dengan rentang pilihan.</p>}
        <div className="rt-time-footer">
            {!required ? <button type="button" className="rt-time-clear" onClick={() => { onChange(''); close(); }}>Kosongkan</button> : autoApply ? <span className="rt-time-caption">Pilihan langsung diterapkan</span> : <button type="button" className="rt-time-clear" onClick={close}>Batal</button>}
            {autoApply ? <button type="button" className="rt-time-apply" onClick={close}>Tutup<Check aria-hidden="true" /></button> : <button type="button" className="rt-time-apply" disabled={!allowedTimes.length} onClick={apply}>Terapkan<Check aria-hidden="true" /></button>}
        </div>
    </div>;
}

export function TimePicker({ id, value, onChange, min, max, step = 60, autoApply = false, name, required, disabled, className, 'aria-label': ariaLabel, 'aria-describedby': describedBy, 'aria-invalid': invalid }: TimePickerProps) {
    const allowedTimes = useMemo(() => {
        const lower = parseTime(min);
        const upper = parseTime(max);
        const baseSeconds = (lower ?? 0) * 60;
        const interval = Number.isFinite(step) && step > 0 ? step : 60;
        return Array.from({ length: 24 * 60 }, (_, index) => index).filter(minutes => {
            const withinBounds = lower !== null && upper !== null && lower > upper
                ? minutes >= lower || minutes <= upper
                : (lower === null || minutes >= lower) && (upper === null || minutes <= upper);
            return withinBounds && Math.abs(((minutes * 60 - baseSeconds) % interval + interval) % interval) < 0.00001;
        });
    }, [min, max, step]);
    const [draft, setDraft] = useState(() => closestTime(allowedTimes, parseTime(value) ?? parseTime(min) ?? 0));

    function selectTime(next: number) {
        setDraft(next);
        if (autoApply && allowedTimes.includes(next)) {
            const selected = formatTime(next);
            if (selected !== value) onChange(selected);
        }
    }

    return <FieldPopover id={id} value={value} displayValue={value} placeholder="Pilih jam" icon={<Clock3 aria-hidden="true" />} nativeType="time" name={name} required={required} disabled={disabled} min={min} max={max} step={step} invalid={invalid === true || invalid === 'true'} describedBy={describedBy} ariaLabel={ariaLabel} className={className} popoverWidth={300} popupRole="dialog" onOpen={() => setDraft(closestTime(allowedTimes, parseTime(value) ?? parseTime(min) ?? 0))}>
        {({ isOpen, close }) => <TimePanel isOpen={isOpen} close={close} draft={draft} setDraft={selectTime} allowedTimes={allowedTimes} min={min} max={max} required={required} autoApply={autoApply} onChange={onChange} />}
    </FieldPopover>;
}

export default TimePicker;
