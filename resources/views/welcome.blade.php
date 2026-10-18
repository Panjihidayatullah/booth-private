<!DOCTYPE html>
<html lang="id">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="RuangTemu membantu merencanakan kebutuhan ruang kerja dan booth privat. Kenali jenis ruang dan alur reservasi dalam satu tempat.">
        <meta name="theme-color" content="#ffffff">
        <title>RuangTemu — Ruang Kerja &amp; Booth Privat</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    </head>
    <body>
        @php
            $frontendConfig = [
                'page' => $page ?? 'landing',
                'portal' => $portal ?? null,
                'section' => $section ?? 'home',
                'heroImageUrl' => asset('images/booth.avif'),
                'user' => (auth('admin')->user() ?? auth('web')->user())?->publicProfile(),
                'passwordPolicy' => ['minLength' => config('auth.password_policy.min_length'), 'maxLength' => config('auth.password_policy.max_length')],
                'usernamePolicy' => ['minLength' => config('auth.username_policy.min_length'), 'maxLength' => config('auth.username_policy.max_length')],
                'urls' => [
                    'home' => route('home'), 'login' => route('login'), 'adminLogin' => route('admin.login'), 'register' => route('register'), 'dashboard' => route('dashboard'),
                    'auth' => ['login' => route('auth.login'), 'adminLogin' => route('auth.adminLogin'), 'register' => route('auth.register'), 'logout' => route('auth.logout'), 'session' => route('auth.session')],
                    'customer' => ['home' => route('customer.home'), 'rooms' => route('customer.rooms'), 'bookings' => route('customer.bookings'), 'account' => route('customer.account')],
                    'admin' => ['home' => route('admin.home'), 'rooms' => route('admin.rooms'), 'facilities' => route('admin.facilities'), 'reservations' => route('admin.reservations'), 'maintenance' => route('admin.maintenance'), 'reports' => route('admin.reports')],
                ],
            ];
        @endphp
        <div id="app" data-config="{{ json_encode($frontendConfig, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}"></div>
        <noscript>
            <p class="noscript-message">Aktifkan JavaScript untuk membuka halaman RuangTemu.</p>
        </noscript>
    </body>
</html>
