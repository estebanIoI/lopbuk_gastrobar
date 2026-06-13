/**
 * Activos de marca DAIMUZ (plataforma).
 * Las rutas apuntan a /public (la carpeta tiene espacios → se codifican como %20).
 *
 * Roles visuales:
 *  - isotipo: insignia limpia (sin contenedor). Favicon, navbars, footer, fallback de logos.
 *  - icon: icono sobre contenedor navy sólido. PWA, apple-touch, Open Graph, avatar por defecto.
 *  - iconTransparent: variante adaptativa (esquinas transparentes). Marcas de agua / dark mode.
 */
export const BRAND = {
  name: 'DAIMUZ',
  isotipo: '/daimuz-isotipo.png',
  icon: '/daimuz-icon.png',
  iconTransparent: '/daimuz-icon-transparent.png',
} as const
