/**
 * GET /app-version — devuelve el id de build ACTUAL del servidor (horneado en el bundle
 * por next.config → NEXT_PUBLIC_APP_VERSION). El cliente compara este valor contra el que
 * trae horneado; si difieren, hay un despliegue nuevo y ofrece "Actualizar".
 * Se sirve fuera de /api para no pasar por el rewrite hacia el backend.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(
    JSON.stringify({ version: process.env.NEXT_PUBLIC_APP_VERSION || 'dev' }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' } }
  );
}
