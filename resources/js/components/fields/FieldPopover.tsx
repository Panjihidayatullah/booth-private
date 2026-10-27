import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import '../../../css/field-controls.css';

export interface FieldControlProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    name?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
}

interface FieldPopoverProps {
    id: string;
    value: string;
    displayValue: string;
    icon: ReactNode;
    nativeType: 'text' | 'date' | 'time';
    placeholder?: string;
    name?: string;
    required?: boolean;
    disabled?: boolean;
    min?: string;
    max?: string;
    step?: number;
    invalid?: boolean;
    describedBy?: string;
    ariaLabel?: string;
    className?: string;
    popoverWidth?: number | 'trigger';
    popupRole?: 'dialog' | 'listbox';
    onOpen?: () => void;
    onTriggerKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
    children: (controls: { isOpen: boolean; close: () => void }) => ReactNode;
}

export function FieldPopover({ id, value, displayValue, icon, nativeType, placeholder = 'Pilih', name, required = false, disabled = false, min, max, step, invalid = false, describedBy, ariaLabel, className = '', popoverWidth = 320, popupRole = 'dialog', onOpen, onTriggerKeyDown, children }: FieldPopoverProps) {
    const trigger = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [validation, setValidation] = useState('');
    const [label, setLabel] = useState(ariaLabel ?? '');
    const validationId = `${id}-validation`;
    const description = [describedBy, validation ? validationId : ''].filter(Boolean).join(' ') || undefined;

    useLayoutEffect(() => {
        setLabel(ariaLabel || trigger.current?.labels?.[0]?.textContent?.trim() || '');
    }, [ariaLabel, id]);

    useEffect(() => { setValidation(''); }, [value, min, max, step, required]);

    function positionPanel() {
        const anchor = trigger.current;
        const popup = panel.current;
        if (!anchor || !popup) return;
        const rect = anchor.getBoundingClientRect();
        const gutter = 12;
        const width = Math.min(popoverWidth === 'trigger' ? Math.max(180, rect.width) : popoverWidth, window.innerWidth - gutter * 2);
        const below = Math.max(0, window.innerHeight - rect.bottom - gutter - 6);
        const above = Math.max(0, rect.top - gutter - 6);
        popup.style.width = `${width}px`;
        popup.style.left = `${Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter))}px`;
        const height = popup.getBoundingClientRect().height || 360;
        const useAbove = below < Math.min(height, 320) && above > below;
        const available = useAbove ? above : below;
        popup.style.maxHeight = `${Math.min(420, available)}px`;
        const visibleHeight = Math.min(popup.getBoundingClientRect().height || height, available);
        popup.style.top = `${useAbove ? Math.max(gutter, rect.top - visibleHeight - 6) : rect.bottom + 6}px`;
    }

    function close(restoreFocus = true) {
        if (panel.current?.matches(':popover-open')) panel.current.hidePopover();
        setIsOpen(false);
        if (restoreFocus) trigger.current?.focus({ preventScroll: true });
    }

    function open() {
        if (disabled || !panel.current || panel.current.matches(':popover-open')) return;
        trigger.current?.click();
    }

    useEffect(() => {
        if (!isOpen) return;
        let frame = 0;
        const reposition = (event?: Event) => {
            if (event?.target instanceof Node && panel.current?.contains(event.target)) return;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(positionPanel);
        };
        const leave = (event: FocusEvent) => {
            const target = event.target;
            if (target instanceof Node && !panel.current?.contains(target) && !trigger.current?.contains(target)) close(false);
        };
        const observer = new ResizeObserver(() => reposition());
        if (trigger.current) observer.observe(trigger.current);
        if (panel.current) observer.observe(panel.current);
        window.addEventListener('resize', reposition);
        document.addEventListener('scroll', reposition, true);
        document.addEventListener('focusin', leave);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', reposition);
            document.removeEventListener('scroll', reposition, true);
            document.removeEventListener('focusin', leave);
        };
    }, [isOpen, popoverWidth]);

    useEffect(() => { if (disabled) close(false); }, [disabled]);

    return <div className={`field-control ${className}`}>
        <input className="field-control-native" id={`${id}-native`} type={nativeType} name={name} value={value} required={required} disabled={disabled} min={min} max={max} step={step} tabIndex={-1} aria-hidden="true" onChange={() => {}} onInvalid={event => {
            event.preventDefault();
            const control = event.currentTarget;
            const kind = nativeType === 'date' ? 'tanggal' : nativeType === 'time' ? 'jam' : 'pilihan';
            setValidation(control.validity.valueMissing ? `Pilih ${kind} terlebih dahulu.` : `Pilih ${kind} sesuai batas yang tersedia.`);
            const firstInvalid = control.form?.querySelector('input:invalid, select:invalid, textarea:invalid');
            if (!firstInvalid || firstInvalid === control) trigger.current?.focus({ preventScroll: true });
        }} />
        <button ref={trigger} id={id} className="field-trigger" type="button" role={popupRole === 'listbox' ? 'combobox' : undefined} disabled={disabled} popoverTarget={`${id}-popup`} popoverTargetAction="toggle" aria-label={label ? `${label}: ${displayValue || placeholder}` : undefined} aria-haspopup={popupRole} aria-expanded={isOpen} aria-controls={`${id}-popup`} aria-invalid={invalid || Boolean(validation) || undefined} aria-describedby={description} onKeyDown={event => {
            onTriggerKeyDown?.(event);
            if (!event.defaultPrevented && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); open(); }
        }}>
            <span className={displayValue ? 'field-value' : 'field-value field-placeholder'}>{displayValue || placeholder}</span>
            <span className="field-trigger-icon" aria-hidden="true">{icon}</span>
        </button>
        <div ref={panel} id={`${id}-popup`} className="field-popover" popover="auto" role={popupRole} aria-label={label || placeholder} onBeforeToggle={event => {
            if (event.target !== event.currentTarget || event.newState !== 'open') return;
            onOpen?.();
            positionPanel();
        }} onToggle={event => {
            if (event.target !== event.currentTarget) return;
            const opened = Boolean(panel.current?.matches(':popover-open'));
            setIsOpen(opened);
            if (opened) { positionPanel(); requestAnimationFrame(positionPanel); }
        }} onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
        }}>
            {children({ isOpen, close: () => close() })}
        </div>
        {validation ? <span id={validationId} className="field-validation" role="alert">{validation}</span> : null}
    </div>;
}
