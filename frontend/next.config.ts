import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Production builds are static files served by the FastAPI backend, which also serves /api.
  // In development, `next dev` proxies /api to the backend instead (rewrites need a server).
  ...(isDev
    ? {
        rewrites: async () => [
          { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
        ],
      }
    : { output: "export" }),
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
