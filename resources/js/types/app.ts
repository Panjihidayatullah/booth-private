export interface Account {
    id: number;
    name: string;
    username: string | null;
    email: string | null;
    role: 'user' | 'admin';
}

export interface NavigationLink {
    href: string;
    label: string;
    active?: boolean;
}

export interface AppConfig {
    page: 'landing' | 'signin' | 'admin-signin' | 'signup' | 'workspace';
    portal: 'customer' | 'admin' | null;
    section: string;
    heroImageUrl: string;
    user: Account | null;
    passwordPolicy: { minLength: number; maxLength: number };
    usernamePolicy: { minLength: number; maxLength: number };
    urls: {
        home: string;
        login: string;
        adminLogin: string;
        register: string;
        dashboard: string;
        auth: { login: string; adminLogin: string; register: string; logout: string; session: string };
        customer: { home: string; rooms: string; bookings: string; account: string };
        admin: { home: string; rooms: string; facilities: string; reservations: string; maintenance: string; reports: string };
    };
}
