import { NextRequest, NextResponse } from "next/server";
import { getLocationIntelligence } from "@/backend/services/location-intelligence";
import { reverseLocation } from "@/backend/providers/geocoding";

// Approximate India bounds; not a political boundary assertion.
const INDIA_LAT = { min: 6, max: 38 };
const INDIA_LON = { min: 67, max: 98 };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const latParam = searchParams.get("lat");
    const lonParam = searchParams.get("lon");

    if (!latParam || !lonParam) {
      return NextResponse.json(
        {
          success: false,
          message: "lat and lon are required. Example: /api/location-risk?lat=26.8467&lon=80.9462",
        },
        { status: 400 }
      );
    }

    const lat = Number(latParam);
    const lon = Number(lonParam);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json(
        { success: false, message: "Invalid latitude or longitude" },
        { status: 400 }
      );
    }

    if (
      lat < INDIA_LAT.min || lat > INDIA_LAT.max ||
      lon < INDIA_LON.min || lon > INDIA_LON.max
    ) {
      return NextResponse.json(
        { success: false, message: "Location must be within the India region" },
        { status: 400 }
      );
    }

    // Optional place context from query params
    const state = searchParams.get("state")?.trim().slice(0, 100) || undefined;
    const district = searchParams.get("district")?.trim().slice(0, 100) || undefined;

    // Try to resolve name from boundaries if not supplied
    let name: string | undefined;
    if (!state && !district) {
      try {
        const places = await reverseLocation(lat, lon);
        const place = places.data?.[0];
        if (place) {
          name = place.name;
        }
      } catch {
        // Name lookup is optional; coordinates always work
      }
    } else {
      name = [district, state].filter(Boolean).join(", ");
    }

    // Full location intelligence pipeline: weather + earthquakes + alerts + groundwater + facilities + news
    const intelligence = await getLocationIntelligence(
      { latitude: lat, longitude: lon, name, state, district },
      100 // 100 km radius for habitation-level queries; earthquakes use max(100, 300) = 300 km
    );

    return NextResponse.json({
      success: true,
      ...intelligence,
    });
  } catch (error) {
    console.error("Location Risk API Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch location risk data",
      },
      { status: 500 }
    );
  }
}