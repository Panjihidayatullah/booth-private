import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { FieldPopover, type FieldControlProps } from './FieldPopover';
import '../../../css/date-picker.css';

interface DatePickerProps extends FieldControlProps {
    min?: string;
    max?: string;
}

type CalendarView = 'days' | 'months' | 'years';
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function dateAt(year: number, month: number, day = 1): Date {
    const date = new Date(0);
    date.setUTCHours(12, 0, 0, 0);
    date.setUTCFullYear(year, month, day);
    return date;
}

function isoDate(date: Date): string {
    return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function parseDate(value?: string): Date | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = dateAt(year, month - 1, day);
    return isoDate(date) === value ? date : null;
}

function todayWib(): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (name: string) => parts.find(item => item.type === name)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
}

function formatDate(value: string, long = false): string {
    const date = parseDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: long ? 'long' : 'short', year: 'numeric', ...(long ? { weekday: 'long' as const } : {}) }).format(date);
}

function monthStart(date: Date): Date { return dateAt(date.getUTCFullYear(), date.getUTCMonth()); }
function monthLength(year: number, month: number): number { return dateAt(year, month + 1, 0).getUTCDate(); }

function CalendarPanel({ id, value, min, max, required, onChange, isOpen, close }: DatePickerProps & { isOpen: boolean; close: () => void }) {
    const today = todayWib();
    const minimum = parseDate(min) ? min! : '0001-01-01';
    const maximum = parseDate(max) ? max! : '9999-12-31';
    const emptyRange = minimum > maximum;
    const bounded = (date: Date) => parseDate(isoDate(date) < minimum ? minimum : isoDate(date) > maximum ? maximum : isoDate(date)) ?? date;
    const initialDate = bounded(parseDate(value) ?? parseDate(today)!);
    const [month, setMonth] = useState(() => monthStart(initialDate));
    const [view, setView] = useState<CalendarView>('days');
    const [focused, setFocused] = useState(() => isoDate(initialDate));
    const [yearBlock, setYearBlock] = useState(() => Math.floor((initialDate.getUTCFullYear() - 1) / 12) * 12 + 1);
    const [focusRequest, setFocusRequest] = useState({ key: '', sequence: 0 });
    const panel = useRef<HTMLDivElement>(null);
    const requestFocus = (key: string) => setFocusRequest(previous => ({ key, sequence: previous.sequence + 1 }));
    const withinBounds = (date: Date) => date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999 && isoDate(date) >= minimum && isoDate(date) <= maximum && !emptyRange;
    const validMonth = (year: number, index: number) => year >= 1 && year <= 9999 && isoDate(dateAt(year, index, monthLength(year, index))) >= minimum && isoDate(dateAt(year, index)) <= maximum && !emptyRange;
    const validYear = (year: number) => year >= 1 && year <= 9999 && `${String(year).padStart(4, '0')}-12-31` >= minimum && `${String(year).padStart(4, '0')}-01-01` <= maximum && !emptyRange;

    useEffect(() => {
        if (!isOpen) return;
        const lower = parseDate(min) ? min! : '0001-01-01';
        const upper = parseDate(max) ? max! : '9999-12-31';
        const candidate = value && parseDate(value) ? value : todayWib();
        const next = parseDate(candidate < lower ? lower : candidate > upper ? upper : candidate)!;
        setMonth(monthStart(next));
        setFocused(isoDate(next));
        setYearBlock(Math.floor((next.getUTCFullYear() - 1) / 12) * 12 + 1);
        setView('days');
        setFocusRequest(previous => ({ key: `day-${isoDate(next)}`, sequence: previous.sequence + 1 }));
    }, [isOpen, value, min, max]);

    useEffect(() => {
        if (!isOpen || !focusRequest.key) return;
        const frame = requestAnimationFrame(() => {
            panel.current?.querySelector<HTMLButtonElement>(`[data-calendar-focus="${focusRequest.key}"]:not(:disabled)`)?.focus({ preventScroll: true });
        });
        return () => cancelAnimationFrame(frame);
    }, [isOpen, focusRequest]);

    function selectDay(date: Date) {
        if (!withinBounds(date)) return;
        onChange(isoDate(date));
        close();
    }

    function showMonth(date: Date, focusDay = false) {
        if (!validMonth(date.getUTCFullYear(), date.getUTCMonth())) return;
        const oldDay = parseDate(focused)?.getUTCDate() ?? 1;
        const next = bounded(dateAt(date.getUTCFullYear(), date.getUTCMonth(), Math.min(oldDay, monthLength(date.getUTCFullYear(), date.getUTCMonth()))));
        setMonth(monthStart(next));
        setFocused(isoDate(next));
        if (focusDay) requestFocus(`day-${isoDate(next)}`);
    }

    function dayKey(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
        let next: Date;
        const weekday = (date.getUTCDay() + 6) % 7;
        switch (event.key) {
            case 'ArrowLeft': next = dateAt(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1); break;
            case 'ArrowRight': next = dateAt(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1); break;
            case 'ArrowUp': next = dateAt(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 7); break;
            case 'ArrowDown': next = dateAt(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 7); break;
            case 'Home': next = dateAt(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - weekday); break;
            case 'End': next = dateAt(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 6 - weekday); break;
            case 'PageUp':
            case 'PageDown': {
                const offset = (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1);
                const target = dateAt(date.getUTCFullYear(), date.getUTCMonth() + offset);
                next = dateAt(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), monthLength(target.getUTCFullYear(), target.getUTCMonth())));
                break;
            }
            default: return;
        }
        event.preventDefault();
        next = bounded(next);
        if (!withinBounds(next)) return;
        setMonth(monthStart(next));
        setFocused(isoDate(next));
        requestFocus(`day-${isoDate(next)}`);
    }

    function periodKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        const offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -3 : event.key === 'ArrowDown' ? 3 : 0;
        if (!offset && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        let next = event.key === 'Home' ? 0 : event.key === 'End' ? 11 : index + offset;
        const direction = offset < 0 || event.key === 'End' ? -1 : 1;
        while (next >= 0 && next < 12) {
            const available = view === 'months' ? validMonth(month.getUTCFullYear(), next) : validYear(yearBlock + next);
            if (available) { requestFocus(`${view === 'months' ? 'month' : 'year'}-${view === 'months' ? next : yearBlock + next}`); return; }
            next += direction;
        }
    }

    function navigate(direction: number) {
        if (view === 'days') showMonth(dateAt(month.getUTCFullYear(), month.getUTCMonth() + direction));
        else if (view === 'months') setMonth(dateAt(month.getUTCFullYear() + direction, month.getUTCMonth()));
        else setYearBlock(current => Math.max(1, Math.min(9997, current + direction * 12)));
    }

    function canNavigate(direction: number): boolean {
        if (emptyRange) return false;
        if (view === 'days') {
            const next = dateAt(month.getUTCFullYear(), month.getUTCMonth() + direction);
            return validMonth(next.getUTCFullYear(), next.getUTCMonth());
        }
        if (view === 'months') return validYear(month.getUTCFullYear() + direction);
        const start = yearBlock + direction * 12;
        return start >= 1 && start <= 9999 && Array.from({ length: 12 }, (_, index) => start + index).some(validYear);
    }

    const calendarStart = dateAt(month.getUTCFullYear(), month.getUTCMonth(), 1 - ((month.getUTCDay() + 6) % 7));
    const calendarDays = Array.from({ length: 42 }, (_, index) => dateAt(calendarStart.getUTCFullYear(), calendarStart.getUTCMonth(), calendarStart.getUTCDate() + index));
    const title = view === 'days' ? `${MONTHS[month.getUTCMonth()]} ${month.getUTCFullYear()}` : view === 'months' ? String(month.getUTCFullYear()) : `${yearBlock}–${Math.min(9999, yearBlock + 11)}`;
    const selectedYear = parseDate(value)?.getUTCFullYear();
    const selectedMonth = parseDate(value)?.getUTCMonth();

    return <div className="rt-date-picker" ref={panel}>
        <div className="rt-date-picker-heading">
            <button className="rt-date-picker-nav" type="button" aria-label={view === 'days' ? 'Bulan sebelumnya' : view === 'months' ? 'Tahun sebelumnya' : 'Dua belas tahun sebelumnya'} disabled={!canNavigate(-1)} onClick={() => navigate(-1)}><ChevronLeft aria-hidden="true" /></button>
            {view === 'years' ? <span className="rt-date-picker-title" id={`${id}-calendar-heading`}>{title}</span> : <button className="rt-date-picker-title" type="button" id={`${id}-calendar-heading`} aria-label={view === 'days' ? 'Pilih bulan dan tahun' : 'Pilih tahun'} onClick={() => { if (view === 'days') { setView('months'); requestFocus(`month-${month.getUTCMonth()}`); } else { setYearBlock(Math.floor((month.getUTCFullYear() - 1) / 12) * 12 + 1); setView('years'); requestFocus(`year-${month.getUTCFullYear()}`); } }}>{title}</button>}
            <button className="rt-date-picker-nav" type="button" aria-label={view === 'days' ? 'Bulan berikutnya' : view === 'months' ? 'Tahun berikutnya' : 'Dua belas tahun berikutnya'} disabled={!canNavigate(1)} onClick={() => navigate(1)}><ChevronRight aria-hidden="true" /></button>
        </div>
        {view === 'days' ? <div className="rt-date-picker-grid" role="grid" aria-labelledby={`${id}-calendar-heading`}>
            <div className="rt-date-picker-week rt-date-picker-weekdays" role="row">{WEEKDAYS.map(day => <span key={day} role="columnheader">{day}</span>)}</div>
            {Array.from({ length: 6 }, (_, week) => <div className="rt-date-picker-week" role="row" key={week}>{calendarDays.slice(week * 7, week * 7 + 7).map((date, index) => {
                const iso = isoDate(date);
                if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return <span key={`blank-${index}`} role="gridcell" />;
                return <button key={iso} type="button" role="gridcell" className={`rt-date-picker-day${date.getUTCMonth() !== month.getUTCMonth() ? ' is-outside' : ''}${iso === value ? ' is-selected' : ''}${iso === today ? ' is-today' : ''}`} disabled={!withinBounds(date)} aria-selected={iso === value} aria-current={iso === today ? 'date' : undefined} aria-label={formatDate(iso, true)} data-calendar-focus={`day-${iso}`} tabIndex={iso === focused ? 0 : -1} onFocus={() => setFocused(iso)} onKeyDown={event => dayKey(event, date)} onClick={() => selectDay(date)}>{date.getUTCDate()}</button>;
            })}</div>)}
        </div> : <div className="rt-date-picker-periods" role="group" aria-label={view === 'months' ? 'Pilihan bulan' : 'Pilihan tahun'}>
            {Array.from({ length: 12 }, (_, index) => {
                const year = view === 'months' ? month.getUTCFullYear() : yearBlock + index;
                const selected = view === 'months' ? selectedYear === year && selectedMonth === index : selectedYear === year;
                const enabled = view === 'months' ? validMonth(year, index) : validYear(year);
                const key = `${view === 'months' ? 'month' : 'year'}-${view === 'months' ? index : year}`;
                return <button type="button" key={key} className={selected ? 'is-selected' : ''} disabled={!enabled} aria-pressed={selected} data-calendar-focus={key} onKeyDown={event => periodKey(event, index)} onClick={() => {
                    if (view === 'months') { showMonth(dateAt(year, index), true); setView('days'); }
                    else { const preferred = validMonth(year, month.getUTCMonth()) ? month.getUTCMonth() : Array.from({ length: 12 }, (_, value) => value).find(value => validMonth(year, value)) ?? 0; setMonth(dateAt(year, preferred)); setView('months'); requestFocus(`month-${preferred}`); }
                }}>{view === 'months' ? MONTHS[index].slice(0, 3) : year <= 9999 ? year : '—'}</button>;
            })}
        </div>}
        {emptyRange ? <p className="rt-date-picker-help">Tidak ada tanggal yang tersedia dalam rentang ini.</p> : null}
        <div className="rt-date-picker-footer">
            <button type="button" disabled={!withinBounds(parseDate(today)!)} onClick={() => selectDay(parseDate(today)!)}>Hari ini</button>
            {!required ? <button type="button" className="rt-date-picker-clear" disabled={!value} onClick={() => { onChange(''); close(); }}>Kosongkan</button> : <span className="rt-date-picker-help">Pilih tanggal penggunaan</span>}
        </div>
    </div>;
}

export default function DatePicker(props: DatePickerProps) {
    const { id, value, min, max, required, disabled, name, className, 'aria-label': ariaLabel, 'aria-describedby': describedBy, 'aria-invalid': invalid } = props;
    return <FieldPopover id={id} value={value} displayValue={formatDate(value)} placeholder="Pilih tanggal" icon={<CalendarDays aria-hidden="true" />} nativeType="date" min={min} max={max} required={required} disabled={disabled} name={name} className={className} invalid={invalid === true || invalid === 'true'} describedBy={describedBy} ariaLabel={ariaLabel} popoverWidth={320} popupRole="dialog">
        {({ isOpen, close }) => <CalendarPanel {...props} isOpen={isOpen} close={close} />}
    </FieldPopover>;
}

export { DatePicker };
