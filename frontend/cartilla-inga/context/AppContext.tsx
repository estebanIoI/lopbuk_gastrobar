import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import {
  AppContextType,
  FormDataAuth,
  ModuloKey,
  VistaAuth,
  VistaActual,
  PalabraActiva,
  Actividad,
  ActividadEmparejar,
  RetoDiario,
  Modulo,
  UsuarioComunidad,
  Publicacion,
  ColorModulo,
  UserRole,
} from '../types';
import {
  authAPI,
  modulosAPI,
  retosAPI,
  usuariosAPI,
  comunidadAPI,
  setActiveCartilla,
  type ModuloAPI
} from '../services/api';

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
  /** Slug o id de la cartilla activa: todo el área queda scopeado a ella. */
  cartillaSlug: string;
}

const mapModulo = (m: ModuloAPI): Modulo => ({
  id: Number(m.id),
  clave: m.clave,
  titulo: m.titulo,
  icono: m.icono,
  color: m.color as ColorModulo,
  descripcion: m.descripcion,
  videoUrl: m.video_url,
  frase: m.frase,
  traduccion: m.traduccion,
  actividad: (m.actividad as Actividad) || { tipo: 'completar' as const, pregunta: '', respuestaCorrecta: '', opciones: [] }
});

export const AppProvider: React.FC<AppProviderProps> = ({ children, cartillaSlug }) => {
  // Fija la cartilla activa antes de cualquier llamada al API.
  setActiveCartilla(cartillaSlug);
  // ============= ESTADOS DE AUTENTICACIÓN =============
  const [usuarioAutenticado, setUsuarioAutenticado] = useState(false);
  const [vistaAuth, setVistaAuth] = useState<VistaAuth>('login');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [formData, setFormData] = useState<FormDataAuth>({ email: '', password: '', nombre: '' });
  const [mostrarModalAuth, setMostrarModalAuth] = useState(false);
  const [mostrarModalStats, setMostrarModalStats] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoAuth, setCargandoAuth] = useState(false);
  const [errorAuth, setErrorAuth] = useState<string | null>(null);

  // ============= ESTADOS DE NAVEGACIÓN =============
  const [vistaActual, setVistaActual] = useState<VistaActual>('inicio');
  const [moduloActivo, setModuloActivo] = useState<ModuloKey>('');
  const [menuAbierto, setMenuAbierto] = useState(false);

  // ============= DATOS DEL API =============
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [topUsuarios, setTopUsuarios] = useState<UsuarioComunidad[]>([]);
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [miembrosActivos, setMiembrosActivos] = useState(0);

  // ============= ESTADOS DE ACTIVIDADES =============
  const [respuestaSeleccionada, setRespuestaSeleccionada] = useState<string | null>(null);
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const [paresSeleccionados, setParesSeleccionados] = useState<string[]>([]);
  const [palabraActiva, setPalabraActiva] = useState<PalabraActiva | null>(null);

  // ============= ESTADO DE PUNTOS Y ESTADÍSTICAS =============
  const [puntos, setPuntos] = useState(0);
  const [diasSeguidos, setDiasSeguidos] = useState(0);
  const [palabrasAprendidas, setPalabrasAprendidas] = useState(0);
  const [retos, setRetos] = useState<RetoDiario[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Módulo actual derivado
  const moduloActual = useMemo(() => {
    return modulos.find(m => m.clave === moduloActivo) || null;
  }, [modulos, moduloActivo]);

  // ============= CARGA INICIAL DE DATOS =============
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [modulosRes, topRes, retosRes, activosRes] = await Promise.all([
          modulosAPI.listar(),
          usuariosAPI.top(),
          retosAPI.listar().catch(() => []),
          usuariosAPI.activos().catch(() => ({ total: 0 }))
        ]);

        const modulosMapped = modulosRes.map(mapModulo);
        setModulos(modulosMapped);
        if (modulosMapped.length > 0) setModuloActivo(modulosMapped[0].clave);

        setTopUsuarios(topRes.map(u => ({ ...u, id: Number(u.id) })));
        setRetos(retosRes as RetoDiario[]);
        setMiembrosActivos(activosRes.total);

        // Verificar sesión Lopbuk (cookie httpOnly o token en localStorage).
        try {
          const perfil = await authAPI.perfil();
          setUsuarioAutenticado(true);
          setUserRole((perfil.role as UserRole) ?? 'user');
          // Los puntos viven por-cartilla: se obtienen de stats.
          try {
            const stats = await usuariosAPI.stats();
            setPuntos(stats.puntos);
            setDiasSeguidos(stats.dias_seguidos ?? 0);
            setPalabrasAprendidas(stats.palabras_aprendidas ?? 0);
          } catch { /* sin progreso aún */ }
        } catch {
          if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
        }
      } catch (err) {
        console.error('Error cargando datos iniciales:', err);
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, []);

  // Cargar detalle del módulo cuando cambia el activo
  useEffect(() => {
    if (!moduloActivo) return;
    const cargarModulo = async () => {
      try {
        const detalle = await modulosAPI.obtener(moduloActivo);
        setModulos(prev => prev.map(m =>
          m.clave === moduloActivo ? mapModulo(detalle) : m
        ));
      } catch (err) {
        console.error('Error cargando módulo:', err);
      }
    };
    cargarModulo();
  }, [moduloActivo]);

  // ============= STATS / PUNTOS (por cartilla) =============
  const cargarStats = useCallback(async () => {
    try {
      const stats = await usuariosAPI.stats();
      setPuntos(stats.puntos);
      setDiasSeguidos(stats.dias_seguidos ?? 0);
      setPalabrasAprendidas(stats.palabras_aprendidas ?? 0);
    } catch { /* aún sin progreso en esta cartilla */ }
  }, []);

  // ============= FUNCIONES DE AUTENTICACIÓN =============
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;
    setErrorAuth(null);
    setCargandoAuth(true);
    try {
      const { token, usuario } = await authAPI.login(formData.email, formData.password);
      if (token) localStorage.setItem('token', token);
      setUsuarioAutenticado(true);
      setUserRole((usuario.role as UserRole) ?? 'user');
      await cargarStats();
      setMostrarModalAuth(false);

      const retosRes = await retosAPI.listar();
      setRetos(retosRes as RetoDiario[]);

      if (vistaActual === 'auth') setVistaActual('comunidad');
    } catch (err) {
      setErrorAuth(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setCargandoAuth(false);
    }
  }, [formData.email, formData.password, vistaActual]);

  const handleRegistro = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.nombre) return;
    setErrorAuth(null);
    setCargandoAuth(true);
    try {
      const { token, usuario } = await authAPI.registro(formData.nombre, formData.email, formData.password);
      if (token) localStorage.setItem('token', token);
      setUsuarioAutenticado(true);
      setUserRole((usuario.role as UserRole) ?? 'user');
      await cargarStats();
      setMostrarModalAuth(false);

      const retosRes = await retosAPI.listar();
      setRetos(retosRes as RetoDiario[]);

      if (vistaActual === 'auth') setVistaActual('comunidad');
    } catch (err) {
      setErrorAuth(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setCargandoAuth(false);
    }
  }, [formData.email, formData.password, formData.nombre, vistaActual]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setUsuarioAutenticado(false);
    setUserRole(null);
    setFormData({ email: '', password: '', nombre: '' });
    setPuntos(0);
    setDiasSeguidos(0);
    setPalabrasAprendidas(0);
    setVistaActual('inicio');
    setMenuAbierto(false);
    retosAPI.listar().catch(() => []).then(r => setRetos(r as RetoDiario[]));
  }, []);

  const handleGoogleLogin = useCallback(async (credential: string) => {
    setErrorAuth(null);
    setCargandoAuth(true);
    try {
      const { token, usuario } = await authAPI.googleLogin(credential);
      if (token) localStorage.setItem('token', token);
      setUsuarioAutenticado(true);
      setUserRole((usuario.role as UserRole) ?? 'user');
      await cargarStats();
      setMostrarModalAuth(false);

      const retosRes = await retosAPI.listar();
      setRetos(retosRes as RetoDiario[]);

      if (vistaActual === 'auth') setVistaActual('comunidad');
    } catch (err) {
      setErrorAuth(err instanceof Error ? err.message : 'Error al iniciar sesión con Google');
    } finally {
      setCargandoAuth(false);
    }
  }, [vistaActual]);

  const solicitarAutenticacion = useCallback(() => {
    setVistaActual('auth');
    setMenuAbierto(false);
  }, []);

  // ============= FUNCIONES DE NAVEGACIÓN =============
  const reiniciarActividad = useCallback(() => {
    setRespuestaSeleccionada(null);
    setMostrarResultado(false);
    setParesSeleccionados([]);
    setPalabraActiva(null);
  }, []);

  const irAModulo = useCallback((modulo: ModuloKey) => {
    setModuloActivo(modulo);
    setVistaActual('modulo');
    setMenuAbierto(false);
    reiniciarActividad();
  }, [reiniciarActividad]);

  const volverAInicio = useCallback(() => {
    setVistaActual('inicio');
    setMenuAbierto(false);
  }, []);

  const irAAdmin = useCallback(() => {
    setVistaActual('admin');
    setMenuAbierto(false);
  }, []);

  const irATraductor = useCallback(() => {
    setVistaActual('traductor');
    setMenuAbierto(false);
  }, []);

  const irAComunidad = useCallback(async () => {
    if (!usuarioAutenticado) {
      solicitarAutenticacion();
      return;
    }
    try {
      const { data } = await comunidadAPI.listarPublicaciones();
      setPublicaciones(data as Publicacion[]);
    } catch (err) {
      console.error('Error cargando publicaciones:', err);
    }
    setVistaActual('comunidad');
    setMenuAbierto(false);
  }, [usuarioAutenticado, solicitarAutenticacion]);

  // ============= FUNCIONES DE COMUNIDAD =============
  const crearPublicacion = useCallback(async (contenido: string) => {
    try {
      const nueva = await comunidadAPI.crearPublicacion(contenido);
      setPublicaciones(prev => [nueva as Publicacion, ...prev]);

      // Recargar retos y puntos (el backend actualizó el progreso)
      const [retosActualizados, perfil] = await Promise.all([
        retosAPI.listar().catch(() => []),
        authAPI.perfil().catch(() => null)
      ]);
      setRetos(retosActualizados as RetoDiario[]);
      if (perfil) setPuntos(perfil.puntos);
    } catch (err) {
      console.error('Error creando publicación:', err);
    }
  }, []);

  const toggleLike = useCallback(async (id: number) => {
    try {
      const { likes } = await comunidadAPI.toggleLike(id);
      setPublicaciones(prev => prev.map(p => p.id === id ? { ...p, likes } : p));
    } catch (err) {
      console.error('Error toggle like:', err);
    }
  }, []);

  // ============= FUNCIONES DE ACTIVIDADES =============
  const verificarRespuesta = useCallback(async (opcion: string) => {
    setRespuestaSeleccionada(opcion);
    setMostrarResultado(true);

    if (moduloActual && usuarioAutenticado) {
      try {
        const res = await modulosAPI.responder(moduloActual.clave, opcion);
        setPuntos(res.puntos_totales);

        // Recargar retos (el backend actualizó el progreso)
        if (res.correcta) {
          const retosActualizados = await retosAPI.listar().catch(() => []);
          setRetos(retosActualizados as RetoDiario[]);
        }
      } catch {
        const actividad = moduloActual.actividad;
        if (actividad.tipo === 'completar' && opcion === actividad.respuestaCorrecta) {
          setPuntos(prev => prev + 10);
        }
      }
    }
  }, [moduloActual, usuarioAutenticado]);

  const seleccionarPalabra = useCallback((palabra: string, tipo: 'inga' | 'espanol') => {
    if (!moduloActual) return;
    if (palabraActiva === null) {
      setPalabraActiva({ palabra, tipo });
    } else {
      const actividad = moduloActual.actividad as ActividadEmparejar;
      const esParCorrecto = actividad.pares.some(
        par =>
          (par.inga === palabraActiva.palabra && par.espanol === palabra && palabraActiva.tipo !== tipo) ||
          (par.espanol === palabraActiva.palabra && par.inga === palabra && palabraActiva.tipo !== tipo)
      );

      if (esParCorrecto) {
        setParesSeleccionados(prev => [...prev, palabraActiva.palabra, palabra]);
        if (usuarioAutenticado) {
          setPuntos(prev => prev + 10);
        }
      }
      setPalabraActiva(null);
    }
  }, [palabraActiva, moduloActual, usuarioAutenticado]);

  // ============= VALOR DEL CONTEXTO =============
  const contextValue = useMemo<AppContextType>(() => ({
    usuarioAutenticado, vistaAuth, mostrarPassword, formData, mostrarModalAuth,
    mostrarModalStats, cargando, cargandoAuth, errorAuth,
    vistaActual, moduloActivo, menuAbierto,
    modulos, topUsuarios, publicaciones, miembrosActivos,
    respuestaSeleccionada, mostrarResultado, paresSeleccionados, palabraActiva,
    puntos, diasSeguidos, palabrasAprendidas, retos, moduloActual,
    userRole,
    handleLogin, handleRegistro, handleLogout, handleGoogleLogin, solicitarAutenticacion,
    setVistaAuth, setMostrarPassword, setFormData, setMostrarModalStats,
    irAModulo, volverAInicio, irAComunidad, irAAdmin, irATraductor, setMenuAbierto,
    crearPublicacion, toggleLike,
    verificarRespuesta, seleccionarPalabra, reiniciarActividad,
  }), [
    usuarioAutenticado, vistaAuth, mostrarPassword, formData, mostrarModalAuth,
    mostrarModalStats, cargando, cargandoAuth, errorAuth,
    vistaActual, moduloActivo, menuAbierto,
    modulos, topUsuarios, publicaciones, miembrosActivos,
    respuestaSeleccionada, mostrarResultado, paresSeleccionados, palabraActiva,
    puntos, diasSeguidos, palabrasAprendidas, retos, moduloActual,
    userRole,
    handleLogin, handleRegistro, handleLogout, handleGoogleLogin, solicitarAutenticacion,
    irAModulo, volverAInicio, irAComunidad, irAAdmin, irATraductor,
    crearPublicacion, toggleLike,
    verificarRespuesta, seleccionarPalabra, reiniciarActividad,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp debe ser usado dentro de un AppProvider');
  }
  return context;
};
