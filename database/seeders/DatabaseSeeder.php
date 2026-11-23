<?php

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\Facility;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Admin
        Admin::firstOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Administrator',
                'password' => 'password',
            ]
        );

        // Pelanggan
        User::firstOrCreate(
            ['username' => 'pelanggan'],
            [
                'name' => 'Pelanggan Demo',
                'email' => 'pelanggan@example.com',
                'password' => 'password',
            ]
        );

        // Fasilitas
        $facilities = [
            ['name' => 'Wi-Fi Super Cepat', 'description' => 'Akses internet berkecepatan tinggi hingga 100 Mbps.'],
            ['name' => 'AC & Air Purifier', 'description' => 'Ruangan berpendingin udara dengan penyaring udara higienis.'],
            ['name' => 'Stop Kontak & Fast Charging', 'description' => 'Soket listrik dan port USB multi-port di setiap meja.'],
            ['name' => 'Smart Display / Monitor', 'description' => 'Monitor 27 inch untuk presentasi dan second screen.'],
            ['name' => 'Peredam Suara Akustik', 'description' => 'Dinding akustik kedap suara untuk privasi meeting/telepon.'],
            ['name' => 'Free Flow Minuman', 'description' => 'Kopi, teh, dan air mineral gratis.'],
        ];

        $facilityModels = [];
        foreach ($facilities as $fac) {
            $facilityModels[] = Facility::firstOrCreate(['name' => $fac['name']], $fac);
        }

        $allFacilityIds = collect($facilityModels)->pluck('id')->all();

        // Ruangan / Booth
        if (Room::count() === 0) {
            $booth1 = Room::create([
                'name' => 'Solo Focus Booth Alpha',
                'type' => 'booth',
                'capacity' => 1,
                'location' => 'Lantai 1 - Silent Zone',
                'floor' => '1',
                'rules' => 'Dilarang merokok, menjaga ketenangan, dan dilarang meninggalkan sampah.',
                'description' => 'Booth privat kedap suara untuk fokus kerja mendalam, panggilan video, atau interview online.',
                'is_active' => true,
                'floor_plan' => ['width' => 2, 'depth' => 2, 'desks' => 1, 'door' => 'bottom'],
            ]);
            $booth1->facilities()->sync([$allFacilityIds[0], $allFacilityIds[1], $allFacilityIds[2], $allFacilityIds[4]]);
            $booth1->statusPeriods()->create(['starts_at' => now()]);

            $booth2 = Room::create([
                'name' => 'Couple Pod Booth Beta',
                'type' => 'booth',
                'capacity' => 2,
                'location' => 'Lantai 1 - Pod Area',
                'floor' => '1',
                'rules' => 'Harap gunakan headset jika mendengarkan audio bersama.',
                'description' => 'Booth nyaman untuk 2 orang untuk diskusi privat atau kolaborasi berpasangan.',
                'is_active' => true,
                'floor_plan' => ['width' => 3, 'depth' => 2, 'desks' => 1, 'door' => 'bottom'],
            ]);
            $booth2->facilities()->sync([$allFacilityIds[0], $allFacilityIds[1], $allFacilityIds[2], $allFacilityIds[4], $allFacilityIds[5]]);
            $booth2->statusPeriods()->create(['starts_at' => now()]);

            $workspace1 = Room::create([
                'name' => 'Creative Workspace Gamma',
                'type' => 'workspace',
                'capacity' => 6,
                'location' => 'Lantai 2 - Kolaborasi',
                'floor' => '2',
                'rules' => 'Maksimal 6 peserta. Harap merapikan kursi dan meja setelah digunakan.',
                'description' => 'Ruang kerja tim yang luas dilengkapi Smart Display dan papan tulis untuk sprint atau brainstorming.',
                'is_active' => true,
                'floor_plan' => ['width' => 6, 'depth' => 4, 'desks' => 2, 'door' => 'bottom'],
            ]);
            $workspace1->facilities()->sync($allFacilityIds);
            $workspace1->statusPeriods()->create(['starts_at' => now()]);
        }
    }
}
