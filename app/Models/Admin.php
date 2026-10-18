<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class Admin extends Authenticatable
{
    use Notifiable;

    public const ROLE_ADMIN = 'admin';

    protected $fillable = ['name', 'username', 'password'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['password' => 'hashed'];
    }

    public function isAdmin(): bool
    {
        return true;
    }

    public function publicProfile(): array
    {
        return [
            ...$this->only(['id', 'name', 'username']),
            'email' => null,
            'role' => self::ROLE_ADMIN,
        ];
    }
}
