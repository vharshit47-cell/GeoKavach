import { getVerifiedUser } from "@/backend/supabase/server";
import { boundedJson, boundedText, privateJson } from "@/backend/supabase/http";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/shared/types/profile";

export async function GET() {
  try {
    const { supabase, user } = await getVerifiedUser();
    if (!supabase || !user) return privateJson({ error: "Sign in to access your profile." }, 401);
    const [profile, preferences, locations] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("saved_locations").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (profile.error || preferences.error || locations.error) return privateJson({ error: "Profile storage is unavailable. Check that the Supabase migration has been applied." }, 503);
    return privateJson({ profile: profile.data, preferences: preferences.data || DEFAULT_NOTIFICATION_PREFERENCES, locations: locations.data || [], email: user.email });
  } catch { return privateJson({ error: "Profile temporarily unavailable." }, 503); }
}

export async function PATCH(request: Request) {
  try {
    const body = await boundedJson(request);
    if (!body) return privateJson({ error: "Invalid profile request." }, 400);
    const { supabase, user } = await getVerifiedUser();
    if (!supabase || !user) return privateJson({ error: "Sign in to save preferences." }, 401);
    const profile: Record<string, unknown> = {};
    for (const key of ["full_name", "state", "district"] as const) {
      if (body[key] !== undefined) {
        const value = boundedText(body[key]);
        if (value === null || (key === "full_name" && !value)) return privateJson({ error: "Invalid profile field." }, 400);
        profile[key] = value || null;
      }
    }
    if (body.preferred_language !== undefined) {
      if (!["en", "hi"].includes(String(body.preferred_language))) return privateJson({ error: "Unsupported language." }, 400);
      profile.preferred_language = body.preferred_language;
    }
    // Precise locations have their own explicit-consent endpoint.
    if (Object.keys(profile).length) {
      const { error } = await supabase.from("profiles").update(profile).eq("id", user.id);
      if (error) return privateJson({ error: "Could not save your profile." }, 503);
    }
    if (body.preferences !== undefined) {
      if (!body.preferences || typeof body.preferences !== "object" || Array.isArray(body.preferences)) return privateJson({ error: "Invalid notification preferences." }, 400);
      const supplied = body.preferences as Record<string, unknown>;
      const preferences: Record<string, unknown> = { user_id: user.id };
      for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES)) {
        if (supplied[key] === undefined) continue;
        if (key === "notification_radius_km") {
          if (typeof supplied[key] !== "number" || ![10, 25, 50, 100, 250].includes(supplied[key])) return privateJson({ error: "Invalid notification radius." }, 400);
        } else if (typeof supplied[key] !== "boolean") return privateJson({ error: "Invalid alert preference." }, 400);
        preferences[key] = supplied[key];
      }
      const { error } = await supabase.from("notification_preferences").upsert(preferences, { onConflict: "user_id" });
      if (error) return privateJson({ error: "Could not save notification preferences." }, 503);
    }
    return privateJson({ saved: true });
  } catch { return privateJson({ error: "Could not save preferences." }, 503); }
}
