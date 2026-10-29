<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\FacilityController;
use App\Http\Controllers\MaintenanceController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ReservationController;
use App\Http\Controllers\RoomController;
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

Route::prefix('api/catalog')->group(function () {
    Route::get('/rooms', [CatalogController::class, 'rooms'])->name('api.catalog.rooms');
    Route::get('/rooms/{room}', [CatalogController::class, 'show'])->name('api.catalog.rooms.show');
    Route::get('/facilities', [CatalogController::class, 'facilities'])->name('api.catalog.facilities');
});

Route::middleware('auth:web')->prefix('api/customer')->group(function () {
    Route::get('/reservations', [ReservationController::class, 'index'])->name('api.customer.reservations');
    Route::post('/reservations', [ReservationController::class, 'store']);
    Route::get('/reservations/{reservation}/ticket', [ReservationController::class, 'ticket'])->name('api.customer.reservations.ticket');
    Route::get('/reservations/{reservation}', [ReservationController::class, 'show']);
    Route::post('/reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);
    Route::get('/notifications', [NotificationController::class, 'index'])->name('api.customer.notifications');
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead'])->name('api.customer.notifications.read');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead'])->name('api.customer.notifications.read-all');
    Route::put('/profile', [AuthController::class, 'updateProfile'])->name('api.customer.profile.update');
});

Route::middleware(['auth:web,admin', 'can:access-admin'])->prefix('api/admin')->group(function () {
    Route::post('/rooms/upload-image', [RoomController::class, 'uploadImage']);
    Route::apiResource('rooms', RoomController::class);
    Route::apiResource('facilities', FacilityController::class);
    Route::get('/maintenance', [MaintenanceController::class, 'index']);
    Route::post('/maintenance', [MaintenanceController::class, 'store']);
    Route::delete('/maintenance/{maintenance}', [MaintenanceController::class, 'destroy']);
    Route::get('/reservations', [ReservationController::class, 'adminIndex']);
    Route::post('/reservations/{reservation}/check-in', [ReservationController::class, 'checkIn']);
    Route::post('/reservations/{reservation}/check-out', [ReservationController::class, 'checkOut']);
    Route::post('/reservations/{reservation}/no-show', [ReservationController::class, 'noShow']);
    Route::get('/reports', [ReportController::class, 'index']);
});

Route::middleware('auth:web,admin')->get('/api/workspace/summary', [ReportController::class, 'summary']);
