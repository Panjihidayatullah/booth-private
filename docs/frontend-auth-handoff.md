# RuangTemu: frontend dan autentikasi

## Lokasi dan stack

Pengerjaan berada langsung di `C:/laragon/www/booth-private`. URL halaman, foto, dan endpoint dibuat oleh Laravel; frontend tidak mengunci host atau lokasi worktree. `apiBaseUrl` juga disediakan Laravel untuk endpoint modul operasional.

Laravel 12 melayani React TypeScript melalui Vite dan Tailwind CSS yang sudah ada. Warna serta font mengikuti referensi HTML: lime `#A3E615`, forest `#1C362B`, `#1B4333`, dan Plus Jakarta Sans. Foto pengguna di `public/images/booth.avif` mengisi hero sampai tepi layar pada desktop dan mobile. Bagian lain tetap menggunakan layout kartu sesuai desain yang disetujui.

## Akun terpisah

| Jenis akun | Tabel | Model | Guard | Halaman login | Identitas login |
| --- | --- | --- | --- | --- | --- |
| Pelanggan | `users` | `User` | `web` | `/sign-in` | Username atau email |
| Administrator | `admins` | `Admin` | `admin` | `/admin/login` | Username |

Admin bukan baris pelanggan dengan role berbeda. Akun admin tidak dibuat oleh sign up publik, tidak dipindahkan dari tabel pelanggan, dan tidak diperiksa menggunakan provider pelanggan. Nilai role pada respons frontend hanya label jenis akun yang dihitung dari model, bukan sumber izin dari input pengguna.

Halaman login pelanggan dan admin mempunyai URL serta endpoint berbeda, tanpa pemilih peran. Server menentukan tabel dan guard berdasarkan endpoint; input `account_type` maupun `role` ditolak. Halaman admin tidak menyediakan sign up. Tamu yang membuka panel admin diarahkan ke `/admin/login`; halaman pelanggan mengarah ke `/sign-in`. Setelah login berhasil, sesi guard lainnya diakhiri. Logout mengakhiri keduanya. Pelanggan tidak dapat mengakses halaman admin meskipun ID atau username pada kedua tabel sama.

Sign up publik menerima nama, username, email opsional, dan kata sandi dengan konfirmasi. Username dinormalisasi menjadi huruf kecil. Email pelanggan dapat kosong sehingga sistem tidak mengarang alamat email untuk akun berbasis username. Kata sandi pendaftaran publik tetap minimal sesuai `config/auth.php`.

## Database dan pembuatan akun

- `2026_10_18_000000_add_username_to_users_table.php` menambah username unik yang nullable pada pelanggan serta menjadikan email opsional. Ini mempertahankan akun dan email lama.
- `2026_10_18_000001_create_admins_table.php` membuat tabel akun admin terpisah.
- Rencana lama menambahkan role pada tabel pelanggan tidak diterapkan dan sudah diganti dengan dua migrasi tersebut.

Jangan menjalankan `migrate:fresh`, reset, atau seeder untuk penyiapan akun ini. Periksa status migrasi terlebih dahulu. Setelah skema siap, perintah `account:create` menerima jenis akun, username, nama, serta email pelanggan opsional. Kata sandi dimasukkan melalui prompt tersembunyi, di-hash oleh model, lalu diverifikasi melalui provider login sebelum transaksi selesai. Akun yang sudah ada tidak ditimpa oleh perintah ini.

Opsi `--test-account` hanya berlaku pada lingkungan local/testing dan mengizinkan kata sandi uji pendek yang diminta secara eksplisit. Opsi ini tidak menurunkan aturan kata sandi sign up publik dan tidak dapat dipakai pada lingkungan production. Tidak ada kata sandi akun yang disimpan dalam sumber, seeder, atau dokumen ini.

## Endpoint autentikasi

Endpoint berada di middleware web dengan prefix `api/auth`, sehingga sesi dan CSRF berlaku pada frontend dengan origin yang sama. Axios menggunakan cookie XSRF Laravel; token akses tidak disimpan di localStorage.

| Metode | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/auth/session` | Identitas akun aktif atau null |
| POST | `/api/auth/sign-up` | Membuat akun pelanggan dan sesi |
| POST | `/api/auth/sign-in` | Login pelanggan: `login` berisi username/email, `password`, serta remember opsional |
| POST | `/api/auth/admin/sign-in` | Login admin: `login` berisi username, `password`, serta remember opsional |
| POST | `/api/auth/sign-out` | Mengakhiri sesi pelanggan dan admin |

## Batas tahap ini

Landing page, sign in/sign up, sesi, halaman identitas pelanggan, navigasi panel pelanggan/admin, dan logout telah diimplementasikan. Lima modul operasional sekarang tersambung ke database dan API:

1. Katalog serta pencarian ruangan berdasarkan jadwal, kapasitas, jenis, fasilitas, nama, dan lokasi; detail memuat aturan serta denah skematik.
2. Pemesanan pelanggan, pemeriksaan ulang ketersediaan, penerbitan tiket, daftar mendatang/riwayat, dan pembatalan sebelum jam mulai.
3. Daftar reservasi admin beserta filter, check-in, check-out, dan penandaan Tidak Hadir dengan batas waktu di server.
4. Pengelolaan ruangan/fasilitas, aktivasi/nonaktif, pengarsipan aman, serta blokir pemeliharaan yang memeriksa benturan.
5. Ringkasan serta laporan pemakaian aktual, jam terjadwal, kapasitas operasional, pembatalan, Tidak Hadir, dan filter periode/ruangan.

Tidak ada ruangan, fasilitas, tiket, atau statistik simulasi yang ditanam di frontend maupun otomatis dimasukkan ke database aplikasi. Pengelola mengisi inventaris nyata. Migrasi modul operasional hanya menambah tabel, tanpa menghapus akun atau data lama. Status kosong pada antarmuka berarti belum ada data yang sesuai, bukan modul yang belum diaktifkan.

Pembayaran, notifikasi email/dalam aplikasi, OTP, IoT, dan integrasi eksternal tidak termasuk tahap lima modul yang diminta ini. Definisi perhitungan, aturan waktu, endpoint, alur penggunaan, dan cara verifikasi dijelaskan dalam [aturan modul operasional](business-rules.md).

## Menyiapkan dan menggunakan modul

Periksa koneksi database di lingkungan lokal dan status migrasi, lalu jalankan migrasi tambahan bila masih ada yang pending:

```powershell
php artisan migrate:status
php artisan migrate
```

Jangan menggunakan `migrate:fresh`, `migrate:refresh`, atau menjalankan seeder akun untuk memperbarui proyek yang sudah berisi akun. Jika belum memiliki akun admin, gunakan perintah interaktif berikut dengan username baru; kata sandi diminta melalui prompt tersembunyi:

```powershell
php artisan account:create admin operator --name="Nama Pengelola"
```

Masuk melalui `/admin/login`, tambahkan fasilitas pada `/admin/fasilitas`, lalu tambahkan ruangan aktif beserta kapasitas, lokasi/lantai, aturan, fasilitas, dan denah pada `/admin/ruangan`. Data ruangan aktif akan tampil di katalog publik dan pencarian pelanggan. Pengelola menangani jadwal pemeliharaan melalui `/admin/pemeliharaan`, reservasi serta kehadiran melalui `/admin/reservasi`, dan laporan melalui `/admin/laporan`.

Pelanggan mendaftar atau masuk melalui `/sign-up` dan `/sign-in`, memilih jadwal di `/pelanggan/ruangan`, membuka detail, melengkapi keperluan, memeriksa ringkasan, lalu mengonfirmasi. Tiket berasal dari reservasi yang benar-benar tersimpan. `/pelanggan/reservasi` menyediakan tiket, cetak, riwayat, dan pembatalan yang masih diizinkan server.

## Berkas utama

- `resources/js/pages/`: landing, formulir akun, serta shell pelanggan/admin.
- `resources/js/components/`: merek dan drawer bersama.
- `resources/js/features/reservations/`: katalog, pencarian/pemesanan pelanggan, reservasi, modul admin, denah, tiket, dan ringkasan.
- `resources/js/lib/http.ts`: request serta pesan kegagalan yang aman.
- `resources/css/app.css`: tema dan responsivitas bersama.
- `app/Models/User.php` dan `app/Models/Admin.php`: akun dengan tabel/provider masing-masing.
- `app/Http/Controllers/AuthController.php`: autentikasi dua guard dan sesi.
- `app/Http/Controllers/`: endpoint katalog, ruangan, fasilitas, reservasi, pemeliharaan, dan laporan.
- `app/Services/ReservationService.php`: validasi jadwal serta perubahan reservasi dalam transaksi dengan kunci ruangan.
- `app/Services/OccupancyReportService.php`: penghitungan okupansi berdasarkan periode aktif ruangan, pemeliharaan, dan kehadiran.
- `config/reservations.php`: jam operasional, durasi minimal, zona waktu, dan toleransi keterlambatan.
- `app/Http/Requests/`: normalisasi serta validasi server.
- `app/Console/Commands/CreateAccount.php`: pembuatan akun tanpa menaruh kata sandi di argumen command.
- `routes/web.php`: halaman, autentikasi, katalog publik, API pelanggan, dan API admin.

## Pemeriksaan

```powershell
npx tsc --noEmit
npm run build
php artisan test
```

Pengujian autentikasi dan alur reservasi mengatur SQLite dalam memori sebelum migrasi; akun dan ruangan sintetis pengujian tidak dimasukkan ke database proyek. Pemeriksaan autentikasi mencakup pemisahan tabel/guard walau ID dan username sama, pembatasan login, CSRF, penolakan signup admin, kerahasiaan respons, serta pencegahan penimpaan akun. Pengujian modul operasional mencakup pencarian, transaksi reservasi, jadwal beruntun, benturan, kapasitas, kepemilikan tiket, pembatalan, kehadiran, pemeliharaan, pengarsipan, dan hasil laporan.

Keberhasilan pemeriksaan kode tidak menggantikan pemeriksaan visual desktop/mobile.
