import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Built as static files and served by the FastAPI backend.
  output: "export",
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
