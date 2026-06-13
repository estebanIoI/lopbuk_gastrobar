import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // necesario para el Dockerfile de producción
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Los tenants configuran logos/imágenes con URLs externas arbitrarias
    // (Cloudinary, Pinterest, etc.), por eso se permite cualquier host https.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://backend:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
