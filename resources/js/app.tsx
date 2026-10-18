import './bootstrap';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import WorkspacePage from './pages/WorkspacePage';
import type { AppConfig } from './types/app';

const appElement = document.getElementById('app');

if (appElement) {
    try {
        const config: AppConfig = JSON.parse(appElement.dataset.config ?? '');
        if (!config.heroImageUrl || !config.urls?.home) throw new Error('Konfigurasi halaman tidak lengkap.');
        const page = config.page === 'signin' || config.page === 'admin-signin' || config.page === 'signup'
            ? <AuthPage config={config} />
            : config.page === 'workspace'
                ? <WorkspacePage config={config} />
                : <LandingPage config={config} />;
        createRoot(appElement).render(
            <StrictMode>
                {page}
            </StrictMode>,
        );
    } catch {
        appElement.textContent = 'Halaman belum dapat ditampilkan. Silakan muat ulang.';
    }
}
