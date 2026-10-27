# RuangTemu: aturan lima modul operasional

## Batas implementasi

Modul ini mencakup katalog/pencarian, pemesanan dan reservasi pelanggan, kendali kehadiran admin, pengelolaan ruangan/fasilitas/pemeliharaan, dan laporan okupansi. Pembayaran, notifikasi email/dalam aplikasi, OTP, IoT, dan integrasi eksternal tidak ditambahkan pada tahap lima modul ini. Pesan hasil aksi di antarmuka bukan sistem notifikasi tersimpan.

## Waktu dan ketersediaan

- Zona waktu operasional adalah `Asia/Jakarta` (dapat diubah melalui `APP_TIMEZONE`). API menerima `date`, `start_time`, dan `end_time`; waktu respons memakai ISO8601.
- Jam operasional 07.00–22.00. Satu reservasi atau blok pemeliharaan berada pada satu tanggal dengan durasi minimal 30 menit.
- Reservasi baru harus dimulai setelah waktu saat ini dan jumlah peserta tidak boleh melebihi kapasitas ruangan aktif.
- Benturan memakai interval setengah terbuka: `start < other_end && end > other_start`. Reservasi yang selesai 10.00 dapat langsung disambung reservasi lain mulai 10.00, tanpa buffer.
- Status `confirmed` dan `checked_in` menahan slot. `cancelled` dan `no_show` melepaskan slot. Blok pemeliharaan juga menutup slot.
- Penulisan reservasi, pemeliharaan, perubahan ruangan, pembatalan, serta kehadiran memakai transaksi dengan kunci baris ruangan yang sama. Pemeriksaan ketersediaan diulang di dalam transaksi; hasil pencarian bukan jaminan slot tetap bebas sebelum penyimpanan.

## Hak akses dan status

- Pelanggan hanya dapat membuat, melihat, dan membatalkan reservasi miliknya sendiri. Admin mempunyai endpoint pengelolaan terpisah dengan gate `access-admin`.
- Pembatalan pelanggan hanya untuk reservasi `confirmed` sebelum jam mulai. Riwayat dan kode tiket tetap tersimpan.
- Admin mencatat check-in mulai jam reservasi sampai tepat 15 menit sesudahnya, dan sebelum jam selesai. Setelah lewat 15 menit, admin dapat menandai `no_show`; penandaan lebih awal ditolak server.
- Check-out hanya untuk reservasi yang sudah check-in. Waktu aktual disimpan, termasuk apabila petugas mencatat check-out setelah jam selesai.
- Penonaktifan/pengarsipan ruangan ditolak selama masih ada reservasi aktif yang belum selesai. Pengurangan kapasitas ditolak jika lebih kecil daripada peserta reservasi aktif.
- Ruangan diarsipkan dengan soft delete sehingga tiket lama tetap dapat menampilkan ruangan. Fasilitas yang masih digunakan ruangan tidak dapat dihapus.
- Rentang pemeliharaan yang bertabrakan dengan reservasi aktif atau blok pemeliharaan lain ditolak.

## Denah

Denah merupakan skema sederhana berdasarkan lebar, kedalaman, jumlah meja, dan sisi pintu yang dapat diatur admin. Ini bukan denah arsitektur berskala survei. Nilai awal bila belum diisi adalah 6 × 4 meter, satu meja, pintu bawah.

## Definisi laporan

- Periode `from` sampai `to` bersifat inklusif, maksimal 366 hari. Filter ruangan bersifat opsional.
- `effective_hours`: waktu pemakaian aktual dari check-in sampai check-out (atau saat ini untuk yang masih check-in), dibatasi jam reservasi dan periode laporan. Waktu setelah akhir reservasi tidak meningkatkan okupansi slot berikutnya.
- `reserved_hours`: durasi terjadwal reservasi `confirmed`, `checked_in`, dan `completed` yang beririsan dengan periode. Pembatalan dan tidak hadir tidak dihitung.
- `available_hours`: durasi operasional 07.00–22.00 selama ruangan aktif, dikurangi blok pemeliharaan. Interval aktivasi/nonaktif disimpan pada `room_status_periods`, sehingga perubahan status sekarang tidak menghapus kapasitas historis. Hari pertama aktivasi dihitung sejak waktu aktivasi, bukan sebelum ruangan tersedia.
- `utilization_rate`: `effective_hours / available_hours × 100%`, dihitung dari detik sebelum pembulatan. Jika tidak ada kapasitas tersedia, hasilnya 0%.
- Jumlah reservasi, pembatalan, dan tidak hadir mengikuti tanggal mulai reservasi dalam periode terpilih.
- Angka jam dan persentase dibulatkan dua desimal. Antarmuka menampilkan jam pemakaian aktual dan jam terjadwal secara terpisah agar definisinya jelas.

## Data awal

Migrasi hanya menambahkan tabel baru. Tidak ada ruangan, fasilitas, reservasi, atau akun contoh yang otomatis dimasukkan ke database aplikasi. Admin memasukkan inventaris nyata melalui halaman pengelolaan.

## Penyiapan admin

1. Pastikan konfigurasi koneksi database lokal benar, kemudian jalankan `php artisan migrate:status`. Terapkan migrasi yang belum dijalankan dengan `php artisan migrate`; tidak perlu menghapus atau membuat ulang database.
2. Gunakan akun admin yang sudah ada. Jika akun admin belum tersedia, jalankan `php artisan account:create admin operator --name="Nama Pengelola"` dengan username baru. Masukkan kata sandi melalui prompt, bukan melalui argumen command atau berkas sumber.
3. Masuk ke `/admin/login`, lalu buka **Fasilitas** untuk menambahkan fasilitas yang benar-benar tersedia.
4. Buka **Ruangan** untuk memasukkan nama, jenis Ruang Kerja/Booth Privat, kapasitas, lokasi, lantai, aturan, fasilitas, serta ukuran/meja/pintu pada denah. Status aktif membuat ruangan tersedia untuk pencarian. URL gambar bersifat opsional; ini bukan fitur unggah gambar.
5. Gunakan **Pemeliharaan** untuk memblokir tanggal serta jam tertentu. Sistem menolak rentang yang berbenturan dengan reservasi aktif atau blok lain. Menghapus blok membuka kembali ketersediaan sesuai reservasi yang masih ada.
6. Gunakan **Semua Reservasi** untuk mencari tanggal, status, ruangan, nama penyewa, atau kode tiket, lalu mencatat check-in/check-out/Tidak Hadir sesuai waktu dan status yang diizinkan server.
7. Pilih periode dan ruangan pada **Laporan**. Jam pemakaian aktual dan jam terjadwal ditampilkan terpisah; penggunaan aktual baru bertambah setelah check-in tercatat.

Menonaktifkan atau mengarsipkan ruangan bukan pengganti blok pemeliharaan. Penonaktifan menutup pencarian baru; blok pemeliharaan menutup rentang waktu tertentu. Batasan reservasi aktif tetap berlaku pada kedua alur.

## Alur pelanggan

1. Daftar atau masuk melalui `/sign-up` atau `/sign-in`. Pembuatan akun admin tidak tersedia di pendaftaran publik.
2. Buka **Cari Ruangan** (`/pelanggan/ruangan`), lalu pilih tanggal, jam mulai/selesai, jumlah orang, jenis ruangan, dan fasilitas yang dibutuhkan. Pencarian dapat ditambah nama atau lokasi.
3. Buka detail untuk membaca kapasitas, lokasi/lantai, fasilitas, aturan, dan denah skematik. Pilih **Pesan** untuk melengkapi keperluan penggunaan.
4. Periksa ringkasan, kemudian konfirmasi. Sistem memeriksa ulang kapasitas, status ruangan, jadwal, dan pemeliharaan saat menyimpan; hasil pencarian sebelumnya tidak menjamin slot tetap tersedia.
5. Simpan atau cetak tiket yang diterbitkan. Tunjukkan kode tiket kepada petugas di lokasi. Pembayaran tetap berlangsung di luar aplikasi.
6. Buka **Reservasi Saya** (`/pelanggan/reservasi`) untuk melihat kelompok Mendatang/Riwayat/Semua, memfilter status, dan membuka tiket kembali.
7. Pembatalan tersedia hanya bila `can_cancel` dari server masih benar. Setelah pembatalan berhasil, reservasi tetap tersimpan sebagai riwayat dan slot kembali dapat dipesan.

## Filter otomatis

Pencarian ruangan pelanggan, daftar reservasi admin, dan laporan okupansi memperbarui hasil saat filter dipilih, tanpa tombol penerapan filter. Pilihan jam/menit pada filter pencarian juga langsung diterapkan; tombol Tutup hanya menutup pemilih waktu. Kolom pencarian teks menunggu 300 ms setelah perubahan terakhir; mengosongkan teks atau menekan Reset langsung mengembalikan filter.

Pencarian menunggu tanggal/jam/jumlah orang yang valid. Laporan menunggu periode lengkap, berurutan, dan maksimal 366 hari. Hasil lama disembunyikan ketika parameter berubah atau tidak valid, dan permintaan yang sudah digantikan tidak dapat menimpa hasil terbaru. Konfirmasi formulir pemesanan serta penyimpanan perubahan admin tetap mengikuti alur masing-masing.

## Endpoint modul

Seluruh endpoint memakai origin aplikasi dan prefix `/api`. Mutasi tetap berada dalam middleware web sehingga sesi dan proteksi CSRF berlaku.

| Akses | Endpoint | Fungsi |
| --- | --- | --- |
| Publik | `GET /api/catalog/rooms`, `GET /api/catalog/rooms/{room}` | Katalog aktif, pencarian ketersediaan, serta detail |
| Publik | `GET /api/catalog/facilities` | Pilihan fasilitas untuk pencarian |
| Pelanggan | `GET/POST /api/customer/reservations` | Daftar milik sendiri dan pembuatan reservasi |
| Pelanggan | `GET /api/customer/reservations/{reservation}` | Tiket milik sendiri |
| Pelanggan | `POST /api/customer/reservations/{reservation}/cancel` | Pembatalan sebelum jam mulai |
| Admin | Resource `/api/admin/rooms`, `/api/admin/facilities` | Daftar, detail, tambah, ubah, dan hapus/arsip |
| Admin | `GET/POST /api/admin/maintenance`, `DELETE /api/admin/maintenance/{maintenance}` | Pengelolaan blok pemeliharaan |
| Admin | `GET /api/admin/reservations` | Daftar serta filter seluruh reservasi |
| Admin | `POST /api/admin/reservations/{reservation}/check-in`, `/check-out`, `/no-show` | Kendali kehadiran |
| Admin | `GET /api/admin/reports` | Laporan periode serta filter ruangan |
| Akun masuk | `GET /api/workspace/summary` | Ringkasan sesuai peran; data pelanggan dibatasi pada pemiliknya |

## Verifikasi pengembangan

Jalankan dari direktori proyek:

```powershell
php artisan migrate:status
php artisan route:list --path=api
npx tsc --noEmit
npm run build
php artisan test
```

`php artisan test` menggunakan database SQLite `:memory:` untuk tes autentikasi dan alur reservasi, bukan database MySQL aplikasi. Pengujian tidak memerlukan seeder data aplikasi. Jangan memakai `migrate:fresh`, `migrate:refresh`, atau seeder akun terhadap database lokal yang sudah digunakan.

Pemeriksaan antarmuka perlu mencakup desktop dan mobile: admin menambahkan fasilitas/ruangan, pelanggan mencari serta memesan, tiket tersimpan, pembatalan membuka slot, dan admin mencatat kehadiran. Gunakan database pengujian terpisah untuk data uji dan jangan mengisi inventaris nyata dengan ruangan fiktif untuk sekadar membuat tampilan terlihat berisi.
