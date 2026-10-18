<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('username'))) {
            $this->merge(['username' => Str::lower(trim($this->input('username')))]);
        }

        if (is_string($this->input('email'))) {
            $this->merge(['email' => Str::lower(trim($this->input('email')))]);
        }

        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'username' => [
                'required', 'string',
                'min:'.config('auth.username_policy.min_length'),
                'max:'.config('auth.username_policy.max_length'),
                'regex:'.config('auth.username_policy.pattern'),
                Rule::unique(User::class),
            ],
            'email' => ['nullable', 'string', 'email', 'max:255', Rule::unique(User::class)],
            'password' => [
                'required', 'string', 'confirmed',
                'min:'.config('auth.password_policy.min_length'),
                'max:'.config('auth.password_policy.max_length'),
            ],
            'role' => ['prohibited'],
            'account_type' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Masukkan nama lengkap.',
            'username.required' => 'Masukkan username.',
            'username.min' => 'Username minimal :min karakter.',
            'username.max' => 'Username maksimal :max karakter.',
            'username.regex' => 'Username hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung.',
            'username.unique' => 'Username sudah digunakan.',
            'email.email' => 'Masukkan alamat email yang valid.',
            'email.unique' => 'Alamat email sudah terdaftar. Silakan sign in.',
            'password.required' => 'Buat kata sandi untuk akunmu.',
            'password.confirmed' => 'Konfirmasi kata sandi belum cocok.',
            'password.min' => 'Kata sandi minimal :min karakter.',
            'password.max' => 'Kata sandi maksimal :max karakter.',
            'role.prohibited' => 'Peran akun ditentukan oleh pengelola.',
        ];
    }
}
