import { getVerifiedUser } from "@/backend/supabase/server";
import { boundedJson, boundedText, privateJson, sameOrigin } from "@/backend/supabase/http";

export async function POST(request: Request) {
  try {
    const body = await boundedJson(request);
    if (!body || body.consent !== true) return privateJson({ error: "Explicit consent is required to save precise location." }, 400);
    const name = boundedText(body.name);
    const state = body.state == null ? "" : boundedText(body.state);
    const district = body.district == null ? "" : boundedText(body.district);
    if (!name || state === null || district === null || typeof body.latitude !== "number" || !Number.isFinite(body.latitude) || body.latitude < 6 || body.latitude > 38 || typeof body.longitude !== "number" || !Number.isFinite(body.longitude) || body.longitude < 68 || body.longitude > 98) return privateJson({ error: "Enter a valid name and location within the India coverage region." }, 400);
    const { supabase, user } = await getVerifiedUser();
    if (!supabase || !user) return privateJson({ error: "Sign in to save a location." }, 401);
    const { count, error: countError } = await supabase.from("saved_locations").select("id", { head: true, count: "exact" }).eq("user_id", user.id);
    if (countError) return privateJson({ error: "Saved location storage is unavailable." }, 503);
    if ((count || 0) >= 50) return privateJson({ error: "You can save up to 50 locations." }, 400);
    const { data, error } = await supabase.from("saved_locations").insert({ user_id: user.id, name, latitude: body.latitude, longitude: body.longitude, state: state || null, district: district || null }).select().single();
    if (error) return privateJson({ error: "Could not save this location." }, 503);
    return privateJson({ location: data }, 201);
  } catch { return privateJson({ error: "Could not save this location." }, 503); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return privateJson({ error: "Invalid request origin." }, 403);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return privateJson({ error: "Invalid location identifier." }, 400);
  try {
    const { supabase, user } = await getVerifiedUser();
    if (!supabase || !user) return privateJson({ error: "Sign in to manage saved locations." }, 401);
    const { error } = await supabase.from("saved_locations").delete().eq("id", id).eq("user_id", user.id);
    return error ? privateJson({ error: "Could not remove this location." }, 503) : privateJson({ removed: true });
  } catch { return privateJson({ error: "Could not remove this location." }, 503); }
}
