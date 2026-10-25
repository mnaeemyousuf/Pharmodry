/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  // Separate build directory for side-by-side debugging (default .next).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  eslint: { dirs: ['app', 'components', 'lib'] },
  // API calls go through app/api/v1/[...path]/route.ts (runtime API_URL, same-origin cookies).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
