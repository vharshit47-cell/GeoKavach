export type Language = "en" | "hi";
export interface Profile {
  id: string;
  full_name: string;
  preferred_language: Language;
  state: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}
export interface SavedLocation {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  state: string | null;
  district: string | null;
  created_at: string;
}
export interface NotificationPreferences {
  earthquake_enabled: boolean;
  flood_enabled: boolean;
  landslide_enabled: boolean;
  cyclone_enabled: boolean;
  weather_enabled: boolean;
  nearby_news_enabled: boolean;
  notification_radius_km: number;
  browser_notifications_enabled: boolean;
}
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  earthquake_enabled: true, flood_enabled: true, landslide_enabled: true,
  cyclone_enabled: true, weather_enabled: true, nearby_news_enabled: false,
  notification_radius_km: 50, browser_notifications_enabled: false,
};
