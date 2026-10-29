<?php

namespace App\Http\Requests;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user('web') !== null;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('username'))) {
            $this->merge(['username' => Str::lower(trim($this->input('username')))]);
        }

        if ($this->has('email')) {
            $email = $this->input('email');
            $this->merge([
                'email' => is_string($email) && trim($email) !== '' ? Str::lower(trim($email)) : null,
            ]);
        }

        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    public function rules(): array
    {
        $userId = $this->user('web')?->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'username' => [
                'required', 'string',
                'min:'.config('auth.username_policy.min_length'),
                'max:'.config('auth.username_policy.max_length'),
                'regex:'.config('auth.username_policy.pattern'),
                Rule::unique(User::class, 'username')->ignore($userId),
                Rule::unique(Admin::class, 'username'),
            ],
            'email' => [
                'nullable', 'string', 'email', 'max:255',
                Rule::unique(User::class, 'email')->ignore($userId),
            ],
            'password' => [
                'nullable', 'string', 'confirmed',
                'min:'.config('auth.password_policy.min_length'),
                'max:'.config('auth.password_policy.max_length'),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Masukkan nama lengkap.',
            'username.required' => 'Masukkan username.',
            'username.min' => 'Username minimal :min karakter.',
            'username.max' => 'Username maksimal :max karakter.',
            'username.regex' => 'Username hanya boleh berisi huruf kecil, angka, titik, garis bawah, dan tanda hubung.',
            'username.unique' => 'Username sudah digunakan akun lain.',
            'email.email' => 'Masukkan alamat email yang valid.',
            'email.unique' => 'Alamat email sudah terdaftar di akun lain.',
            'password.confirmed' => 'Konfirmasi kata sandi baru belum cocok.',
            'password.min' => 'Kata sandi minimal :min karakter.',
            'password.max' => 'Kata sandi maksimal :max karakter.',
        ];
    }
}
