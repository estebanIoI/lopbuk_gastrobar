import type { NextConfig } from "next";

// Identificador único por build. Se hornea en el bundle (cliente y servidor) para que la
// PWA detecte que hay una versión nueva desplegada y ofrezca "Actualizar". Se puede fijar
// con BUILD_ID en el entorno del build; si no, usa el timestamp del momento del build.
const BUILD_ID = process.env.BUILD_ID || String(Date.now());

const nextConfig: NextConfig = {
  output: 'standalone', // necesario para el Dockerfile de producción
  generateBuildId: async () => BUILD_ID,
  env: {
    NEXT_PUBLIC_APP_VERSION: BUILD_ID,
  },
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
