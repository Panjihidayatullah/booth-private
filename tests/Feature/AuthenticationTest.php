<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PDOException;
use Tests\TestCase;

class AuthenticationTest extends TestCase
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

    private function registrationData(array $overrides = []): array
    {
        return array_replace([
            'name' => 'Pengguna Pengujian',
            'username' => 'pelanggan.uji',
            'email' => 'pelanggan@example.test',
            'password' => 'password-aman',
            'password_confirmation' => 'password-aman',
        ], $overrides);
    }

    public function test_login_pages_and_guest_redirects_use_separate_urls(): void
    {
        $this->assertSame('/sign-in', route('login', [], false));
        $this->assertSame('/admin/login', route('admin.login', [], false));
        $this->get(route('login'))->assertOk()->assertViewHas('page', 'signin');
        $this->get(route('admin.login'))->assertOk()->assertViewHas('page', 'admin-signin');
        $this->get(route('customer.rooms'))->assertRedirect(route('login'));
        $this->get(route('admin.home'))->assertRedirect(route('admin.login'));
        $this->get(route('admin.rooms'))->assertRedirect(route('admin.login'));
    }

    public function test_registration_only_creates_a_customer_with_a_hashed_password(): void
    {
        $response = $this->postJson(route('auth.register'), $this->registrationData([
            'name' => ' Pengguna Pengujian ',
            'username' => ' PELANGGAN.UJI ',
            'email' => ' PELANGGAN@example.test ',
        ]));

        $response->assertCreated()->assertJsonPath('user.role', 'user')
            ->assertJsonPath('user.username', 'pelanggan.uji')
            ->assertJsonPath('user.email', 'pelanggan@example.test')
            ->assertJsonMissingPath('user.password')->assertJsonMissingPath('user.remember_token');
        $user = User::firstOrFail();
        $this->assertSame('Pengguna Pengujian', $user->name);
        $this->assertTrue(Hash::check('password-aman', $user->password));
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertDatabaseCount('admins', 0);
        $response->assertCookie('XSRF-TOKEN');
    }

    public function test_customer_registration_requires_an_email(): void
    {
        $this->postJson(route('auth.register'), $this->registrationData(['email' => null]))
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertDatabaseCount('users', 0);
    }

    public function test_public_registration_cannot_create_admin_accounts(): void
    {
        $this->postJson(route('auth.register'), $this->registrationData(['role' => 'admin']))
            ->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->postJson(route('auth.register'), $this->registrationData(['account_type' => 'admin']))
            ->assertUnprocessable()->assertJsonValidationErrors('account_type');
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('admins', 0);
        $this->assertGuest('web');
        $this->assertGuest('admin');
    }

    public function test_public_registration_rejects_short_or_mismatched_passwords(): void
    {
        $this->postJson(route('auth.register'), $this->registrationData(['password_confirmation' => 'berbeda-sekali']))
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson(route('auth.register'), $this->registrationData(['password' => 'short', 'password_confirmation' => 'short']))
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertDatabaseCount('users', 0);
    }

    public function test_a_customer_can_login_using_email_and_logout(): void
    {
        $user = User::factory()->create(['username' => 'pelanggan.login', 'email' => 'login@example.test', 'password' => Hash::make('password-aman')]);
        $this->postJson(route('auth.login'), ['login' => ' LOGIN@example.test ', 'password' => 'password-aman'])
            ->assertOk()->assertJsonPath('user.id', $user->id)->assertJsonMissingPath('user.password');
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertGuest('admin');
        $this->getJson(route('auth.session'))->assertOk()->assertJsonPath('user.id', $user->id);

        $this->postJson(route('auth.logout'))->assertOk();
        $this->assertGuest('web');
        $this->assertGuest('admin');
        $this->getJson(route('auth.session'))->assertOk()->assertJsonPath('user', null);
        $this->get(route('customer.home'))->assertRedirect(route('login'));
    }

    public function test_a_customer_can_login_using_username_without_email(): void
    {
        $user = User::create(['name' => 'Pelanggan Pengujian', 'username' => 'pelanggan.username', 'email' => null, 'password' => 'password-aman']);
        $this->postJson(route('auth.login'), ['login' => ' PELANGGAN.USERNAME ', 'password' => 'password-aman'])
            ->assertOk()->assertJsonPath('user.role', 'user')->assertJsonPath('user.email', null);
        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_customer_and_admin_with_the_same_id_and_username_remain_separate(): void
    {
        $customer = User::factory()->create(['username' => 'nama.sama', 'password' => Hash::make('password-pelanggan')]);
        $admin = Admin::create(['name' => 'Admin Pengujian', 'username' => 'nama.sama', 'password' => 'password-admin']);
        $this->assertSame($customer->id, $admin->id);

        $this->postJson(route('auth.adminLogin'), ['login' => 'nama.sama', 'password' => 'password-pelanggan'])
            ->assertUnprocessable()->assertJsonValidationErrors('login');
        $this->assertGuest('admin');

        $this->postJson(route('auth.login'), ['login' => 'nama.sama', 'password' => 'password-pelanggan'])
            ->assertOk()->assertJsonPath('user.role', 'user');
        $this->assertAuthenticatedAs($customer, 'web');
        $this->get(route('admin.home'))->assertForbidden();
        $this->get(route('admin.login'))->assertOk()->assertViewHas('page', 'admin-signin');

        $this->postJson(route('auth.adminLogin'), ['login' => 'nama.sama', 'password' => 'password-admin'])
            ->assertOk()->assertJsonPath('user.role', 'admin')->assertJsonMissingPath('user.password');
        $this->assertAuthenticatedAs($admin, 'admin');
        $this->assertGuest('web');
        $this->getJson(route('auth.session'))->assertJsonPath('user.role', 'admin');
        $this->get(route('admin.home'))->assertOk();
        $this->get(route('dashboard'))->assertRedirect(route('admin.home'));
        $this->get(route('admin.login'))->assertRedirect(route('dashboard'));
        $this->get(route('customer.home'))->assertRedirect(route('login'));
        $this->get(route('login'))->assertOk()->assertViewHas('page', 'signin');
        $this->postJson(route('auth.logout'))->assertOk();
        $this->assertGuest('web');
        $this->assertGuest('admin');
    }

    public function test_customer_login_cannot_select_the_admin_guard_from_input(): void
    {
        Admin::create(['name' => 'Admin Pengujian', 'username' => 'operator', 'password' => 'password-aman']);
        $credentials = ['login' => 'operator', 'password' => 'password-aman'];
        $this->postJson(route('auth.login'), $credentials)
            ->assertUnprocessable()->assertJsonValidationErrors('login');
        $this->postJson(route('auth.login'), [...$credentials, 'account_type' => 'admin'])
            ->assertUnprocessable()->assertJsonValidationErrors('account_type');
        $this->postJson(route('auth.adminLogin'), [...$credentials, 'role' => 'admin'])
            ->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->assertGuest('web');
        $this->assertGuest('admin');
    }

    public function test_failed_logins_are_limited_without_authenticating_the_user(): void
    {
        config(['auth.limits.login_attempts' => 2]);
        User::factory()->create(['username' => 'limited']);
        $credentials = ['login' => 'limited', 'password' => 'password-salah'];
        $this->postJson(route('auth.login'), $credentials)->assertUnprocessable();
        $this->postJson(route('auth.login'), $credentials)->assertUnprocessable();
        $this->postJson(route('auth.login'), $credentials)->assertStatus(429)->assertHeader('Retry-After');
        $this->postJson(route('auth.adminLogin'), $credentials)->assertUnprocessable();
        $this->assertGuest('web');
        $this->assertGuest('admin');
    }

    public function test_auth_endpoints_keep_csrf_protection_enabled(): void
    {
        $this->app->instance('env', 'local');
        try {
            $this->postJson(route('auth.login'), ['login' => 'pelanggan', 'password' => 'password-aman'])
                ->assertStatus(419);
            $this->postJson(route('auth.adminLogin'), ['login' => 'operator', 'password' => 'password-aman'])
                ->assertStatus(419);
        } finally {
            $this->app->instance('env', 'testing');
        }
    }

    public function test_duplicate_email_and_username_do_not_create_additional_accounts(): void
    {
        User::factory()->create(['username' => 'sudah.ada', 'email' => 'duplicate@example.test']);
        $this->postJson(route('auth.register'), $this->registrationData(['email' => 'DUPLICATE@example.test']))
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson(route('auth.register'), $this->registrationData(['username' => 'SUDAH.ADA']))
            ->assertUnprocessable()->assertJsonValidationErrors('username');
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('admins', 0);
    }

    public function test_database_errors_do_not_expose_internal_details_in_auth_responses(): void
    {
        config(['app.debug' => true]);
        User::saving(function () {
            throw new QueryException('sqlite', 'insert into users', [], new PDOException('private diagnostic'));
        });
        try {
            $this->postJson(route('auth.register'), $this->registrationData())
                ->assertStatus(503)->assertExactJson(['message' => 'Layanan akun belum dapat diakses. Silakan coba lagi.']);
        } finally {
            User::flushEventListeners();
        }
    }

    public function test_account_creation_stores_admin_in_the_admin_table_with_a_hashed_password(): void
    {
        $this->artisan('account:create', ['type' => 'admin', 'username' => 'operator', '--name' => 'Operator Pengujian'])
            ->expectsQuestion('Kata sandi akun', 'password-aman')
            ->expectsQuestion('Ulangi kata sandi akun', 'password-aman')->assertExitCode(0);
        $admin = Admin::firstOrFail();
        $this->assertSame('operator', $admin->username);
        $this->assertTrue(Hash::check('password-aman', $admin->password));
        $this->assertDatabaseCount('users', 0);
        $this->assertGuest('admin');
    }

    public function test_account_creation_does_not_replace_an_existing_account(): void
    {
        $admin = Admin::create(['name' => 'Operator Pengujian', 'username' => 'operator', 'password' => 'password-lama']);
        $this->artisan('account:create', ['type' => 'admin', 'username' => 'operator', '--name' => 'Nama Berbeda'])->assertExitCode(1);
        $this->assertSame('Operator Pengujian', $admin->fresh()->name);
        $this->assertTrue(Hash::check('password-lama', $admin->fresh()->password));
        $this->assertDatabaseCount('admins', 1);
    }

    public function test_short_test_password_is_only_allowed_for_explicit_local_test_accounts(): void
    {
        $this->artisan('account:create', ['type' => 'user', 'username' => 'akun.uji', '--name' => 'Akun Pengujian', '--test-account' => true])
            ->expectsQuestion('Kata sandi akun', 'short')
            ->expectsQuestion('Ulangi kata sandi akun', 'short')->assertExitCode(0);
        $this->assertTrue(Auth::guard('web')->validate(['username' => 'akun.uji', 'password' => 'short']));

        $this->app->instance('env', 'production');
        try {
            $this->artisan('account:create', ['type' => 'admin', 'username' => 'bukan.lokal', '--name' => 'Pengujian', '--test-account' => true])->assertExitCode(1);
            $this->assertDatabaseCount('admins', 0);
        } finally {
            $this->app->instance('env', 'testing');
        }
    }
}
