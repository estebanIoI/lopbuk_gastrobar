/**
 * services/api.ts — Cliente del área CARTILLA integrado con el backend Lopbuk.
 *
 * - Base: NEXT_PUBLIC_API_URL (Lopbuk Express).
 * - Auth: cookie httpOnly de Lopbuk (credentials:'include') + Bearer opcional
 *   desde localStorage('token') para uso standalone.
 * - Envelope: el backend responde { success, data } -> se desempaqueta a data.
 * - Scoping: el área es por CARTILLA activa. setActiveCartilla(idOrSlug) fija
 *   la cartilla a la que apuntan los endpoints de módulos/retos/comunidad/etc.
 */

// Por defecto usa la ruta relativa '/api' (Next reescribe /api/* al backend,
// mismo origen → la cookie httpOnly de sesión viaja sin CORS).
const API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || '/api';
const REQUEST_TIMEOUT_MS = 15_000;

// ── Cartilla activa (scope global del área) ───────────────────────────────────
let ACTIVE_CARTILLA = '';
export const setActiveCartilla = (idOrSlug: string) => { ACTIVE_CARTILLA = idOrSlug; };
export const getActiveCartilla = () => ACTIVE_CARTILLA;
const cid = () => encodeURIComponent(ACTIVE_CARTILLA);

// ── Token helpers ─────────────────────────────────────────────────────────────
const getToken = (): string | null =>
  (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
const clearToken = () => { if (typeof localStorage !== 'undefined') localStorage.removeItem('token'); };

const headers = (withAuth = false): HeadersInit => {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth) {
    const t = getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
  }
  return h;
};

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden()    { return this.status === 403; }
  get isPaymentRequired() { return this.status === 402; }
  get isNotFound()     { return this.status === 404; }
}

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
    });
    if (res.status === 401) clearToken();

    let body: any;
    const ct = res.headers.get('content-type') || '';
    body = ct.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok || (body && typeof body === 'object' && body.success === false)) {
      const message =
        (body && typeof body === 'object' && (body.error || body.message)) || 'Error en la solicitud';
      throw new ApiError(res.status, String(message));
    }
    // Desempaqueta el envelope { success, data }
    if (body && typeof body === 'object' && 'success' in body) return body.data as T;
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, 'La solicitud tardó demasiado. Verifica tu conexión.');
    }
    throw new ApiError(0, 'Sin conexión. Verifica tu red e intenta de nuevo.');
  } finally {
    clearTimeout(timer);
  }
};

// ════════════════════ TIPOS ════════════════════
export interface UsuarioAPI {
  id: number | string;
  nombre: string;
  email?: string;
  avatar: string;
  nivel: string;
  role?: string;
  puntos: number;
  frase?: string;
  dias_seguidos?: number;
  palabras_aprendidas?: number;
}
export interface LoginResponse { token: string; usuario: UsuarioAPI; }

export interface ActividadPublicaAPI {
  id: number | string;
  tipo: 'completar' | 'emparejar' | 'verdadero_falso' | 'ordenar';
  pregunta: string;
  respuesta_correcta?: string | null;
  opciones?: { id: number | string; texto: string; orden: number }[];
  pares?: { id: number | string; inga: string; espanol: string }[];
  enunciados_vf?: { id: number | string; enunciado: string; es_verdadero: boolean; orden: number }[];
  fragmentos_ordenar?: { id: number | string; fragmento: string; orden_correcto: number }[];
}
export interface ModuloImagenPublicaAPI { id: number | string; url: string; alt: string | null; caption: string | null; orden: number; }
export interface ModuloSeccionPublicaAPI { id: number | string; titulo: string; contenido: string | null; tipo: string; orden: number; }
export interface ModuloAudioPublicaAPI { id: number | string; titulo: string; url: string; descripcion: string | null; orden: number; }

export interface ActividadAPI {
  tipo: 'completar' | 'emparejar';
  pregunta: string;
  respuestaCorrecta?: string;
  opciones?: string[];
  pares?: { id: number | string; inga: string; espanol: string }[];
}
export interface ModuloAPI {
  id: number | string;
  clave: string;
  titulo: string;
  icono: string;
  color: string;
  descripcion: string;
  video_url: string;
  frase: string;
  traduccion: string;
  actividad?: ActividadAPI;
  actividades?: ActividadPublicaAPI[];
  imagenes?: ModuloImagenPublicaAPI[];
  secciones?: ModuloSeccionPublicaAPI[];
  audios?: ModuloAudioPublicaAPI[];
}
export interface RespuestaAPI { correcta: boolean; puntos_obtenidos: number; puntos_totales: number; }

export interface RetoAPI {
  id: number | string;
  titulo: string;
  descripcion: string;
  puntos: number;
  dificultad: 'facil' | 'medio' | 'dificil';
  categoria: 'vocabulario' | 'conversacion' | 'modulo' | 'comunidad';
  meta: number | null;
  completado: boolean;
  actual: number;
  progreso: number;
}
export interface PublicacionAPI {
  id: number | string; usuario: string; avatar: string; contenido: string;
  likes: number; comentarios: number; creado_en: string;
}
export interface ComentarioAPI { id: number | string; usuario: string; avatar: string; contenido: string; creado_en: string; }
export interface PaginatedResponse<T> { data: T[]; page: number; pageSize: number; total: number; hasMore: boolean; }
export interface ResultadoTraductorAPI {
  id: number | string; espanol: string; inga: string; categoria: string;
  notas: string | null; coincide: 'espanol' | 'inga';
}

// Catálogo de cartillas
export interface CartillaCatalogoAPI {
  id: string; tenantId: string; comercio: string | null; comercioSlug: string | null;
  slug: string; titulo: string; tipo: 'cartilla' | 'libro' | 'curso';
  descripcion: string | null; portadaUrl: string | null; color: string;
  autor: string | null; idioma: string; nivel: string | null;
  frase: string | null; traduccion: string | null;
  esGratis: boolean; precio: number; moneda: string;
  publicado: boolean; destacado: boolean; totalModulos?: number; ventas?: number;
  acceso?: boolean;
}

// Tipos heredados que algunos componentes aún referencian (sin backend dedicado).
export interface BannerSlideAPI { id: number | string; titulo: string; subtitulo: string | null; imagen_url: string | null; imagen_alt: string | null; link_url: string | null; orden: number; }
export interface SeccionPublicaAPI { id: number | string; titulo: string; subtitulo: string | null; contenido: string | null; imagen_url: string | null; imagen_alt: string | null; link_url: string | null; orden: number; tipo: string; }

// ════════════════════ CATÁLOGO (global) ════════════════════
export const cartillasAPI = {
  catalogo: (params: { tipo?: string; q?: string; comercio?: string; destacado?: boolean; page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.tipo) qs.set('tipo', params.tipo);
    if (params.q) qs.set('q', params.q);
    if (params.comercio) qs.set('comercio', params.comercio);
    if (params.destacado) qs.set('destacado', 'true');
    if (params.page) qs.set('page', String(params.page));
    const s = qs.toString();
    return request<PaginatedResponse<CartillaCatalogoAPI>>(`/cartillas/catalogo${s ? `?${s}` : ''}`, { headers: headers(true) });
  },
  obtener: (slug: string) =>
    request<CartillaCatalogoAPI>(`/cartillas/catalogo/${encodeURIComponent(slug)}`, { headers: headers(true) }),
  comprar: (slug: string, metodo = 'manual') =>
    request<{ compra: any; acceso: boolean; checkoutUrl?: string | null }>(
      `/cartillas/${encodeURIComponent(slug)}/comprar`,
      { method: 'POST', headers: headers(true), body: JSON.stringify({ metodo }) }
    ),
  misCompras: () => request<any[]>(`/cartillas/mis-compras`, { headers: headers(true) }),
};

// ════════════════════ AUTH (sesión Lopbuk) ════════════════════
const mapProfile = (u: any): UsuarioAPI => ({
  id: u.id, nombre: u.name || u.nombre || 'Usuario', email: u.email,
  avatar: u.avatar || '🌱', nivel: u.nivel || 'Nuevo', role: u.role || 'cliente',
  puntos: u.puntos ?? 0, dias_seguidos: u.dias_seguidos ?? 0, palabras_aprendidas: u.palabras_aprendidas ?? 0,
});

export const authAPI = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const data = await request<{ token: string; user: any }>('/auth/login', {
      method: 'POST', headers: headers(), body: JSON.stringify({ email, password }),
    });
    if (data?.token && typeof localStorage !== 'undefined') localStorage.setItem('token', data.token);
    return { token: data.token, usuario: mapProfile(data.user) };
  },
  registro: async (nombre: string, email: string, password: string): Promise<LoginResponse> => {
    const data = await request<{ token: string; user: any }>('/auth/register', {
      method: 'POST', headers: headers(), body: JSON.stringify({ name: nombre, email, password, role: 'cliente' }),
    });
    if (data?.token && typeof localStorage !== 'undefined') localStorage.setItem('token', data.token);
    return { token: data.token, usuario: mapProfile(data.user) };
  },
  googleLogin: async (credential: string): Promise<LoginResponse> => {
    const data = await request<{ token: string; user: any }>('/auth/google', {
      method: 'POST', headers: headers(), body: JSON.stringify({ credential }),
    });
    if (data?.token && typeof localStorage !== 'undefined') localStorage.setItem('token', data.token);
    return { token: data.token, usuario: mapProfile(data.user) };
  },
  perfil: async (): Promise<UsuarioAPI> => {
    const u = await request<any>('/auth/profile', { headers: headers(true) });
    return mapProfile(u);
  },
};

// ════════════════════ USUARIOS / RANKING (scoped) ════════════════════
export const usuariosAPI = {
  top: () => request<UsuarioAPI[]>(`/cartillas/${cid()}/top`, { headers: headers() }),
  activos: () => request<{ total: number }>(`/cartillas/${cid()}/activos`, { headers: headers() }),
  stats: () => request<{ puntos: number; dias_seguidos: number; palabras_aprendidas: number; modulos_total: number }>(
    `/cartillas/${cid()}/stats`, { headers: headers(true) }
  ),
};

// ════════════════════ MÓDULOS (scoped) ════════════════════
export const modulosAPI = {
  listar: () => request<ModuloAPI[]>(`/cartillas/${cid()}/modulos`, { headers: headers(true) }),
  obtener: (clave: string) => request<ModuloAPI>(`/cartillas/${cid()}/modulos/${encodeURIComponent(clave)}`, { headers: headers(true) }),
  responder: (clave: string, respuesta: string) =>
    request<RespuestaAPI>(`/cartillas/${cid()}/modulos/${encodeURIComponent(clave)}/responder`, {
      method: 'POST', headers: headers(true), body: JSON.stringify({ respuesta }),
    }),
};

// ════════════════════ RETOS (scoped) ════════════════════
export const retosAPI = {
  listar: () => request<RetoAPI[]>(`/cartillas/${cid()}/retos`, { headers: headers(true) }),
};

// ════════════════════ COMUNIDAD (scoped) ════════════════════
export const comunidadAPI = {
  listarPublicaciones: (page = 1) =>
    request<PaginatedResponse<PublicacionAPI>>(`/cartillas/${cid()}/comunidad?page=${page}`, { headers: headers() }),
  crearPublicacion: (contenido: string) =>
    request<PublicacionAPI>(`/cartillas/${cid()}/comunidad`, {
      method: 'POST', headers: headers(true), body: JSON.stringify({ contenido }),
    }),
  toggleLike: (id: number | string) =>
    request<{ likes: number; liked: boolean }>(`/cartillas/comunidad/${id}/like`, { method: 'POST', headers: headers(true) }),
  listarComentarios: (id: number | string) =>
    request<ComentarioAPI[]>(`/cartillas/comunidad/${id}/comentarios`, { headers: headers() }),
  crearComentario: (id: number | string, contenido: string) =>
    request<ComentarioAPI>(`/cartillas/comunidad/${id}/comentarios`, {
      method: 'POST', headers: headers(true), body: JSON.stringify({ contenido }),
    }),
};

// ════════════════════ TRADUCTOR / VOCABULARIO (scoped) ════════════════════
export const traductorAPI = {
  buscar: (q: string) => {
    if (!q || q.trim().length < 2) return Promise.resolve({ resultados: [] as ResultadoTraductorAPI[], total: 0 });
    return request<{ resultados: ResultadoTraductorAPI[]; total: number }>(
      `/cartillas/${cid()}/vocabulario?q=${encodeURIComponent(q.trim())}`, { headers: headers() }
    );
  },
};

// ════════════════════ SECCIONES DE PRESENTACIÓN (compat heredada) ════════════
export const seccionesPublicAPI = {
  getBanner: () => Promise.resolve([] as BannerSlideAPI[]),
  getActivas: () => Promise.resolve([] as SeccionPublicaAPI[]),
};

// ════════════════════ ADMIN - TIPOS ════════════════════
export interface AdminStatsAPI {
  total_usuarios: number;
  usuarios_activos_hoy: number;
  modulos_completados: number;
  total_publicaciones: number;
  puntos_totales: number;
  total_modulos: number;
}

export interface AdminUsuarioAPI {
  id: number | string;
  nombre: string;
  email: string;
  avatar: string;
  nivel: string;
  puntos: number;
  role: string;
  modulos_completados: number;
  ultimo_acceso: string | null;
}

export interface AdminModuloAPI {
  id: number | string;
  clave: string;
  titulo: string;
  icono: string;
  color: string;
  descripcion: string;
  video_url: string;
  frase: string;
  traduccion: string;
  tiene_actividad: boolean;
  completados: number;
}

export interface AdminActividadAPI {
  id?: number | string;
  tipo: 'completar' | 'emparejar' | 'verdadero_falso' | 'ordenar';
  pregunta: string;
  respuesta_correcta?: string;
  opciones?: { id: number | string; texto: string; orden: number }[];
  pares?: { id: number | string; inga: string; espanol: string }[];
  enunciados_vf?: { id: number | string; enunciado: string; es_verdadero: boolean; orden: number }[];
  fragmentos_ordenar?: { id: number | string; fragmento: string; orden_correcto: number }[];
}

export interface AdminPublicacionAPI {
  id: number | string;
  usuario: string;
  avatar: string;
  contenido: string;
  likes: number;
  comentarios: number;
  creado_en: string;
}

export interface BancoVocabAPI {
  id: number | string;
  espanol: string;
  inga: string;
  categoria: string;
  modulo_id: number | null;
  notas: string | null;
  creado_en?: string;
}

export interface BancoTextoAPI {
  id: number | string;
  titulo: string;
  tipo: string;
  contenido: string;
  modulo_id: number | null;
  creado_en?: string;
}

export interface CartillaSeccionAPI {
  id: number | string;
  titulo: string;
  subtitulo: string | null;
  contenido: string | null;
  imagen_url: string | null;
  imagen_alt: string | null;
  link_url: string | null;
  orden: number;
  tipo: string;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface ModuloImagenAPI {
  id: number | string;
  url: string;
  alt: string | null;
  caption: string | null;
  orden: number;
}

export interface ModuloSeccionAPI {
  id: number | string;
  titulo: string;
  contenido: string | null;
  tipo: string;
  orden: number;
}

export interface ModuloAudioAPI {
  id: number | string;
  titulo: string;
  url: string;
  descripcion: string | null;
  orden: number;
}

type AdminAuthHeaders = { headers: HeadersInit };

const adminRequest = {
  get: <T>(path: string) => request<T>(path, { headers: headers(true) }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', headers: headers(true), body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', headers: headers(true), body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE', headers: headers(true) }),
};

// ════════════════════ ADMIN - APIS ════════════════════
export const adminAPI = {
  getStats: () => adminRequest.get<AdminStatsAPI>(`/admin/cartillas/${cid()}/stats`),
  listarUsuarios: () => adminRequest.get<AdminUsuarioAPI[]>(`/admin/cartillas/${cid()}/usuarios`),
  actualizarUsuario: (id: number | string, data: Partial<AdminUsuarioAPI>) => adminRequest.put(`/admin/usuarios/${id}`, data),
  eliminarUsuario: (id: number | string) => adminRequest.del(`/admin/usuarios/${id}`),
  listarModulos: () => adminRequest.get<AdminModuloAPI[]>(`/admin/cartillas/${cid()}/modulos`),
  crearModulo: (data: Omit<AdminModuloAPI, 'id' | 'completados' | 'tiene_actividad'>) =>
    adminRequest.post<AdminModuloAPI>(`/admin/cartillas/${cid()}/modulos`, data),
  actualizarModulo: (id: number | string, data: Partial<AdminModuloAPI>) =>
    adminRequest.put(`/admin/modulos/${id}`, data),
  eliminarModulo: (id: number | string) => adminRequest.del(`/admin/modulos/${id}`),
  listarActividades: (moduloId: number | string) =>
    adminRequest.get<AdminActividadAPI[]>(`/admin/modulos/${moduloId}/actividades`),
  crearActividad: (moduloId: number | string, data: Partial<AdminActividadAPI>) =>
    adminRequest.post<AdminActividadAPI>(`/admin/modulos/${moduloId}/actividades`, data),
  actualizarActividadV2: (moduloId: number | string, actId: number | string, data: Partial<AdminActividadAPI>) =>
    adminRequest.put<AdminActividadAPI>(`/admin/modulos/${moduloId}/actividades/${actId}`, data),
  eliminarActividadV2: (moduloId: number | string, actId: number | string) =>
    adminRequest.del(`/admin/modulos/${moduloId}/actividades/${actId}`),
  listarImagenes: (moduloId: number | string) =>
    adminRequest.get<ModuloImagenAPI[]>(`/admin/modulos/${moduloId}/imagenes`),
  crearImagen: (moduloId: number | string, data: { url: string; orden: number }) =>
    adminRequest.post<ModuloImagenAPI>(`/admin/modulos/${moduloId}/imagenes`, data),
  eliminarImagen: (moduloId: number | string, imgId: number | string) =>
    adminRequest.del(`/admin/modulos/${moduloId}/imagenes/${imgId}`),
  listarSeccionesContenido: (moduloId: number | string) =>
    adminRequest.get<ModuloSeccionAPI[]>(`/admin/modulos/${moduloId}/secciones`),
  crearSeccionContenido: (moduloId: number | string, data: Partial<ModuloSeccionAPI>) =>
    adminRequest.post<ModuloSeccionAPI>(`/admin/modulos/${moduloId}/secciones`, data),
  actualizarSeccionContenido: (moduloId: number | string, secId: number | string, data: Partial<ModuloSeccionAPI>) =>
    adminRequest.put<ModuloSeccionAPI>(`/admin/modulos/${moduloId}/secciones/${secId}`, data),
  eliminarSeccionContenido: (moduloId: number | string, secId: number | string) =>
    adminRequest.del(`/admin/modulos/${moduloId}/secciones/${secId}`),
  listarAudios: (moduloId: number | string) =>
    adminRequest.get<ModuloAudioAPI[]>(`/admin/modulos/${moduloId}/audios`),
  crearAudio: (moduloId: number | string, data: Partial<ModuloAudioAPI>) =>
    adminRequest.post<ModuloAudioAPI>(`/admin/modulos/${moduloId}/audios`, data),
  actualizarAudio: (moduloId: number | string, audId: number | string, data: Partial<ModuloAudioAPI>) =>
    adminRequest.put<ModuloAudioAPI>(`/admin/modulos/${moduloId}/audios/${audId}`, data),
  eliminarAudio: (moduloId: number | string, audId: number | string) =>
    adminRequest.del(`/admin/modulos/${moduloId}/audios/${audId}`),
  listarPublicaciones: () =>
    adminRequest.get<AdminPublicacionAPI[]>(`/admin/cartillas/${cid()}/publicaciones`),
  eliminarPublicacion: (id: number | string) => adminRequest.del(`/admin/publicaciones/${id}`),
};

export const bancoAPI = {
  listarVocabulario: () => adminRequest.get<BancoVocabAPI[]>(`/admin/cartillas/${cid()}/vocabulario`),
  crearVocabulario: (data: Omit<BancoVocabAPI, 'id' | 'creado_en'>) =>
    adminRequest.post<BancoVocabAPI>(`/admin/cartillas/${cid()}/vocabulario`, data),
  actualizarVocabulario: (id: number | string, data: BancoVocabAPI) =>
    adminRequest.put<BancoVocabAPI>(`/admin/vocabulario/${id}`, data),
  eliminarVocabulario: (id: number | string) => adminRequest.del(`/admin/vocabulario/${id}`),
  listarTextos: () => adminRequest.get<BancoTextoAPI[]>(`/admin/cartillas/${cid()}/textos`),
  crearTexto: (data: Omit<BancoTextoAPI, 'id' | 'creado_en'>) =>
    adminRequest.post<BancoTextoAPI>(`/admin/cartillas/${cid()}/textos`, data),
  actualizarTexto: (id: number | string, data: BancoTextoAPI) =>
    adminRequest.put<BancoTextoAPI>(`/admin/textos/${id}`, data),
  eliminarTexto: (id: number | string) => adminRequest.del(`/admin/textos/${id}`),
  importarVocabulario: (pares: { espanol: string; inga: string }[], moduloId: number | null, categoria: string) =>
    adminRequest.post<{ insertados: number }>(`/admin/cartillas/${cid()}/vocabulario/importar`, { pares, modulo_id: moduloId, categoria }),
};

export const configAPI = {
  get: () => adminRequest.get<{ cloudinary_cloud_name: string; cloudinary_api_key: string; cloudinary_api_secret: string }>(
    `/admin/cartillas/${cid()}/config`
  ),
  save: (data: { cloudinary_cloud_name: string; cloudinary_api_key: string; cloudinary_api_secret: string }) =>
    adminRequest.put(`/admin/cartillas/${cid()}/config`, data),
};

export const uploadAPI = {
  imagen: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/admin/upload/imagen`, {
      method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form, credentials: 'include',
    });
    const body = await res.json();
    if (!res.ok) throw new ApiError(res.status, body?.error || 'Error al subir imagen');
    return { url: body.data?.url || body.url };
  },
  audio: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/admin/upload/audio`, {
      method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form, credentials: 'include',
    });
    const body = await res.json();
    if (!res.ok) throw new ApiError(res.status, body?.error || 'Error al subir audio');
    return { url: body.data?.url || body.url };
  },
};

export const seccionesAPI = {
  listar: () => adminRequest.get<CartillaSeccionAPI[]>(`/admin/cartillas/${cid()}/secciones`),
  crear: (data: Omit<CartillaSeccionAPI, 'id' | 'creado_en' | 'actualizado_en'>) =>
    adminRequest.post<CartillaSeccionAPI>(`/admin/cartillas/${cid()}/secciones`, data),
  actualizar: (id: number | string, data: Partial<CartillaSeccionAPI>) =>
    adminRequest.put<CartillaSeccionAPI>(`/admin/secciones/${id}`, data),
  eliminar: (id: number | string) => adminRequest.del(`/admin/secciones/${id}`),
  reordenar: (items: { id: number | string; orden: number }[]) =>
    adminRequest.put(`/admin/cartillas/${cid()}/secciones/reordenar`, { items }),
};
