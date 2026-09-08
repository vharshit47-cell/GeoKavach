import { NextResponse } from "next/server";

import { getEarthquakes } from "@/backend/providers/earthquake";

export async function GET() {
  try {
    const result = await getEarthquakes();

    return NextResponse.json({
      success: true,
      live: result.status === "live" || result.status === "cached",
      source: result.source,
      status: result.status,
      updatedAt: result.fetchedAt ?? new Date().toISOString(),
      note: result.note,
      data: result.data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Unable to load earthquake data",
      },
      {
        status: 500,
      }
    );
  }
}