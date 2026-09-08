import { NextRequest, NextResponse } from "next/server";

import { getWeather } from "@/backend/providers/weather";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const latParam = searchParams.get("lat");
    const lonParam = searchParams.get("lon");

    if (!latParam || !lonParam) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Latitude and longitude are required. Example: /api/weather?lat=26.8467&lon=80.9462",
        },
        {
          status: 400,
        }
      );
    }

    const latitude = Number(latParam);
    const longitude = Number(lonParam);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid latitude or longitude",
        },
        {
          status: 400,
        }
      );
    }

    // Limit to India / nearby Indian region
    if (
      latitude < 6 ||
      latitude > 38 ||
      longitude < 68 ||
      longitude > 98
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Location must be within the India region",
        },
        {
          status: 400,
        }
      );
    }

    const result = await getWeather(latitude, longitude);

    return NextResponse.json({
      success: true,
      live: result.status === "live" || result.status === "cached",
      source: result.source,
      status: result.status,
      region: "India",
      updatedAt: result.fetchedAt ?? new Date().toISOString(),
      note: result.note,
      data: result.data,
    });
  } catch (error) {
    console.error("Weather API Error:", error);

    return NextResponse.json(
      {
        success: false,
        live: false,
        message:
          "Unable to fetch live weather data",
      },
      {
        status: 500,
      }
    );
  }
}