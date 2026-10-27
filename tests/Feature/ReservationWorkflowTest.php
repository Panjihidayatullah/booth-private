<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\View;
use Tests\TestCase;

class ReservationWorkflowTest extends TestCase
{
    private Admin $admin;
    private User $customer;
    private User $otherCustomer;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'session.driver' => 'array',
            'cache.default' => 'array',
            'app.timezone' => 'Asia/Jakarta',
        ]);
        DB::purge('sqlite');
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
        $this->at('2026-11-02 06:00:00');
        $this->admin = Admin::create(['name' => 'Petugas Uji', 'username' => 'operator.uji', 'password' => 'password-pengujian']);
        $this->customer = User::create(['name' => 'Penyewa Pertama', 'username' => 'penyewa.satu', 'email' => 'satu@example.test', 'password' => 'password-pengujian']);
        $this->otherCustomer = User::create(['name' => 'Penyewa Kedua', 'username' => 'penyewa.dua', 'email' => 'dua@example.test', 'password' => 'password-pengujian']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function at(string $time): void
    {
        $now = CarbonImmutable::parse($time, 'Asia/Jakarta');
        Carbon::setTestNow($now);
        CarbonImmutable::setTestNow($now);
    }

    private function asAdmin(): void
    {
        Auth::guard('web')->logout();
        $this->actingAs($this->admin, 'admin');
    }

    private function asCustomer(?User $user = null): void
    {
        Auth::guard('admin')->logout();
        $this->actingAs($user ?? $this->customer, 'web');
    }

    private function roomPayload(array $overrides = []): array
    {
        return array_replace([
            'name' => 'Ruang Kolaborasi Uji', 'type' => 'workspace', 'capacity' => 6,
            'location' => 'Gedung Utama', 'floor' => '2', 'rules' => 'Jaga kebersihan dan ketenangan ruangan.',
            'description' => 'Ruang pengujian terisolasi.', 'is_active' => true, 'maintenance_notes' => null,
            'image_url' => null, 'facility_ids' => [],
            'floor_plan' => ['width' => 6, 'depth' => 4, 'desks' => 2, 'door' => 'bottom'],
        ], $overrides);
    }

    private function room(array $overrides = []): array
    {
        $this->asAdmin();
        return $this->postJson('/api/admin/rooms', $this->roomPayload($overrides))->assertCreated()->json('data');
    }

    private function booking(int $roomId, array $overrides = [], ?User $customer = null): array
    {
        $this->asCustomer($customer);
        return $this->postJson('/api/customer/reservations', $this->bookingPayload($roomId, $overrides))->assertCreated()->json('data');
    }

    private function bookingPayload(int $roomId, array $overrides = []): array
    {
        return array_replace([
            'room_id' => $roomId, 'date' => '2026-11-02', 'start_time' => '09:00', 'end_time' => '10:00',
            'attendees' => 3, 'purpose' => 'Diskusi proyek kelompok.',
        ], $overrides);
    }

    public function test_business_routes_require_the_correct_role(): void
    {
        $this->getJson('/api/catalog/rooms')->assertOk();
        $this->getJson('/api/customer/reservations')->assertUnauthorized();
        $this->getJson('/api/admin/rooms')->assertUnauthorized();
        $this->asCustomer();
        foreach (['rooms', 'facilities', 'maintenance', 'reservations', 'reports'] as $module) {
            $this->getJson('/api/admin/'.$module)->assertForbidden();
        }
        $this->postJson('/api/admin/rooms', $this->roomPayload())->assertForbidden();
    }

    public function test_admin_can_manage_facilities_and_rooms_with_real_catalog_details(): void
    {
        $this->asAdmin();
        $facility = $this->postJson('/api/admin/facilities', ['name' => 'Wi-Fi Pengujian', 'description' => 'Akses internet.'])->assertCreated()->json('data');
        $this->putJson('/api/admin/facilities/'.$facility['id'], ['name' => 'Wi-Fi Cepat', 'description' => 'Akses internet cepat.'])->assertOk();
        $room = $this->room(['facility_ids' => [$facility['id']]]);
        $this->getJson('/api/catalog/rooms/'.$room['id'])->assertOk()
            ->assertJsonPath('data.capacity', 6)->assertJsonPath('data.location', 'Gedung Utama')
            ->assertJsonPath('data.floor', '2')->assertJsonPath('data.facilities.0.name', 'Wi-Fi Cepat')
            ->assertJsonPath('data.floor_plan.desks', 2);
        $this->putJson('/api/admin/rooms/'.$room['id'], $this->roomPayload(['capacity' => 8, 'facility_ids' => [$facility['id']]]))->assertOk()->assertJsonPath('data.capacity', 8);
        $this->assertContains($this->deleteJson('/api/admin/facilities/'.$facility['id'])->status(), [409, 422]);
    }

    public function test_room_image_urls_and_floor_plans_are_validated(): void
    {
        $this->asAdmin();
        $this->postJson('/api/admin/rooms', $this->roomPayload(['image_url' => 'javascript:alert(1)']))->assertUnprocessable();
        $this->postJson('/api/admin/rooms', $this->roomPayload(['floor_plan' => ['width' => -1, 'depth' => 0, 'desks' => -1, 'door' => 'invalid']]))->assertUnprocessable();
    }

    public function test_catalog_filters_by_type_capacity_facilities_and_hides_inactive_rooms(): void
    {
        $this->asAdmin();
        $facility = $this->postJson('/api/admin/facilities', ['name' => 'Proyektor'])->assertCreated()->json('data');
        $match = $this->room(['name' => 'Ruang Proyektor', 'facility_ids' => [$facility['id']]]);
        $this->room(['name' => 'Booth Uji', 'type' => 'booth', 'capacity' => 1]);
        $inactive = $this->room(['name' => 'Ruang Nonaktif', 'is_active' => false]);
        $query = http_build_query(['type' => 'workspace', 'attendees' => 4, 'facility_ids' => [$facility['id']]]);
        $this->getJson('/api/catalog/rooms?'.$query)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $match['id']);
        $this->getJson('/api/catalog/rooms/'.$inactive['id'])->assertNotFound();
    }

    public function test_booking_creates_an_owned_ticket_and_ignores_forged_owner(): void
    {
        $room = $this->room();
        $reservation = $this->booking($room['id'], ['user_id' => $this->otherCustomer->id]);
        $this->assertNotEmpty($reservation['code']);
        $this->assertSame($this->customer->id, $reservation['user_id']);
        $this->assertSame('confirmed', $reservation['status']);
        $this->getJson('/api/customer/reservations/'.$reservation['id'])->assertOk()->assertJsonPath('data.code', $reservation['code']);
        $this->getJson('/api/customer/reservations?view=upcoming')->assertOk()->assertJsonCount(1, 'data');
        $this->asCustomer($this->otherCustomer);
        $this->getJson('/api/customer/reservations')->assertOk()->assertJsonCount(0, 'data');
        $this->assertContains($this->getJson('/api/customer/reservations/'.$reservation['id'])->status(), [403, 404]);
        $this->assertContains($this->postJson('/api/customer/reservations/'.$reservation['id'].'/cancel')->status(), [403, 404]);
    }

    public function test_capacity_business_hours_duration_and_past_times_are_rejected(): void
    {
        $room = $this->room();
        $this->asCustomer();
        foreach ([
            ['attendees' => 7], ['start_time' => '06:30', 'end_time' => '07:30'],
            ['start_time' => '21:30', 'end_time' => '22:30'], ['end_time' => '09:20'],
            ['end_time' => '08:30'], ['date' => '2026-11-01'],
        ] as $invalid) {
            $this->postJson('/api/customer/reservations', $this->bookingPayload($room['id'], $invalid))->assertUnprocessable();
        }
        $this->assertDatabaseCount('reservations', 0);
    }

    public function test_overlaps_are_rejected_but_back_to_back_reservations_are_allowed(): void
    {
        $room = $this->room();
        $first = $this->booking($room['id']);
        $this->asCustomer($this->otherCustomer);
        $this->postJson('/api/customer/reservations', $this->bookingPayload($room['id'], ['start_time' => '09:30', 'end_time' => '10:30']))->assertUnprocessable();
        $next = $this->booking($room['id'], ['start_time' => '10:00', 'end_time' => '10:30'], $this->otherCustomer);
        $this->assertNotSame($first['code'], $next['code']);
        $this->assertDatabaseCount('reservations', 2);
    }

    public function test_cancellation_before_start_reopens_the_slot_and_appears_in_history(): void
    {
        $room = $this->room();
        $reservation = $this->booking($room['id']);
        $query = '?date=2026-11-02&start_time=09:00&end_time=10:00&attendees=2';
        $this->getJson('/api/catalog/rooms'.$query)->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/customer/reservations/'.$reservation['id'].'/cancel')->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->getJson('/api/catalog/rooms'.$query)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/customer/reservations?view=history')->assertOk()->assertJsonPath('data.0.status', 'cancelled');
    }

    public function test_cancellation_at_or_after_start_is_not_allowed(): void
    {
        $room = $this->room();
        $reservation = $this->booking($room['id']);
        $this->at('2026-11-02 09:00:00');
        $this->postJson('/api/customer/reservations/'.$reservation['id'].'/cancel')->assertUnprocessable();
        $this->assertDatabaseHas('reservations', ['id' => $reservation['id'], 'status' => 'confirmed']);
    }

    public function test_inactive_rooms_cannot_be_booked(): void
    {
        $room = $this->room(['is_active' => false, 'maintenance_notes' => 'Perawatan fasilitas.']);
        $this->asCustomer();
        $this->postJson('/api/customer/reservations', $this->bookingPayload($room['id']))->assertUnprocessable();
    }

    public function test_maintenance_and_reservations_reject_conflicts_in_both_directions(): void
    {
        $room = $this->room();
        $this->booking($room['id']);
        $this->asAdmin();
        $payload = ['room_id' => $room['id'], 'date' => '2026-11-02', 'start_time' => '09:30', 'end_time' => '10:30', 'reason' => 'Perawatan jaringan.'];
        $this->postJson('/api/admin/maintenance', $payload)->assertUnprocessable();
        $block = $this->postJson('/api/admin/maintenance', array_replace($payload, ['start_time' => '10:00', 'end_time' => '11:00']))->assertCreated()->json('data');
        $this->asCustomer();
        $this->postJson('/api/customer/reservations', $this->bookingPayload($room['id'], ['start_time' => '10:30', 'end_time' => '11:30']))->assertUnprocessable();
        $this->asAdmin();
        $this->deleteJson('/api/admin/maintenance/'.$block['id'])->assertSuccessful();
        $this->booking($room['id'], ['start_time' => '10:00', 'end_time' => '11:00']);
    }

    public function test_operational_actions_enforce_state_and_check_in_window(): void
    {
        $room = $this->room();
        $reservation = $this->booking($room['id']);
        $this->asAdmin();
        $base = '/api/admin/reservations/'.$reservation['id'];
        $this->postJson($base.'/check-out')->assertUnprocessable();
        $this->postJson($base.'/check-in')->assertUnprocessable();
        $this->at('2026-11-02 09:00:00');
        $this->postJson($base.'/check-in')->assertOk()->assertJsonPath('data.status', 'checked_in');
        $this->postJson($base.'/check-in')->assertUnprocessable();
        $this->postJson($base.'/no-show')->assertUnprocessable();
        $this->at('2026-11-02 09:45:00');
        $this->postJson($base.'/check-out')->assertOk()->assertJsonPath('data.status', 'completed');
        $this->postJson($base.'/check-out')->assertUnprocessable();
    }

    public function test_no_show_is_only_allowed_strictly_after_fifteen_minutes(): void
    {
        $room = $this->room();
        $reservation = $this->booking($room['id']);
        $this->asAdmin();
        $base = '/api/admin/reservations/'.$reservation['id'];
        $this->at('2026-11-02 09:15:00');
        $this->postJson($base.'/no-show')->assertUnprocessable();
        $this->at('2026-11-02 09:15:01');
        $this->postJson($base.'/check-in')->assertUnprocessable();
        $this->postJson($base.'/no-show')->assertOk()->assertJsonPath('data.status', 'no_show');
    }

    public function test_admin_reservation_filters_use_date_room_status_and_customer_name(): void
    {
        $room = $this->room();
        $reservation = $this->booking($room['id']);
        $otherRoom = $this->room(['name' => 'Ruang Kedua']);
        $this->booking($otherRoom['id'], ['date' => '2026-11-03'], $this->otherCustomer);
        $this->asAdmin();
        $query = http_build_query(['date' => '2026-11-02', 'status' => 'confirmed', 'room_id' => $room['id'], 'q' => 'Pertama']);
        $this->getJson('/api/admin/reservations?'.$query)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $reservation['id']);
    }

    public function test_reports_use_actual_attendance_maintenance_and_status_counts(): void
    {
        $room = $this->room();
        $used = $this->booking($room['id']);
        $cancelled = $this->booking($room['id'], ['start_time' => '11:00', 'end_time' => '12:00']);
        $this->postJson('/api/customer/reservations/'.$cancelled['id'].'/cancel')->assertOk();
        $absent = $this->booking($room['id'], ['start_time' => '13:00', 'end_time' => '14:00']);
        $this->asAdmin();
        $this->postJson('/api/admin/maintenance', ['room_id' => $room['id'], 'date' => '2026-11-02', 'start_time' => '14:00', 'end_time' => '15:00', 'reason' => 'Perawatan ruangan.'])->assertCreated();
        $this->at('2026-11-02 09:10:00');
        $this->postJson('/api/admin/reservations/'.$used['id'].'/check-in')->assertOk();
        $this->at('2026-11-02 10:20:00');
        $this->postJson('/api/admin/reservations/'.$used['id'].'/check-out')->assertOk();
        $this->at('2026-11-02 13:16:00');
        $this->postJson('/api/admin/reservations/'.$absent['id'].'/no-show')->assertOk();
        $report = $this->getJson('/api/admin/reports?from=2026-11-02&to=2026-11-02')->assertOk()->assertJsonPath('data.summary.cancellations', 1)->assertJsonPath('data.summary.no_shows', 1)->json('data');
        $this->assertEqualsWithDelta(50 / 60, $report['summary']['effective_hours'], .01);
        $this->assertEqualsWithDelta(1, $report['summary']['reserved_hours'], .01);
        $this->assertEqualsWithDelta(14, $report['summary']['available_hours'], .01);
        $this->assertEqualsWithDelta((50 / 60) / 14 * 100, $report['summary']['utilization_rate'], .05);
        $this->assertCount(1, $report['rooms']);
    }

    public function test_report_preserves_historical_active_intervals(): void
    {
        $room = $this->room();
        $this->at('2026-11-02 08:00:00');
        $this->asAdmin();
        $this->putJson('/api/admin/rooms/'.$room['id'], $this->roomPayload(['is_active' => false]))->assertOk();
        $this->at('2026-11-02 09:00:00');
        $this->putJson('/api/admin/rooms/'.$room['id'], $this->roomPayload(['is_active' => true]))->assertOk();
        $report = $this->getJson('/api/admin/reports?from=2026-11-02&to=2026-11-02')->assertOk()->json('data');
        $this->assertEqualsWithDelta(14, $report['summary']['available_hours'], .01);
        $this->getJson('/api/admin/reports?from=2026-11-03&to=2026-11-02')->assertUnprocessable();
    }

    public function test_room_deletion_preserves_ticket_history_and_protects_upcoming_bookings(): void
    {
        $room = $this->room();
        $reservation = $this->booking($room['id']);
        $this->asAdmin();
        $this->assertContains($this->deleteJson('/api/admin/rooms/'.$room['id'])->status(), [409, 422]);
        $this->asCustomer();
        $this->postJson('/api/customer/reservations/'.$reservation['id'].'/cancel')->assertOk();
        $this->asAdmin();
        $this->deleteJson('/api/admin/rooms/'.$room['id'])->assertSuccessful();
        $this->getJson('/api/catalog/rooms/'.$room['id'])->assertNotFound();
        $this->asCustomer();
        $this->getJson('/api/customer/reservations/'.$reservation['id'])->assertOk()->assertJsonPath('data.room.name', $room['name']);
    }

    public function test_customer_can_download_their_ticket_as_a_private_pdf_attachment(): void
    {
        $room = $this->room();
        $reservation = $this->booking($room['id']);

        $response = $this->getJson('/api/customer/reservations/'.$reservation['id'].'/ticket')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', 'attachment; filename=tiket-'.$reservation['code'].'.pdf')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->assertStringStartsWith('%PDF-', $response->getContent());
        $this->assertStringEndsWith('%%EOF', trim($response->getContent()));
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public function test_ticket_download_is_restricted_to_the_customer_who_owns_it(): void
    {
        $room = $this->room();
        $reservation = $this->booking($room['id']);
        $url = '/api/customer/reservations/'.$reservation['id'].'/ticket';

        Auth::guard('web')->logout();
        Auth::guard('admin')->logout();
        $this->getJson($url)->assertUnauthorized();
        $this->asCustomer($this->otherCustomer);
        $this->getJson($url)->assertNotFound();
        $this->asCustomer();
        $this->getJson('/api/customer/reservations/999999/ticket')->assertNotFound();
        $this->asAdmin();
        $this->getJson($url)->assertUnauthorized();
    }

    public function test_downloaded_ticket_keeps_current_status_and_deleted_room_history(): void
    {
        $room = $this->room();
        $reservation = $this->booking($room['id']);
        $this->postJson('/api/customer/reservations/'.$reservation['id'].'/cancel')->assertOk();
        $this->asAdmin();
        $this->deleteJson('/api/admin/rooms/'.$room['id'])->assertSuccessful();
        $this->asCustomer();

        $rendered = [];
        View::composer('pdf.reservation-ticket', function ($view) use (&$rendered) {
            $data = $view->getData();
            $rendered = [
                'status' => $data['reservation']->status,
                'status_label' => $data['statusLabel'],
                'room' => $data['reservation']->room->name,
                'customer' => $data['reservation']->user->name,
            ];
        });
        $this->getJson('/api/customer/reservations/'.$reservation['id'].'/ticket')->assertOk()->assertHeader('Content-Type', 'application/pdf');

        $this->assertSame([
            'status' => 'cancelled', 'status_label' => 'Dibatalkan',
            'room' => $room['name'], 'customer' => $this->customer->name,
        ], $rendered);
    }

    public function test_ticket_pdf_handles_maximum_purpose_and_escapes_html(): void
    {
        $room = $this->room(['name' => mb_substr(str_repeat('Ruang Kolaborasi ', 10), 0, 150)]);
        $purpose = '<script>DO_NOT_EXECUTE</script>'.str_repeat('Rencana diskusi dan presentasi. ', 70);
        $purpose = mb_substr($purpose, 0, 2000);
        $reservation = $this->booking($room['id'], ['purpose' => $purpose]);
        $response = $this->getJson('/api/customer/reservations/'.$reservation['id'].'/ticket')->assertOk();
        $this->assertStringStartsWith('%PDF-', $response->getContent());

        $html = view('pdf.reservation-ticket', [
            'reservation' => \App\Models\Reservation::findOrFail($reservation['id'])->load(['room', 'user']),
            'statusLabel' => 'Terkonfirmasi',
            'downloadedAt' => now(),
        ])->render();
        $this->assertStringContainsString('&lt;script&gt;DO_NOT_EXECUTE&lt;/script&gt;', $html);
        $this->assertStringNotContainsString('<script>DO_NOT_EXECUTE</script>', $html);
    }

    public function test_summary_counts_are_restricted_to_the_current_customer(): void
    {
        $room = $this->room();
        $this->booking($room['id']);
        $this->booking($room['id'], ['start_time' => '10:00', 'end_time' => '11:00'], $this->otherCustomer);
        $this->asCustomer();
        $this->getJson('/api/workspace/summary')->assertOk()->assertJsonPath('data.upcoming', 1);
        $this->asAdmin();
        $this->getJson('/api/workspace/summary')->assertOk()->assertJsonPath('data.today', 2);
    }
}
