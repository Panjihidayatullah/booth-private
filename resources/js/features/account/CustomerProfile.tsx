import { useState } from 'react';
import { Check, Edit3, Eye, EyeOff, LoaderCircle, Mail, Shield, UserRound, X } from 'lucide-react';
import { describeRequestError, http, type ValidationErrors } from '../../lib/http';
import type { Account, AppConfig } from '../../types/app';

interface CustomerProfileProps {
    config: AppConfig;
    user: Account | null;
    onUserUpdated: (user: Account) => void;
    logoutButton: React.ReactNode;
}

export default function CustomerProfile({ config, user, onUserUpdated, logoutButton }: CustomerProfileProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user?.name ?? '');
    const [username, setUsername] = useState(user?.username ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
    const [successMessage, setSuccessMessage] = useState('');

    function openEditMode() {
        setName(user?.name ?? '');
        setUsername(user?.username ?? '');
        setEmail(user?.email ?? '');
        setPassword('');
        setPasswordConfirmation('');
        setErrorMessage('');
        setFieldErrors({});
        setIsEditing(true);
    }

    function cancelEdit() {
        setName(user?.name ?? '');
        setUsername(user?.username ?? '');
        setEmail(user?.email ?? '');
        setPassword('');
        setPasswordConfirmation('');
        setErrorMessage('');
        setFieldErrors({});
        setIsEditing(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSaving(true);
        setErrorMessage('');
        setFieldErrors({});

        try {
            const payload: Record<string, string | null> = {
                name: name.trim(),
                username: username.trim(),
                email: email.trim() ? email.trim() : null,
            };

            if (password) {
                payload.password = password;
                payload.password_confirmation = passwordConfirmation;
            }

            const response = await http.put<{ message: string; user: Account }>(
                `${config.apiBaseUrl}/customer/profile`,
                payload
            );

            onUserUpdated(response.data.user);
            setSuccessMessage(response.data.message || 'Profil berhasil diperbarui.');
            setPassword('');
            setPasswordConfirmation('');
            setIsEditing(false);

            // Auto dismiss success message after 6 seconds
            setTimeout(() => {
                setSuccessMessage('');
            }, 6000);
        } catch (err) {
            const { message, errors } = describeRequestError(err);
            setErrorMessage(message);
            setFieldErrors(errors);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <section className="profile-panel" aria-labelledby="profile-title">
            {successMessage ? (
                <div className="form-alert form-alert-success profile-alert" role="status">
                    <Check aria-hidden="true" />
                    <span>{successMessage}</span>
                </div>
            ) : null}

            {!isEditing ? (
                <>
                    <div className="profile-header">
                        <div className="profile-avatar-row">
                            <span className="auth-icon">
                                <UserRound aria-hidden="true" />
                            </span>
                            <div>
                                <h2 id="profile-title">Informasi akunmu</h2>
                                <span className="profile-type-badge">
                                    <Shield aria-hidden="true" /> Akun Pelanggan
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="button button-lime profile-edit-btn"
                            onClick={openEditMode}
                        >
                            <Edit3 aria-hidden="true" />
                            <span>Edit Profil</span>
                        </button>
                    </div>

                    {!user?.email ? (
                        <div className="profile-email-alert" role="region" aria-label="Pemberitahuan email">
                            <div className="profile-email-alert-content">
                                <Mail className="profile-email-alert-icon" aria-hidden="true" />
                                <div>
                                    <strong>Alamat email belum diisi</strong>
                                    <p>
                                        Tambahkan email agar tiket PDF reservasi dan notifikasi kedatangan dapat terkirim otomatis ke kotak masukmu.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="button button-lime profile-email-alert-btn"
                                onClick={openEditMode}
                            >
                                Lengkapi Email
                            </button>
                        </div>
                    ) : null}

                    <dl className="profile-data-list">
                        <div>
                            <dt>Nama lengkap</dt>
                            <dd>{user?.name}</dd>
                        </div>
                        <div>
                            <dt>Username</dt>
                            <dd className="profile-mono-val">{user?.username ?? 'Belum diisi'}</dd>
                        </div>
                        <div>
                            <dt>Alamat email</dt>
                            <dd>
                                {user?.email ? (
                                    <span className="profile-email-connected">
                                        <span>{user.email}</span>
                                        <span className="profile-chip-active">
                                            <Check aria-hidden="true" /> Terhubung
                                        </span>
                                    </span>
                                ) : (
                                    <span className="profile-val-empty">Belum diisi</span>
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt>Jenis akun</dt>
                            <dd>{user?.role === 'admin' ? 'Administrator' : 'Pelanggan'}</dd>
                        </div>
                    </dl>

                    <div className="profile-footer-actions">
                        <button
                            type="button"
                            className="button button-outline profile-edit-btn"
                            onClick={openEditMode}
                        >
                            <Edit3 aria-hidden="true" />
                            <span>Ubah informasi</span>
                        </button>
                        {logoutButton}
                    </div>
                </>
            ) : (
                <>
                    <div className="profile-header">
                        <div className="profile-avatar-row">
                            <span className="auth-icon">
                                <UserRound aria-hidden="true" />
                            </span>
                            <div>
                                <h2 id="profile-title">Edit Profil Akun</h2>
                                <p className="profile-subtitle">
                                    Perbarui nama, username, email untuk tiket, atau kata sandi akunmu.
                                </p>
                            </div>
                        </div>
                    </div>

                    {errorMessage ? (
                        <div className="form-alert" role="alert">
                            {errorMessage}
                        </div>
                    ) : null}

                    <form onSubmit={handleSubmit} className="profile-form" noValidate>
                        <div className="form-field">
                            <label htmlFor="profile-name">
                                Nama lengkap <span className="field-required">*</span>
                            </label>
                            <input
                                id="profile-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                maxLength={150}
                                disabled={isSaving}
                                placeholder="Masukkan nama lengkap"
                                aria-invalid={Boolean(fieldErrors.name)}
                            />
                            {fieldErrors.name?.[0] ? (
                                <p className="field-error">{fieldErrors.name[0]}</p>
                            ) : null}
                        </div>

                        <div className="form-field">
                            <label htmlFor="profile-username">
                                Username <span className="field-required">*</span>
                            </label>
                            <input
                                id="profile-username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                minLength={config.usernamePolicy?.minLength ?? 3}
                                maxLength={config.usernamePolicy?.maxLength ?? 50}
                                disabled={isSaving}
                                placeholder="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                aria-invalid={Boolean(fieldErrors.username)}
                            />
                            <p className="field-hint">
                                Minimal {config.usernamePolicy?.minLength ?? 3} karakter. Huruf kecil, angka, titik, dan tanda hubung.
                            </p>
                            {fieldErrors.username?.[0] ? (
                                <p className="field-error">{fieldErrors.username[0]}</p>
                            ) : null}
                        </div>

                        <div className="form-field">
                            <label htmlFor="profile-email">
                                Alamat email <span className="optional-label">(Disarankan untuk tiket &amp; notifikasi)</span>
                            </label>
                            <input
                                id="profile-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isSaving}
                                placeholder="contoh@domain.com"
                                autoCapitalize="none"
                                spellCheck={false}
                                aria-invalid={Boolean(fieldErrors.email)}
                            />
                            <p className="field-hint">
                                Digunakan untuk pengiriman tiket PDF reservasi dan notifikasi status check-in otomatis.
                            </p>
                            {fieldErrors.email?.[0] ? (
                                <p className="field-error">{fieldErrors.email[0]}</p>
                            ) : null}
                        </div>

                        <div className="profile-security-box">
                            <div className="profile-security-header">
                                <span className="eyebrow">Keamanan Akun</span>
                                <h4>Ubah Kata Sandi (Opsional)</h4>
                                <p className="field-hint">Kosongkan jika kamu tidak ingin mengganti kata sandi.</p>
                            </div>

                            <div className="form-field password-field">
                                <label htmlFor="profile-password">
                                    Kata sandi baru <span className="optional-label">(opsional)</span>
                                </label>
                                <input
                                    id="profile-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    minLength={config.passwordPolicy?.minLength ?? 8}
                                    maxLength={config.passwordPolicy?.maxLength ?? 128}
                                    disabled={isSaving}
                                    placeholder="Minimal 8 karakter"
                                    aria-invalid={Boolean(fieldErrors.password)}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                                >
                                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                                </button>
                                {fieldErrors.password?.[0] ? (
                                    <p className="field-error">{fieldErrors.password[0]}</p>
                                ) : null}
                            </div>

                            {password ? (
                                <div className="form-field password-field">
                                    <label htmlFor="profile-password-confirm">
                                        Konfirmasi kata sandi baru <span className="field-required">*</span>
                                    </label>
                                    <input
                                        id="profile-password-confirm"
                                        type={showPasswordConfirm ? 'text' : 'password'}
                                        value={passwordConfirmation}
                                        onChange={(e) => setPasswordConfirmation(e.target.value)}
                                        required
                                        disabled={isSaving}
                                        placeholder="Ulangi kata sandi baru"
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                        aria-label={showPasswordConfirm ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                                    >
                                        {showPasswordConfirm ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        <div className="profile-form-buttons">
                            <button
                                type="submit"
                                className="button button-lime"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <LoaderCircle className="loading-icon" aria-hidden="true" />
                                ) : (
                                    <Check aria-hidden="true" />
                                )}
                                <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                            </button>
                            <button
                                type="button"
                                className="button button-outline"
                                onClick={cancelEdit}
                                disabled={isSaving}
                            >
                                <X aria-hidden="true" />
                                <span>Batal</span>
                            </button>
                        </div>
                    </form>
                </>
            )}
        </section>
    );
}
