import axios from 'axios';

const REQUEST_TIMEOUT_MS = 15000;

export const http = axios.create({
    timeout: REQUEST_TIMEOUT_MS,
    withCredentials: true,
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
});

export interface ValidationErrors {
    [field: string]: string[];
}

export function describeRequestError(error: unknown): { message: string; errors: ValidationErrors } {
    if (!axios.isAxiosError<{ message?: string; errors?: ValidationErrors }>(error)) {
        return { message: 'Permintaan belum dapat diproses. Silakan coba lagi.', errors: {} };
    }

    const status = error.response?.status;

    if (status === 422) {
        return { message: 'Periksa kembali isian formulir.', errors: error.response?.data?.errors ?? {} };
    }

    if (status === 419) {
        return { message: 'Sesi halaman sudah berakhir. Muat ulang halaman, lalu coba kembali.', errors: {} };
    }

    if (status === 429) {
        return { message: 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba kembali.', errors: {} };
    }

    if (!error.response) {
        return { message: 'Koneksi belum berhasil. Periksa koneksi, lalu coba kembali.', errors: {} };
    }

    return { message: 'Layanan belum dapat diakses. Silakan coba lagi.', errors: {} };
}
