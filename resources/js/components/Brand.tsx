import { Asterisk } from 'lucide-react';

interface BrandProps {
    href: string;
    light?: boolean;
}

export default function Brand({ href, light = false }: BrandProps) {
    return (
        <a className={`brand${light ? ' brand-light' : ''}`} href={href} aria-label="RuangTemu, halaman utama">
            <span className="brand-symbol"><Asterisk aria-hidden="true" /></span>
            <span>RuangTemu</span>
        </a>
    );
}
