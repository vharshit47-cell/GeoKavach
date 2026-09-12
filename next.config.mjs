/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": ["./src/backend/data/**/*"],
    "/api/*": ["./src/backend/data/**/*"],
    "/api/**": ["./src/backend/data/**/*"],
  },
};

export default nextConfig;
