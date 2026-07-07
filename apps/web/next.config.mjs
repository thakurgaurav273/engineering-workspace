/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are consumed as TypeScript source, so Next must transpile them.
  transpilePackages: ["@grovyn/ui", "@grovyn/utils", "@grovyn/types"],
  // Lint is run as its own CI step (and the repo has pre-existing formatting debt);
  // don't let `next build` gate on it.
  eslint: { ignoreDuringBuilds: true },
  // Dev API + websocket proxy (mirrors the old vite.config proxy so /api and /socket.io
  // still reach the NestJS backend on :3001 during local development).
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:3001/:path*" },
      { source: "/socket.io/:path*", destination: "http://localhost:3001/socket.io/:path*" },
    ];
  },
};

export default nextConfig;
