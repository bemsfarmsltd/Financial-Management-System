import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: '/api/v1/fund-requests', destination: '/api/requests' },
      { source: '/api/v1/fund-requests/:id', destination: '/api/requests/:id' },
      { source: '/api/v1/approvals/pending', destination: '/api/approvals' },
      { source: '/api/v1/:path*', destination: '/api/:path*' },
    ];
  },
};

export default nextConfig;
