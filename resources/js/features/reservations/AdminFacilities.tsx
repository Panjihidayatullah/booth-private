import { useState, type FormEvent } from 'react';
import { Edit3, Plus, Settings2, Trash2 } from 'lucide-react';
import type { AppConfig } from '../../types/app';
import { http, type ValidationErrors } from '../../lib/http';
import { AdminDialog, ConfirmDialog, Empty, Feedback, Field, Loading, adminError, api, useAdminResource, type AdminFacility } from './admin-shared';

export default function AdminFacilities({ config }: { config: AppConfig }) {
    const facilities = useAdminResource<AdminFacility[]>(config, '/admin/facilities');
    const [editing, setEditing] = useState<{ id: number | null; name: string; description: string } | null>(null);
    const [deleting, setDeleting] = useState<AdminFacility | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    function open(facility?: AdminFacility) { setError(''); setSuccess(''); setErrors({}); setEditing({ id: facility?.id ?? null, name: facility?.name ?? '', description: facility?.description ?? '' }); }
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (!editing || busy) return;
        setBusy(true); setError(''); setErrors({});
        try {
            const payload = { name: editing.name, description: editing.description || null };
            if (editing.id) await http.put(api(config, `/admin/facilities/${editing.id}`), payload);
            else await http.post(api(config, '/admin/facilities'), payload);
            setSuccess(editing.id ? 'Fasilitas berhasil diperbarui.' : 'Fasilitas baru berhasil ditambahkan.'); setEditing(null); facilities.refresh();
        } catch (reason) { const result = adminError(reason); setError(result.message); setErrors(result.errors); }
        finally { setBusy(false); }
    }
    async function remove() {
        if (!deleting || busy) return; setBusy(true); setError('');
        try { await http.delete(api(config, `/admin/facilities/${deleting.id}`)); setSuccess('Fasilitas berhasil dihapus.'); setDeleting(null); facilities.refresh(); }
        catch (reason) { setError(adminError(reason).message); setDeleting(null); }
        finally { setBusy(false); }
    }
    return <div className="rt-page rta-admin-page">
        <div className="rt-page-heading"><div><span className="rt-eyebrow">Kelengkapan ruangan</span><h2>Fasilitas yang membuat nyaman.</h2><p>Kelola daftar fasilitas yang dapat dipasang pada setiap ruangan.</p></div><button type="button" className="rt-button primary" onClick={() => open()}><Plus />Tambah fasilitas</button></div>
        {!editing ? <Feedback error={error || facilities.error} success={success} /> : null}
        {facilities.loading && !facilities.data ? <Loading /> : facilities.data?.length ? <div className="rt-grid rt-grid-3">{facilities.data.map(facility => <article className="rt-card" key={facility.id}><span className="rt-stat-icon"><Settings2 /></span><h3>{facility.name}</h3><p className="rt-muted">{facility.description || 'Fasilitas pendukung ruangan.'}</p><div className="rta-card-actions"><button type="button" className="rt-button secondary" onClick={() => open(facility)}><Edit3 />Ubah</button><button type="button" className="rt-button secondary" onClick={() => { setError(''); setSuccess(''); setDeleting(facility); }}><Trash2 />Hapus</button></div></article>)}</div> : <Empty title="Belum ada fasilitas">Tambahkan fasilitas seperti Wi-Fi atau proyektor, lalu pilih fasilitas tersebut saat mengelola ruangan.</Empty>}
        {editing ? <AdminDialog title={editing.id ? 'Ubah fasilitas' : 'Tambah fasilitas'} busy={busy} onClose={() => setEditing(null)} footer={<><button type="button" className="rt-button secondary" onClick={() => setEditing(null)} disabled={busy}>Batal</button><button type="submit" form="facility-form" className="rt-button primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan fasilitas'}</button></>}><Feedback error={error} /><form id="facility-form" className="rt-form-grid" onSubmit={save}><Field label="Nama fasilitas" htmlFor="facility-name" error={errors.name?.[0]} full><input id="facility-name" value={editing.name} required maxLength={100} onChange={event => setEditing({ ...editing, name: event.target.value })} /></Field><Field label="Deskripsi (opsional)" htmlFor="facility-description" error={errors.description?.[0]} full><textarea id="facility-description" rows={3} value={editing.description} maxLength={1000} onChange={event => setEditing({ ...editing, description: event.target.value })} /></Field></form></AdminDialog> : null}
        {deleting ? <ConfirmDialog title="Hapus fasilitas?" busy={busy} danger label="Hapus fasilitas" onClose={() => setDeleting(null)} onConfirm={remove}><p>Hapus <strong>{deleting.name}</strong> dari daftar fasilitas?</p><p>Jika fasilitas masih digunakan pada ruangan, sistem dapat meminta Anda mengubah ruangan tersebut terlebih dahulu.</p></ConfirmDialog> : null}
    </div>;
}
