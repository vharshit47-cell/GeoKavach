import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "@/frontend/styles/preferences.css";
import "@/frontend/styles/intelligence.css";
import "@/frontend/styles/decision-support.css";
import "@/frontend/styles/reference-design.css";
import "@/frontend/styles/safety-experience.css";
import "@/frontend/styles/professional-ui.css";
import { AppPreferencesProvider } from "@/components/AppPreferences";
import { LocationSafetyProvider } from "@/components/LocationSafetyManager";
import { EmergencyHelp } from "@/components/EmergencyHelp";

export const metadata: Metadata = {
  title: "GeoKavach | India Disaster Intelligence",
  description: "SIH26191 habitation risk assessment, hazard mapping, carrying capacity and relocation decision support.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><AppPreferencesProvider><LocationSafetyProvider>{children}<EmergencyHelp /></LocationSafetyProvider></AppPreferencesProvider></body>
    </html>
  );
}
