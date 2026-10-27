<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FacilityController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Facility::query()->withCount('rooms')->orderBy('name')->limit(300)->get()]);
    }

    public function show(Facility $facility): JsonResponse
    {
        return response()->json(['data' => $facility]);
    }

    public function store(Request $request): JsonResponse
    {
        $input = $request->validate(['name' => ['required', 'string', 'max:150', 'unique:facilities,name'], 'description' => ['nullable', 'string', 'max:2000']]);
        return response()->json(['data' => Facility::create($input), 'message' => 'Fasilitas berhasil ditambahkan.'], 201);
    }

    public function update(Request $request, Facility $facility): JsonResponse
    {
        $input = $request->validate(['name' => ['sometimes', 'string', 'max:150', Rule::unique('facilities', 'name')->ignore($facility->id)], 'description' => ['nullable', 'string', 'max:2000']]);
        $facility->update($input);
        return response()->json(['data' => $facility, 'message' => 'Fasilitas berhasil diperbarui.']);
    }

    public function destroy(Facility $facility): JsonResponse
    {
        DB::transaction(function () use ($facility) {
            Facility::query()->lockForUpdate()->findOrFail($facility->id);
            if (DB::table('facility_room')->where('facility_id', $facility->id)->exists()) {
                throw ValidationException::withMessages(['facility' => 'Fasilitas masih digunakan ruangan. Lepaskan dari ruangan terlebih dahulu.']);
            }
            $facility->delete();
        });
        return response()->json(['message' => 'Fasilitas berhasil dihapus.']);
    }
}
