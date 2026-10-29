<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CustomerProfileTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'session.driver' => 'array',
            'cache.default' => 'array',
        ]);
        DB::purge('sqlite');
        $this->artisan('migrate', ['--database' => 'sqlite', '--force' => true])->assertExitCode(0);
    }

    public function test_customer_can_update_their_profile_details(): void
    {
        $user = User::factory()->create([
            'name' => 'Haikal Awal',
            'username' => 'haikal.lama',
            'email' => null,
            'password' => Hash::make('password-lama123'),
        ]);

        $this->actingAs($user, 'web');

        $response = $this->putJson(route('api.customer.profile.update'), [
            'name' => 'Muhammad Haikal',
            'username' => 'haikal.baru',
            'email' => 'haikal@example.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Profil akun berhasil diperbarui.')
            ->assertJsonPath('user.name', 'Muhammad Haikal')
            ->assertJsonPath('user.username', 'haikal.baru')
            ->assertJsonPath('user.email', 'haikal@example.com');

        $user->refresh();
        $this->assertSame('Muhammad Haikal', $user->name);
        $this->assertSame('haikal.baru', $user->username);
        $this->assertSame('haikal@example.com', $user->email);
        $this->assertTrue(Hash::check('password-lama123', $user->password));
    }

    public function test_customer_can_update_their_password_optionally(): void
    {
        $user = User::factory()->create([
            'name' => 'Haikal',
            'username' => 'haikal',
            'password' => Hash::make('password-lama123'),
        ]);

        $this->actingAs($user, 'web');

        $response = $this->putJson(route('api.customer.profile.update'), [
            'name' => 'Haikal',
            'username' => 'haikal',
            'password' => 'password-baru456',
            'password_confirmation' => 'password-baru456',
        ]);

        $response->assertOk();
        $user->refresh();
        $this->assertTrue(Hash::check('password-baru456', $user->password));
    }

    public function test_customer_cannot_claim_username_used_by_another_customer_or_admin(): void
    {
        $otherUser = User::factory()->create(['username' => 'user.lain']);
        $admin = Admin::create(['name' => 'Admin Test', 'username' => 'admin.utama', 'password' => 'admin-pass']);

        $user = User::factory()->create(['username' => 'haikal']);
        $this->actingAs($user, 'web');

        $this->putJson(route('api.customer.profile.update'), [
            'name' => 'Haikal',
            'username' => 'user.lain',
        ])->assertUnprocessable()->assertJsonValidationErrors('username');

        $this->putJson(route('api.customer.profile.update'), [
            'name' => 'Haikal',
            'username' => 'admin.utama',
        ])->assertUnprocessable()->assertJsonValidationErrors('username');
    }

    public function test_customer_cannot_claim_email_used_by_another_customer(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $user = User::factory()->create(['email' => 'my@example.com']);
        $this->actingAs($user, 'web');

        $this->putJson(route('api.customer.profile.update'), [
            'name' => 'Haikal',
            'username' => $user->username,
            'email' => 'taken@example.com',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_guest_cannot_update_profile(): void
    {
        $this->putJson(route('api.customer.profile.update'), [
            'name' => 'Haikal',
            'username' => 'haikal',
        ])->assertUnauthorized();
    }
}
