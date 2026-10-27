export interface Facility {
    id: number;
    name: string;
    description?: string | null;
    rooms_count?: number;
}

export interface Room {
    id: number;
    name: string;
    type: 'workspace' | 'booth';
    capacity: number;
    location: string;
    floor: string;
    rules: string;
    description?: string | null;
    is_active: boolean;
    maintenance_notes?: string | null;
    image_url?: string | null;
    floor_plan: { width: number; depth: number; desks: number; door: 'top' | 'right' | 'bottom' | 'left' };
    facilities: Facility[];
    availability?: { available: boolean; reason?: string | null };
}

export type ReservationStatus = 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';

export interface Reservation {
    id: number;
    code: string;
    user_id: number;
    room_id: number;
    purpose: string;
    attendees: number;
    starts_at: string;
    ends_at: string;
    status: ReservationStatus;
    checked_in_at?: string | null;
    checked_out_at?: string | null;
    cancelled_at?: string | null;
    no_show_at?: string | null;
    room: Room;
    user?: { id: number; name: string; username?: string | null; email?: string | null };
    can_cancel: boolean;
    allowed_actions: string[];
    created_at?: string;
}

export interface BookingValues {
    date: string;
    start_time: string;
    end_time: string;
    attendees: number;
    purpose: string;
}

export interface Maintenance {
    id: number;
    room_id: number;
    room: Room;
    starts_at: string;
    ends_at: string;
    reason: string;
}
