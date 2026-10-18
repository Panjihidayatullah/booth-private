import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import Brand from '../components/Brand';
import { describeRequestError, http, type ValidationErrors } from '../lib/http';
import type { AppConfig } from '../types/app';

interface AuthPageProps {
    config: AppConfig;
}

export default function AuthPage({ config }: AuthPageProps) {
    const isSignUp = config.page === 'signup';
    const isAdminLogin = config.page === 'admin-signin';
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [message, setMessage] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (isSubmitting) return;

        const form = new FormData(event.currentTarget);
        const password = String(form.get('password') ?? '');
        const confirmation = String(form.get('password_confirmation') ?? '');
        setErrors({});
        setMessage('');

        if (isSignUp && password !== confirmation) {
            setErrors({ password_confirmation: ['Konfirmasi kata sandi belum cocok.'] });
            return;
        }

        setIsSubmitting(true);

        try {
            const credentials = { password };
            const payload = isSignUp
                ? { ...credentials, name: String(form.get('name') ?? ''), username: String(form.get('username') ?? ''), email: String(form.get('email') ?? ''), password_confirmation: confirmation }
                : { ...credentials, login: String(form.get('login') ?? ''), remember: form.get('remember') === 'on' };
            const endpoint = isSignUp ? config.urls.auth.register : isAdminLogin ? config.urls.auth.adminLogin : config.urls.auth.login;
            const { data } = await http.post<{ redirect: string }>(endpoint, payload);
            window.location.assign(data.redirect);
        } catch (error) {
            const result = describeRequestError(error);
            setErrors(result.errors);
            setMessage(result.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    function fieldError(field: string) {
        return errors[field]?.[0];
    }

    return (
        <main className="auth-layout">
            <section className="auth-visual" aria-label="Ruang kerja RuangTemu">
                <img src={config.heroImageUrl} alt="Area booth dengan meja dan sofa di dekat jendela" width="1170" height="780" />
                <div className="auth-visual-content">
                    <Brand href={config.urls.home} light />
                    <div>
                        <span className="tag-pill tag-pill-inverse">Ruang untuk setiap rencana</span>
                        <h2>Ide yang baik<br />butuh ruang<br /><span>yang tepat.</span></h2>
                        <p>Mulai langkahmu menuju ruang kerja yang lebih tertata.</p>
                    </div>
                    <span className="auth-visual-caption">RuangTemu · Ruang kerja & booth privat</span>
                </div>
            </section>
            <section className="auth-form-panel" aria-labelledby="auth-title">
                <a className="back-link" href={config.urls.home}><ArrowLeft aria-hidden="true" />Kembali ke Home</a>
                <div className="auth-form-container">
                    <span className="auth-icon"><LockKeyhole aria-hidden="true" /></span>
                    <span className="eyebrow">{isSignUp ? 'Mulai bersama RuangTemu' : isAdminLogin ? 'Administrator RuangTemu' : 'Selamat datang kembali'}</span>
                    <h1 id="auth-title">{isSignUp ? 'Buat akunmu.' : isAdminLogin ? 'Masuk ke panel admin.' : 'Masuk ke akunmu.'}</h1>
                    <p className="auth-intro">{isSignUp ? 'Daftarkan akun pelanggan untuk mulai merencanakan penggunaan ruang.' : isAdminLogin ? 'Gunakan akun admin untuk mengakses panel pengelolaan.' : 'Sign in untuk melanjutkan aktivitas dan mengakses ruangmu.'}</p>
                    {!isAdminLogin ? <div className="auth-tabs" aria-label="Pilihan halaman akun">
                        <a href={config.urls.login} aria-current={!isSignUp ? 'page' : undefined}>Sign in</a>
                        <a href={config.urls.register} aria-current={isSignUp ? 'page' : undefined}>Sign up</a>
                    </div> : null}
                    {message ? <div className="form-alert" role="alert">{message}</div> : null}
                    <form className="auth-form" onSubmit={handleSubmit}>
                        {isSignUp ? (
                            <>
                            <div className="form-field">
                                <label htmlFor="name">Nama lengkap</label>
                                <input id="name" name="name" autoComplete="name" required maxLength={255} aria-invalid={Boolean(fieldError('name'))} aria-describedby={fieldError('name') ? 'name-error' : undefined} disabled={isSubmitting} />
                                {fieldError('name') ? <p id="name-error" className="field-error">{fieldError('name')}</p> : null}
                            </div>
                            <div className="form-field">
                                <label htmlFor="username">Username</label>
                                <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={config.usernamePolicy.minLength} maxLength={config.usernamePolicy.maxLength} aria-invalid={Boolean(fieldError('username'))} aria-describedby={fieldError('username') ? 'username-error' : undefined} disabled={isSubmitting} />
                                {fieldError('username') ? <p id="username-error" className="field-error">{fieldError('username')}</p> : null}
                            </div>
                        <div className="form-field">
                            <label htmlFor="email">Alamat email <span className="optional-label">(opsional)</span></label>
                            <input id="email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={255} aria-invalid={Boolean(fieldError('email'))} aria-describedby={fieldError('email') ? 'email-error' : undefined} disabled={isSubmitting} />
                            {fieldError('email') ? <p id="email-error" className="field-error">{fieldError('email')}</p> : null}
                        </div>
                            </>
                        ) : (
                            <div className="form-field">
                                <label htmlFor="login">{isAdminLogin ? 'Username admin' : 'Username atau email'}</label>
                                <input id="login" name="login" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={255} aria-invalid={Boolean(fieldError('login'))} aria-describedby={fieldError('login') ? 'login-error' : undefined} disabled={isSubmitting} />
                                {fieldError('login') ? <p id="login-error" className="field-error">{fieldError('login')}</p> : null}
                            </div>
                        )}
                        <div className="form-field">
                            <label htmlFor="password">Kata sandi</label>
                            <div className="password-field">
                                <input id="password" name="password" type={isPasswordVisible ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} required minLength={isSignUp ? config.passwordPolicy.minLength : undefined} maxLength={config.passwordPolicy.maxLength} aria-invalid={Boolean(fieldError('password'))} aria-describedby={fieldError('password') ? 'password-error' : isSignUp ? 'password-hint' : undefined} disabled={isSubmitting} />
                                <button type="button" className="password-toggle" onClick={() => setIsPasswordVisible((visible) => !visible)} aria-label={isPasswordVisible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={isPasswordVisible}>{isPasswordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
                            </div>
                            {fieldError('password') ? <p id="password-error" className="field-error">{fieldError('password')}</p> : isSignUp ? <p id="password-hint" className="field-hint">Minimal {config.passwordPolicy.minLength} karakter.</p> : null}
                        </div>
                        {isSignUp ? (
                            <div className="form-field">
                                <label htmlFor="password_confirmation">Konfirmasi kata sandi</label>
                                <input id="password_confirmation" name="password_confirmation" type={isPasswordVisible ? 'text' : 'password'} autoComplete="new-password" required maxLength={config.passwordPolicy.maxLength} aria-invalid={Boolean(fieldError('password_confirmation'))} aria-describedby={fieldError('password_confirmation') ? 'confirmation-error' : undefined} disabled={isSubmitting} />
                                {fieldError('password_confirmation') ? <p id="confirmation-error" className="field-error">{fieldError('password_confirmation')}</p> : null}
                            </div>
                        ) : <label className="checkbox-label"><input type="checkbox" name="remember" disabled={isSubmitting} />Ingat saya</label>}
                        <button className="button button-lime auth-submit" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <><LoaderCircle className="loading-icon" aria-hidden="true" />Memproses...</> : <>{isSignUp ? 'Buat Akun' : 'Sign in'}<ArrowUpRight aria-hidden="true" /></>}
                        </button>
                    </form>
                    {!isAdminLogin ? <p className="auth-switch">{isSignUp ? 'Sudah punya akun?' : 'Belum punya akun?'} <a href={isSignUp ? config.urls.login : config.urls.register}>{isSignUp ? 'Sign in' : 'Sign up'}</a></p> : null}
                </div>
                <p className="auth-panel-footer">Ruang untuk bertemu. Waktu untuk fokus.</p>
            </section>
        </main>
    );
}
