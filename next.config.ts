import type { NextConfig } from "next";
// Development only: extra hosts allowed to load dev resources, for testing on a phone over the local network
// (for example WHOUSH_DEV_ORIGINS=192.168.1.211). Next.js blocks other origins in development by default.
const devOrigins=(process.env.WHOUSH_DEV_ORIGINS??"").split(",").map(s=>s.trim()).filter(Boolean);
const nextConfig:NextConfig={reactStrictMode:true,...(devOrigins.length?{allowedDevOrigins:devOrigins}:{})};
export default nextConfig;
