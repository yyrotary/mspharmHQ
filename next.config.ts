import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: 'https://:host/:path*',
        permanent: true
      }
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }
        ]
      }
    ];
  },
  output: 'standalone',
  typescript: {
    // 타입 검사를 무시합니다
    ignoreBuildErrors: true,
  },
  eslint: {
    // 린트 검사를 무시합니다
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
