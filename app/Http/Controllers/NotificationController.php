<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = Auth::guard('web')->user();
        if (! $user) {
            return response()->json(['data' => [], 'unread_count' => 0]);
        }

        $notifications = $user->notifications()
            ->latest()
            ->limit(30)
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'data' => $n->data,
                'read_at' => $n->read_at?->toIso8601String(),
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        return response()->json([
            'data' => $notifications,
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markAsRead(string $id): JsonResponse
    {
        $user = Auth::guard('web')->user();
        $notification = $user?->notifications()->findOrFail($id);
        $notification?->markAsRead();

        return response()->json([
            'message' => 'Notifikasi ditandai telah dibaca.',
            'unread_count' => $user?->unreadNotifications()->count() ?? 0,
        ]);
    }

    public function markAllAsRead(): JsonResponse
    {
        $user = Auth::guard('web')->user();
        $user?->unreadNotifications->markAsRead();

        return response()->json([
            'message' => 'Semua notifikasi ditandai telah dibaca.',
            'unread_count' => 0,
        ]);
    }
}
