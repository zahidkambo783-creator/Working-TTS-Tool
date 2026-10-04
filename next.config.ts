import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // edge-tts ships raw TypeScript source files — transpile so Next.js can process them
  transpilePackages: ["edge-tts"],

  // ws is a Node.js WebSocket package — must not be bundled for the browser
  serverExternalPackages: ["ws"],

  // Silence turbopack/webpack mismatch warning
  turbopack: {},
};

export default nextConfig;
