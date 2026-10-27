<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facilities', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150)->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('type', 20);
            $table->unsignedInteger('capacity');
            $table->string('location', 200);
            $table->string('floor', 80);
            $table->text('rules');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->text('maintenance_notes')->nullable();
            $table->string('image_url', 1000)->nullable();
            $table->json('floor_plan');
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('facility_room', function (Blueprint $table) {
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->primary(['facility_id', 'room_id']);
        });
        Schema::create('room_status_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->index(['room_id', 'starts_at', 'ends_at']);
        });
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('room_id')->constrained()->restrictOnDelete();
            $table->text('purpose');
            $table->unsignedInteger('attendees');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('status', 24)->default('confirmed');
            $table->dateTime('checked_in_at')->nullable();
            $table->dateTime('checked_out_at')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->dateTime('no_show_at')->nullable();
            $table->timestamps();
            $table->index(['room_id', 'status', 'starts_at', 'ends_at'], 'reservation_availability_index');
            $table->index(['user_id', 'starts_at']);
        });
        Schema::create('maintenance_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->restrictOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->text('reason');
            $table->timestamps();
            $table->index(['room_id', 'starts_at', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_blocks');
        Schema::dropIfExists('reservations');
        Schema::dropIfExists('room_status_periods');
        Schema::dropIfExists('facility_room');
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('facilities');
    }
};
