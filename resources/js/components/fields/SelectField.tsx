import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { FieldPopover, type FieldControlProps } from './FieldPopover';

export interface SelectOption { value: string; label: string; disabled?: boolean; }
interface SelectFieldProps extends FieldControlProps { options: SelectOption[]; placeholder?: string; }

function SelectOptions({ options, value, isOpen, onSelect }: { options: SelectOption[]; value: string; isOpen: boolean; onSelect: (value: string) => void }) {
    const list = useRef<HTMLDivElement>(null);
    const search = useRef({ text: '', at: 0 });
    const active = useRef(0);
    const optionKey = options.map(option => `${option.value}:${option.disabled ? 1 : 0}`).join('|');
    useEffect(() => {
        if (!isOpen) return;
        const index = Math.max(0, options.findIndex(option => option.value === value && !option.disabled));
        const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
        const button = list.current?.querySelector<HTMLButtonElement>(`button[data-option-index="${index}"]:not(:disabled)`) ?? buttons[0];
        const frame = requestAnimationFrame(() => { button?.focus({ preventScroll: true }); button?.scrollIntoView({ block: 'nearest' }); });
        return () => cancelAnimationFrame(frame);
    }, [isOpen, optionKey]);

    function keyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === 'Enter' || event.key === ' ') {
            const option = options[active.current];
            if (option && !option.disabled) { event.preventDefault(); onSelect(option.value); }
            return;
        }
        const enabled = options.map((option, index) => ({ option, index })).filter(item => !item.option.disabled);
        if (!enabled.length) return;
        let index = enabled.findIndex(item => item.index === active.current);
        if (event.key === 'ArrowDown') index = (index + 1) % enabled.length;
        else if (event.key === 'ArrowUp') index = (index - 1 + enabled.length) % enabled.length;
        else if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = enabled.length - 1;
        else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey && event.key !== ' ') {
            const now = Date.now();
            search.current.text = now - search.current.at < 700 ? search.current.text + event.key.toLocaleLowerCase('id-ID') : event.key.toLocaleLowerCase('id-ID');
            search.current.at = now;
            const found = enabled.findIndex(item => item.option.label.toLocaleLowerCase('id-ID').startsWith(search.current.text));
            if (found < 0) return;
            index = found;
        } else return;
        event.preventDefault();
        const button = list.current?.querySelector<HTMLButtonElement>(`button[data-option-index="${enabled[index].index}"]`);
        button?.focus({ preventScroll: true });
        button?.scrollIntoView({ block: 'nearest' });
    }

    return <div ref={list} className="field-select-options" onKeyDown={keyDown}>
        {options.length ? options.map((option, index) => <button key={option.value} type="button" role="option" className="field-option" aria-selected={option.value === value} disabled={option.disabled} tabIndex={-1} data-option-index={index} onFocus={() => { active.current = index; }} onClick={() => onSelect(option.value)}><span>{option.label}</span>{option.value === value ? <Check aria-hidden="true" /> : null}</button>) : <p className="field-no-options">Belum ada pilihan tersedia.</p>}
    </div>;
}

export function SelectField({ id, value, onChange, options, placeholder = 'Pilih', required, disabled, name, className, 'aria-label': ariaLabel, 'aria-describedby': describedBy, 'aria-invalid': invalid }: SelectFieldProps) {
    const selected = options.find(option => option.value === value);
    return <FieldPopover id={id} value={value} displayValue={selected?.label ?? ''} placeholder={placeholder} icon={<ChevronDown />} nativeType="text" name={name} required={required} disabled={disabled} invalid={invalid === true || invalid === 'true'} describedBy={describedBy} ariaLabel={ariaLabel} className={className} popoverWidth="trigger" popupRole="listbox">
        {({ isOpen, close }) => <SelectOptions options={options} value={value} isOpen={isOpen} onSelect={next => { onChange(next); close(); }} />}
    </FieldPopover>;
}
