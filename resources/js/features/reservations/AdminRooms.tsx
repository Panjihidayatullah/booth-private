import { useState, useRef, type FormEvent, type ChangeEvent } from 'react';
import { SelectField } from '../../components/fields/SelectField';
import { Building2, Edit3, Image as ImageIcon, MapPin, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import type { AppConfig } from '../../types/app';
import { http, type ValidationErrors } from '../../lib/http';
import { AdminDialog, ConfirmDialog, Empty, Feedback, Field, Loading, adminError, api, useAdminResource, type AdminFacility, type AdminRoom } from './admin-shared';

interface RoomDraft {
    name: string; type: 'workspace' | 'booth'; capacity: string; location: string; floor: string;
    rules: string; description: string; is_active: boolean; maintenance_notes: string; image_url: string;
    facility_ids: number[]; width: string; depth: string; desks: string; door: 'top' | 'right' | 'bottom' | 'left';
}
const blankRoom = (): RoomDraft => ({ name: '', type: 'workspace', capacity: '4', location: '', floor: '', rules: '', description: '', is_active: true, maintenance_notes: '', image_url: '', facility_ids: [], width: '6', depth: '4', desks: '1', door: 'bottom' });

export default function AdminRooms({ config }: { config: AppConfig }) {
    const rooms = useAdminResource<AdminRoom[]>(config, '/admin/rooms');
    const facilities = useAdminResource<AdminFacility[]>(config, '/admin/facilities');
    const [query, setQuery] = useState('');
    const [editor, setEditor] = useState<{ id: number | null; draft: RoomDraft } | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [deleting, setDeleting] = useState<AdminRoom | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const filtered = (rooms.data ?? []).filter(room => `${room.name} ${room.location} ${room.floor}`.toLowerCase().includes(query.toLowerCase()));

    function openEditor(room?: AdminRoom) {
        setError(''); setSuccess(''); setErrors({});
        setSelectedFile(null);
        setPreviewUrl(room?.image_url ?? null);
        setIsDragging(false);
        setEditor(room ? { id: room.id, draft: { name: room.name, type: room.type, capacity: String(room.capacity), location: room.location, floor: room.floor, rules: room.rules ?? '', description: room.description ?? '', is_active: room.is_active, maintenance_notes: room.maintenance_notes ?? '', image_url: room.image_url ?? '', facility_ids: room.facilities.map(facility => facility.id), width: String(room.floor_plan?.width ?? 6), depth: String(room.floor_plan?.depth ?? 4), desks: String(room.floor_plan?.desks ?? 1), door: room.floor_plan?.door ?? 'bottom' } } : { id: null, draft: blankRoom() });
    }

    function closeEditor() {
        setEditor(null);
        setSelectedFile(null);
        setPreviewUrl(null);
        setIsDragging(false);
    }

    function handleFile(file: File) {
        if (!file.type.startsWith('image/')) {
            setErrors(prev => ({ ...prev, image: ['File yang dipilih harus berupa gambar (JPG, PNG, WEBP, GIF).'] }));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, image: ['Ukuran gambar maksimal 5 MB.'] }));
            return;
        }
        setErrors(prev => {
            const next = { ...prev };
            delete next.image;
            delete next.image_url;
            return next;
        });
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    }

    function onFileChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }

    function removeImage() {
        setSelectedFile(null);
        setPreviewUrl(null);
        change('image_url', '');
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function change<K extends keyof RoomDraft>(key: K, value: RoomDraft[K]) {
        setEditor(current => current ? { ...current, draft: { ...current.draft, [key]: value } } : null);
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (!editor || busy) return;
        setBusy(true); setError(''); setErrors({});
        const draft = editor.draft;

        try {
            let finalImageUrl = previewUrl ? (draft.image_url || null) : null;
            if (selectedFile) {
                const formData = new FormData();
                formData.append('image', selectedFile);
                const uploadRes = await http.post<{ data: { url: string } }>(
                    api(config, '/admin/rooms/upload-image'),
                    formData,
                    { headers: { 'Content-Type': 'multipart/form-data' } }
                );
                finalImageUrl = uploadRes.data.data.url;
            }

            const payload = {
                name: draft.name,
                type: draft.type,
                capacity: Number(draft.capacity),
                location: draft.location,
                floor: draft.floor,
                rules: draft.rules,
                description: draft.description.trim(),
                is_active: draft.is_active,
                maintenance_notes: draft.maintenance_notes || null,
                image_url: finalImageUrl,
                facility_ids: draft.facility_ids,
                floor_plan: {
                    width: Number(draft.width),
                    depth: Number(draft.depth),
                    desks: Number(draft.desks),
                    door: draft.door
                }
            };

            if (editor.id) await http.put(api(config, `/admin/rooms/${editor.id}`), payload);
            else await http.post(api(config, '/admin/rooms'), payload);

            setSuccess(editor.id ? 'Perubahan ruangan berhasil disimpan.' : 'Ruangan baru berhasil ditambahkan.');
            closeEditor();
            rooms.refresh();
        } catch (reason) {
            const result = adminError(reason);
            setError(result.message);
            setErrors(result.errors);
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!deleting || busy) return;
        setBusy(true); setError('');
        try {
            await http.delete(api(config, `/admin/rooms/${deleting.id}`));
            setSuccess('Ruangan berhasil diarsipkan.');
            setDeleting(null);
            rooms.refresh();
        } catch (reason) {
            setError(adminError(reason).message);
            setDeleting(null);
        } finally {
            setBusy(false);
        }
    }

    const draft = editor?.draft;

    return <div className="rt-page rta-admin-page">
        <div className="rt-page-heading">
            <div>
                <span className="rt-eyebrow">Ruang & fasilitas</span>
                <h2>Kelola ruang, siapkan pertemuan.</h2>
                <p>Atur kapasitas, kelengkapan, dan status setiap ruangan.</p>
            </div>
            <button className="rt-button primary" type="button" onClick={() => openEditor()}><Plus />Tambah ruangan</button>
        </div>
        {!editor ? <Feedback error={error || rooms.error || facilities.error} success={success} /> : null}
        <div className="rta-room-tools">
            <div className="rta-search">
                <Search /><input aria-label="Cari ruangan admin" placeholder="Cari nama atau lokasi ruangan..." value={query} onChange={event => setQuery(event.target.value)} />
            </div>
            <span className="rta-count">{filtered.length} ruangan · {(rooms.data ?? []).filter(room => room.is_active).length} aktif</span>
        </div>
        {rooms.loading && !rooms.data ? <Loading /> : filtered.length ? <div className="rt-grid rt-grid-2">{filtered.map(room => <article key={room.id} className="rt-card">
            <div className="rta-room-cover">{room.image_url ? <img src={room.image_url} alt={room.name} loading="lazy" /> : <Building2 />}</div>
            <div className="rta-room-body">
                <div className="rta-room-title"><div><h3>{room.name}</h3><span className="rt-eyebrow">{room.type === 'booth' ? 'Booth privat' : 'Ruang kerja'}</span></div><span className={`rt-badge ${room.is_active ? 'confirmed' : 'cancelled'}`}>{room.is_active ? 'Aktif' : 'Nonaktif'}</span></div>
                <div className="rta-room-meta"><span><Users />{room.capacity} orang</span><span><MapPin />{room.location} · {room.floor}</span></div>
                {room.description ? <p className="rt-muted">{room.description}</p> : null}
                {!room.is_active && room.maintenance_notes ? <p className="rta-note">Catatan: {room.maintenance_notes}</p> : null}
                <div className="rta-tags">{room.facilities.map(facility => <span className="rta-tag" key={facility.id}>{facility.name}</span>)}</div>
                <div className="rta-card-actions"><button className="rt-button secondary" type="button" onClick={() => openEditor(room)}><Edit3 />Ubah</button><button className="rt-button secondary" type="button" onClick={() => { setError(''); setSuccess(''); setDeleting(room); }}><Trash2 />Arsipkan</button></div>
            </div>
        </article>)}</div> : <Empty title={query ? 'Ruangan tidak ditemukan' : 'Belum ada ruangan'}>{query ? 'Coba gunakan nama atau lokasi lain.' : 'Tambahkan ruangan pertama beserta kapasitas dan fasilitasnya agar penyewa dapat melakukan reservasi.'}</Empty>}
        {editor && draft ? <AdminDialog title={editor.id ? 'Ubah ruangan' : 'Tambah ruangan'} onClose={closeEditor} busy={busy} wide footer={<><button className="rt-button secondary" type="button" disabled={busy} onClick={closeEditor}>Batal</button><button form="admin-room-form" className="rt-button primary" type="submit" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan ruangan'}</button></>}>
            <Feedback error={error || facilities.error} />
            <form id="admin-room-form" onSubmit={save} className="rt-form-grid">
                <Field label="Nama ruangan" htmlFor="room-name" error={errors.name?.[0]}><input id="room-name" value={draft.name} required maxLength={150} onChange={event => change('name', event.target.value)} /></Field>
                <Field label="Jenis ruangan" htmlFor="room-type" error={errors.type?.[0]}><SelectField id="room-type" value={draft.type} onChange={value => change('type', value as RoomDraft['type'])} options={[{ value: 'workspace', label: 'Ruang kerja' }, { value: 'booth', label: 'Booth privat' }]} /></Field>
                <Field label="Kapasitas orang" htmlFor="room-capacity" error={errors.capacity?.[0]}><input id="room-capacity" type="number" min="1" max="1000" value={draft.capacity} required onChange={event => change('capacity', event.target.value)} /></Field>
                <Field label="Lantai" htmlFor="room-floor" error={errors.floor?.[0]}><input id="room-floor" value={draft.floor} required maxLength={80} placeholder="Contoh: Lantai 1" onChange={event => change('floor', event.target.value)} /></Field>
                <Field label="Lokasi" htmlFor="room-location" error={errors.location?.[0]} full><input id="room-location" value={draft.location} required maxLength={200} placeholder="Gedung atau area ruangan" onChange={event => change('location', event.target.value)} /></Field>
                <Field label="Keterangan ruangan" htmlFor="room-description" error={errors.description?.[0]} full><textarea id="room-description" rows={3} maxLength={5000} value={draft.description} required placeholder="Tuliskan keterangan lengkap tentang ruangan ini." onChange={event => change('description', event.target.value)} /></Field>
                <Field label="Aturan penggunaan" htmlFor="room-rules" error={errors.rules?.[0]} full><textarea id="room-rules" rows={3} maxLength={5000} value={draft.rules} required placeholder="Tuliskan ketentuan penggunaan ruangan." onChange={event => change('rules', event.target.value)} /></Field>
                <div className="rt-field rt-field-full">
                    <label htmlFor="room-image-input">Foto ruangan</label>
                    <input
                        ref={fileInputRef}
                        id="room-image-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: 'none' }}
                        onChange={onFileChange}
                    />
                    {previewUrl ? (
                        <div className="rta-image-preview-card">
                            <div className="rta-image-preview-thumb">
                                <img src={previewUrl} alt="Pratinjau foto ruangan" />
                            </div>
                            <div className="rta-image-preview-info">
                                <span className="rta-image-preview-name">
                                    {selectedFile ? selectedFile.name : 'Foto ruangan tersimpan'}
                                </span>
                                <span className="rta-image-preview-hint">
                                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(0)} KB · Siap diunggah saat disimpan` : 'Foto aktif untuk ruangan ini'}
                                </span>
                                <div className="rta-image-preview-actions">
                                    <button
                                        type="button"
                                        className="rt-button secondary"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload aria-hidden="true" />
                                        Ganti foto
                                    </button>
                                    <button
                                        type="button"
                                        className="rt-button secondary"
                                        onClick={removeImage}
                                    >
                                        <Trash2 aria-hidden="true" />
                                        Hapus foto
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={`rta-dropzone ${isDragging ? 'is-dragging' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={e => {
                                e.preventDefault();
                                setIsDragging(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleFile(file);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                        >
                            <div className="rta-dropzone-icon">
                                <ImageIcon aria-hidden="true" />
                            </div>
                            <p className="rta-dropzone-title">
                                <strong>Klik untuk memilih foto</strong> atau seret file ke sini
                            </p>
                            <span className="rta-dropzone-sub">
                                Mendukung format JPG, PNG, WEBP, atau GIF (Maks. 5 MB)
                            </span>
                        </div>
                    )}
                    {errors.image?.[0] ? <p className="rt-field-error">{errors.image[0]}</p> : null}
                    {errors.image_url?.[0] ? <p className="rt-field-error">{errors.image_url[0]}</p> : null}
                </div>
                <div className="rt-field rta-span-2"><label>Fasilitas ruangan</label>{facilities.data?.length ? <div className="rta-checkboxes">{facilities.data.map(facility => <label className="rta-check" key={facility.id}><input type="checkbox" checked={draft.facility_ids.includes(facility.id)} onChange={event => change('facility_ids', event.target.checked ? [...draft.facility_ids, facility.id] : draft.facility_ids.filter(id => id !== facility.id))} />{facility.name}</label>)}</div> : <p className="rta-note">Belum ada fasilitas. Tambahkan melalui menu Fasilitas.</p>}{errors.facility_ids?.[0] ? <p className="field-error">{errors.facility_ids[0]}</p> : null}</div>
                <div className="rta-form-section">Denah skematik</div>
                <Field label="Lebar ruangan (meter)" htmlFor="plan-width" error={errors['floor_plan.width']?.[0]}><input id="plan-width" type="number" min="1" max="100" step="0.1" value={draft.width} required onChange={event => change('width', event.target.value)} /></Field>
                <Field label="Panjang ruangan (meter)" htmlFor="plan-depth" error={errors['floor_plan.depth']?.[0]}><input id="plan-depth" type="number" min="1" max="100" step="0.1" value={draft.depth} required onChange={event => change('depth', event.target.value)} /></Field>
                <Field label="Jumlah meja" htmlFor="plan-desks" error={errors['floor_plan.desks']?.[0]}><input id="plan-desks" type="number" min="0" max="100" value={draft.desks} required onChange={event => change('desks', event.target.value)} /></Field>
                <Field label="Posisi pintu" htmlFor="plan-door" error={errors['floor_plan.door']?.[0]}><SelectField id="plan-door" value={draft.door} onChange={value => change('door', value as RoomDraft['door'])} options={[{ value: 'bottom', label: 'Bawah' }, { value: 'top', label: 'Atas' }, { value: 'left', label: 'Kiri' }, { value: 'right', label: 'Kanan' }]} /></Field>
                <div className="rta-form-section">Status operasional</div>
                <label className="rta-check rta-span-2"><input type="checkbox" checked={draft.is_active} onChange={event => change('is_active', event.target.checked)} />Ruangan aktif dan dapat dipesan</label>
                <Field label="Catatan pemeliharaan / nonaktif (opsional)" htmlFor="room-maintenance" error={errors.maintenance_notes?.[0]} full><textarea id="room-maintenance" rows={2} maxLength={2000} value={draft.maintenance_notes} onChange={event => change('maintenance_notes', event.target.value)} /></Field>
            </form>
        </AdminDialog> : null}
        {deleting ? <ConfirmDialog title="Arsipkan ruangan?" onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} danger label="Arsipkan ruangan"><p><strong>{deleting.name}</strong> tidak akan ditampilkan dalam katalog baru.</p><p>Riwayat dan tiket yang sudah tercatat tetap disimpan. Ruangan dengan reservasi aktif dapat ditolak oleh sistem.</p></ConfirmDialog> : null}
    </div>;
}
