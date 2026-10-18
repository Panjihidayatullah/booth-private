<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Models\Admin;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function session(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->currentAccount()?->publicProfile()])
            ->header('Cache-Control', 'no-store, private');
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        if ($this->currentAccount()) {
            return response()->json(['message' => 'Kamu sudah masuk ke akun.'], 409);
        }

        try {
            $user = User::create($request->safe()->only(['name', 'username', 'email', 'password']));
        } catch (UniqueConstraintViolationException $exception) {
            throw ValidationException::withMessages(['username' => 'Username atau email sudah terdaftar. Silakan sign in.']);
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return $this->authenticatedResponse($user, 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        return $this->authenticate($request, 'web');
    }

    public function adminLogin(LoginRequest $request): JsonResponse
    {
        return $this->authenticate($request, 'admin');
    }

    private function authenticate(LoginRequest $request, string $guardName): JsonResponse
    {
        $identifier = $request->validated('login');
        $identifierColumn = $guardName === 'web' && str_contains($identifier, '@') ? 'email' : 'username';
        $credentials = [$identifierColumn => $identifier, 'password' => $request->validated('password')];
        $throttleKey = 'login:'.hash('sha256', $guardName.'|'.$identifier.'|'.$request->ip());
        $maxAttempts = (int) config('auth.limits.login_attempts');

        if (RateLimiter::tooManyAttempts($throttleKey, $maxAttempts)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return response()->json([
                'message' => 'Terlalu banyak percobaan masuk. Coba kembali setelah '.$seconds.' detik.',
            ], 429)->header('Retry-After', (string) $seconds);
        }

        if (! Auth::guard($guardName)->attempt($credentials, $request->boolean('remember'))) {
            RateLimiter::hit($throttleKey, (int) config('auth.limits.login_decay_seconds'));

            throw ValidationException::withMessages(['login' => 'Username/email atau kata sandi tidak sesuai.']);
        }

        RateLimiter::clear($throttleKey);
        Auth::guard($guardName === 'admin' ? 'web' : 'admin')->logout();
        Auth::shouldUse($guardName);
        $request->session()->regenerate();

        return $this->authenticatedResponse(Auth::guard($guardName)->user());
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        Auth::guard('admin')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Kamu sudah keluar dari akun.']);
    }

    private function currentAccount(): User|Admin|null
    {
        return Auth::guard('admin')->user() ?? Auth::guard('web')->user();
    }

    private function authenticatedResponse(User|Admin $user, int $status = 200): JsonResponse
    {
        return response()->json([
            'user' => $user->publicProfile(),
            'redirect' => route('dashboard'),
        ], $status)->header('Cache-Control', 'no-store, private');
    }
}
