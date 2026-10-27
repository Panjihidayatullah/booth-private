<?php

namespace App\Services;

use App\Models\Room;
use Carbon\Carbon;

class OccupancyReportService
{
    public function make(Carbon $from, Carbon $until, ?int $roomId = null): array
    {
        $rooms = Room::withTrashed()->with([
            'statusPeriods' => fn ($q) => $q->where('starts_at', '<', $until)->where(fn ($p) => $p->whereNull('ends_at')->orWhere('ends_at', '>', $from)),
            'maintenanceBlocks' => fn ($q) => $q->where('starts_at', '<', $until)->where('ends_at', '>', $from),
            'reservations' => fn ($q) => $q->where('starts_at', '<', $until)->where('ends_at', '>', $from),
        ])->when($roomId, fn ($q) => $q->whereKey($roomId))->orderBy('name')->get();
        $summary = ['effective_seconds' => 0, 'reserved_seconds' => 0, 'available_seconds' => 0, 'cancellations' => 0, 'no_shows' => 0, 'total_reservations' => 0];
        $rows = [];
        foreach ($rooms as $room) {
            $metrics = ['effective_seconds' => 0, 'reserved_seconds' => 0, 'available_seconds' => $this->availableSeconds($room, $from, $until), 'cancellations' => 0, 'no_shows' => 0, 'total_reservations' => 0];
            foreach ($room->reservations as $reservation) {
                if ($reservation->starts_at->gte($from) && $reservation->starts_at->lt($until)) {
                    $metrics['total_reservations']++;
                    if ($reservation->status === 'cancelled') $metrics['cancellations']++;
                    if ($reservation->status === 'no_show') $metrics['no_shows']++;
                }
                if (in_array($reservation->status, ['confirmed', 'checked_in', 'completed'], true)) {
                    $metrics['reserved_seconds'] += $this->overlap($reservation->starts_at->timestamp, $reservation->ends_at->timestamp, $from->timestamp, $until->timestamp);
                }
                if ($reservation->checked_in_at && in_array($reservation->status, ['checked_in', 'completed'], true)) {
                    $start = max($reservation->checked_in_at->timestamp, $reservation->starts_at->timestamp);
                    $end = min(($reservation->checked_out_at ?? now())->timestamp, $reservation->ends_at->timestamp);
                    $metrics['effective_seconds'] += $this->overlap($start, $end, $from->timestamp, $until->timestamp);
                }
            }
            foreach ($summary as $key => $value) $summary[$key] += $metrics[$key];
            $rows[] = ['room_id' => $room->id, 'room_name' => $room->name, ...$this->present($metrics)];
        }
        return ['period' => ['from' => $from->toDateString(), 'to' => $until->copy()->subDay()->toDateString()], 'summary' => $this->present($summary), 'rooms' => $rows];
    }

    private function availableSeconds(Room $room, Carbon $from, Carbon $until): int
    {
        $periods = $room->statusPeriods->map(fn ($p) => [$p->starts_at->timestamp, ($p->ends_at ?? $until)->timestamp])->all();
        // Accommodates rooms imported through Eloquent without fabricating historical active periods.
        if ($periods === [] && ! $room->statusPeriods()->exists() && $room->is_active && ! $room->trashed()) {
            $periods[] = [($room->created_at ?? $from)->timestamp, $until->timestamp];
        }
        $blocks = $this->mergeIntervals($room->maintenanceBlocks->map(fn ($block) => [$block->starts_at->timestamp, $block->ends_at->timestamp])->all());
        $available = 0;
        for ($date = $from->copy(); $date->lt($until); $date->addDay()) {
            $open = $date->copy()->setTimeFromTimeString(config('reservations.opens_at'))->timestamp;
            $close = $date->copy()->setTimeFromTimeString(config('reservations.closes_at'))->timestamp;
            foreach ($periods as [$activeStart, $activeEnd]) {
                $start = max($open, $activeStart, $from->timestamp);
                $end = min($close, $activeEnd, $until->timestamp);
                if ($end <= $start) continue;
                $available += $end - $start;
                foreach ($blocks as [$blockStart, $blockEnd]) $available -= $this->overlap($start, $end, $blockStart, $blockEnd);
            }
        }
        return max(0, $available);
    }

    private function mergeIntervals(array $intervals): array
    {
        usort($intervals, fn ($a, $b) => $a[0] <=> $b[0]);
        $merged = [];
        foreach ($intervals as [$start, $end]) {
            $last = count($merged) - 1;
            if ($last >= 0 && $start <= $merged[$last][1]) $merged[$last][1] = max($merged[$last][1], $end);
            else $merged[] = [$start, $end];
        }
        return $merged;
    }

    private function overlap(int $start, int $end, int $otherStart, int $otherEnd): int
    {
        return max(0, min($end, $otherEnd) - max($start, $otherStart));
    }

    private function present(array $metrics): array
    {
        return [
            'effective_hours' => round($metrics['effective_seconds'] / 3600, 2),
            'reserved_hours' => round($metrics['reserved_seconds'] / 3600, 2),
            'available_hours' => round($metrics['available_seconds'] / 3600, 2),
            'utilization_rate' => $metrics['available_seconds'] > 0 ? round(($metrics['effective_seconds'] / $metrics['available_seconds']) * 100, 2) : 0,
            'cancellations' => $metrics['cancellations'], 'no_shows' => $metrics['no_shows'], 'total_reservations' => $metrics['total_reservations'],
        ];
    }
}
