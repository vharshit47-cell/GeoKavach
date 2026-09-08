/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/groundwater": ["./src/backend/data/groundwater/groundwater_master.csv"],
    "/api/location-risk": ["./src/backend/data/groundwater/groundwater_master.csv"],
    "/api/ai/chat": ["./src/backend/data/groundwater/groundwater_master.csv"],
  },
};

export default nextConfig;
