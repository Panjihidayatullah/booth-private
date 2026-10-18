<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('login'))) {
            $this->merge(['login' => Str::lower(trim($this->input('login')))]);
        }
    }

    public function rules(): array
    {
        return [
            'login' => ['required', 'string', 'max:255'],
            'account_type' => ['prohibited'],
            'role' => ['prohibited'],
            'password' => ['required', 'string', 'max:'.config('auth.password_policy.max_length')],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'login.required' => 'Masukkan username atau alamat email.',
            'password.required' => 'Masukkan kata sandi.',
            'password.max' => 'Kata sandi terlalu panjang.',
        ];
    }
}
