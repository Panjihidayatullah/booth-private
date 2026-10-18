<?php

use App\Http\Controllers\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::view('/', 'welcome', ['page' => 'landing'])->name('home');
Route::view('/sign-in', 'welcome', ['page' => 'signin'])->middleware('guest:web')->name('login');
Route::view('/sign-up', 'welcome', ['page' => 'signup'])->middleware('guest:web,admin')->name('register');
Route::view('/admin/login', 'welcome', ['page' => 'admin-signin'])->middleware('guest:admin')->name('admin.login');

Route::get('/dashboard', function (Request $request) {
    return redirect()->route($request->user()->isAdmin() ? 'admin.home' : 'customer.home');
})->middleware('auth:web,admin')->name('dashboard');

Route::middleware('auth:web')->prefix('pelanggan')->name('customer.')->group(function () {
    foreach (['home' => '', 'rooms' => '/ruangan', 'bookings' => '/reservasi', 'account' => '/akun'] as $section => $path) {
        Route::view($path, 'welcome', ['page' => 'workspace', 'portal' => 'customer', 'section' => $section])->name($section);
    }
});

Route::middleware(['auth:web,admin', 'can:access-admin'])->prefix('admin')->name('admin.')->group(function () {
    foreach (['home' => '', 'rooms' => '/ruangan', 'facilities' => '/fasilitas', 'reservations' => '/reservasi', 'maintenance' => '/pemeliharaan', 'reports' => '/laporan'] as $section => $path) {
        Route::view($path, 'welcome', ['page' => 'workspace', 'portal' => 'admin', 'section' => $section])->name($section);
    }
});

Route::prefix('api/auth')->name('auth.')->group(function () {
    Route::get('/session', [AuthController::class, 'session'])->name('session');
    Route::post('/sign-in', [AuthController::class, 'login'])->name('login');
    Route::post('/admin/sign-in', [AuthController::class, 'adminLogin'])->name('adminLogin');
    Route::post('/sign-up', [AuthController::class, 'register'])->middleware('throttle:registration')->name('register');
    Route::post('/sign-out', [AuthController::class, 'logout'])->middleware('auth:web,admin')->name('logout');
});
