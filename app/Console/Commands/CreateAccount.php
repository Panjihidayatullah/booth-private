<?php

namespace App\Console\Commands;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CreateAccount extends Command
{
    protected $signature = 'account:create
        {type : user atau admin}
        {username : Username akun baru}
        {--name= : Nama lengkap pemilik akun}
        {--email= : Email pelanggan, opsional}
        {--test-account : Izinkan kata sandi uji pendek hanya pada lingkungan lokal/pengujian}';

    protected $description = 'Membuat akun pelanggan atau admin pada tabel terpisah dengan input kata sandi tersembunyi';

    public function handle(): int
    {
        $type = $this->argument('type');
        if (! in_array($type, [User::ROLE_USER, Admin::ROLE_ADMIN], true)) {
            $this->error('Jenis akun harus user atau admin.');

            return self::FAILURE;
        }

        $isTestAccount = (bool) $this->option('test-account');
        if ($isTestAccount && ! app()->environment(['local', 'testing'])) {
            $this->error('Akun uji dengan kata sandi pendek hanya dapat dibuat secara lokal.');

            return self::FAILURE;
        }

        $model = $type === Admin::ROLE_ADMIN ? Admin::class : User::class;
        $attributes = [
            'name' => trim((string) $this->option('name')),
            'username' => Str::lower(trim($this->argument('username'))),
            'email' => $this->option('email') ? Str::lower(trim($this->option('email'))) : null,
        ];
        $validator = Validator::make($attributes, [
            'name' => ['required', 'string', 'max:255'],
            'username' => [
                'required', 'string',
                'min:'.config('auth.username_policy.min_length'),
                'max:'.config('auth.username_policy.max_length'),
                'regex:'.config('auth.username_policy.pattern'),
                Rule::unique($model, 'username'),
            ],
            'email' => $type === Admin::ROLE_ADMIN
                ? ['prohibited']
                : ['nullable', 'email', 'max:255', Rule::unique(User::class, 'email')],
        ]);

        if ($validator->fails()) {
            $this->error($validator->errors()->first());

            return self::FAILURE;
        }

        $password = $this->secret('Kata sandi akun');
        $confirmation = $this->secret('Ulangi kata sandi akun');
        $passwordRules = ['required', 'string', 'confirmed', 'max:'.config('auth.password_policy.max_length')];
        if (! $isTestAccount) {
            $passwordRules[] = 'min:'.config('auth.password_policy.min_length');
        }
        $passwordValidator = Validator::make([
            'password' => $password,
            'password_confirmation' => $confirmation,
        ], ['password' => $passwordRules]);

        if ($passwordValidator->fails()) {
            $this->error('Kata sandi tidak memenuhi ketentuan atau konfirmasinya belum cocok.');

            return self::FAILURE;
        }

        if ($type === Admin::ROLE_ADMIN) {
            unset($attributes['email']);
        }

        try {
            DB::transaction(function () use ($model, $type, $attributes, $password) {
                $model::create([...$attributes, 'password' => $password]);
                $guard = $type === Admin::ROLE_ADMIN ? 'admin' : 'web';
                if (! Auth::guard($guard)->validate(['username' => $attributes['username'], 'password' => $password])) {
                    throw new \RuntimeException('Verifikasi akun baru belum berhasil.');
                }
            });
        } catch (QueryException|\RuntimeException $exception) {
            $this->error('Akun belum dapat dibuat. Periksa koneksi, migrasi, dan keunikan username.');

            return self::FAILURE;
        }

        $this->info('Akun berhasil dibuat dan kredensialnya berhasil diverifikasi.');

        return self::SUCCESS;
    }
}
