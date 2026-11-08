import type { NextConfig } from "next";
// Development only: extra hosts allowed to load dev resources, for testing on a phone over the local network
// (for example WHOUSH_DEV_ORIGINS=192.168.1.211). Next.js blocks other origins in development by default.
const devOrigins=(process.env.WHOUSH_DEV_ORIGINS??"").split(",").map(s=>s.trim()).filter(Boolean);
// Development only: a second dev server (a plain-HTTP inspection copy beside the phone's HTTPS one) needs its own build folder, e.g. WHOUSH_DIST_DIR=.next-inspect.
const distDir=process.env.WHOUSH_DIST_DIR?.match(/^\.next-[a-z0-9-]+$/)?process.env.WHOUSH_DIST_DIR:undefined;
const nextConfig:NextConfig={reactStrictMode:true,...(devOrigins.length?{allowedDevOrigins:devOrigins}:{}),...(distDir?{distDir}:{})};
export default nextConfig;
