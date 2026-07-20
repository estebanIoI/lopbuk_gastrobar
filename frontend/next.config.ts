import type { NextConfig } from "next";

// Identificador único por build. Se hornea en el bundle (cliente y servidor) para que la
// PWA detecte que hay una versión nueva desplegada y ofrezca "Actualizar". Se puede fijar
// con BUILD_ID en el entorno del build; si no, usa el timestamp del momento del build.
const BUILD_ID = process.env.BUILD_ID || String(Date.now());

const nextConfig: NextConfig = {
  output: 'standalone', // necesario para el Dockerfile de producción
  generateBuildId: async () => BUILD_ID,
  experimental: {
    // El rewrite /api/* proxea al backend. Next corta el proxy a los 30s por defecto
    // y mata la conexión sin responder, lo que Cloudflare traduce a un 502 con HTML.
    // Las llamadas de visión (analyze-image, OCR de facturas) pasan de 30s con
    // facilidad. El backend aborta la llamada a la IA antes de este límite, así que
    // el error que ve el usuario siempre es JSON del backend, no un 502 opaco.
    proxyTimeout: 120_000,
  },
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
  async redirects() {
    return [
      // Engagement vive como sección nativa del panel (/panel/engagement), igual que
      // Clientes o Empleados. Estas dos rutas cortas existen para links y bookmarks:
      // /fidelizacion es el nombre viejo del módulo y no se puede romper.
      { source: '/engagement', destination: '/panel/engagement', permanent: true },
      { source: '/fidelizacion', destination: '/panel/engagement', permanent: true },
    ];
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
