import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, Play, Pause, Image as ImageIcon, BookOpen, Volume2,
  CheckCircle, XCircle, ChevronLeft, ChevronRight, RotateCcw, Zap, AlertCircle,
} from 'lucide-react';
import { useNavigation } from '../hooks/useNavigation';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { modulosAPI, type ModuloAPI, type ActividadPublicaAPI } from '../services/api';
import { getIcon } from '../utils/iconMap';

// ── Actividad: Completar ────────────────────────────────────────────────────
function ActividadCompletar({ act }: { act: ActividadPublicaAPI }) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [resuelta, setResuelta] = useState(false);

  const elegir = (texto: string) => {
    if (resuelta) return;
    setSeleccionada(texto);
    setResuelta(true);
  };
  const reiniciar = () => { setSeleccionada(null); setResuelta(false); };

  return (
    <div className="space-y-3">
      {(act.opciones ?? []).map((op) => {
        const esCorrecta = op.texto === act.respuesta_correcta;
        const estaSeleccionada = seleccionada === op.texto;
        return (
          <button
            key={op.id}
            onClick={() => elegir(op.texto)}
            disabled={resuelta}
            className={`w-full p-4 rounded-xl border-2 text-left font-medium flex items-center justify-between transition ${
              resuelta
                ? estaSeleccionada
                  ? esCorrecta
                    ? 'bg-green-100 border-green-500 text-green-800'
                    : 'bg-red-100 border-red-500 text-red-800'
                  : esCorrecta
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                : 'bg-white border-slate-200 hover:border-emerald-500 hover:bg-emerald-50'
            }`}
          >
            <span>{op.texto}</span>
            {resuelta && estaSeleccionada && (
              esCorrecta
                ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                : <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
          </button>
        );
      })}
      {resuelta && (
        <button onClick={reiniciar}
          className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-900 font-medium">
          <RotateCcw className="w-4 h-4" /> Intentar de nuevo
        </button>
      )}
    </div>
  );
}

// ── Actividad: Emparejar ────────────────────────────────────────────────────
function ActividadEmparejar({ act }: { act: ActividadPublicaAPI }) {
  const pares = act.pares ?? [];
  const [activo, setActivo] = useState<{ texto: string; lado: 'inga' | 'esp' } | null>(null);
  const [emparejados, setEmparejados] = useState<string[]>([]);
  const [errores, setErrores] = useState<string[]>([]);

  const seleccionar = (texto: string, lado: 'inga' | 'esp') => {
    if (emparejados.includes(texto)) return;
    if (!activo) { setActivo({ texto, lado }); return; }
    if (activo.lado === lado) { setActivo({ texto, lado }); return; }

    const par = pares.find(p =>
      (lado === 'esp' ? p.inga === activo.texto && p.espanol === texto
                      : p.espanol === activo.texto && p.inga === texto)
    );
    if (par) {
      setEmparejados(prev => [...prev, par.inga, par.espanol]);
      setErrores([]);
    } else {
      setErrores([activo.texto, texto]);
      setTimeout(() => setErrores([]), 700);
    }
    setActivo(null);
  };

  const reiniciar = () => { setActivo(null); setEmparejados([]); setErrores([]); };
  const terminado = emparejados.length === pares.length * 2;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Inga</p>
          {pares.map(p => {
            const listo = emparejados.includes(p.inga);
            const error = errores.includes(p.inga);
            const sel = activo?.texto === p.inga;
            return (
              <button key={`i-${p.id}`} onClick={() => !listo && seleccionar(p.inga, 'inga')}
                disabled={listo}
                className={`w-full p-3 rounded-xl border-2 text-sm font-medium transition ${
                  listo  ? 'bg-green-100 border-green-400 text-green-800'
                  : error ? 'bg-red-100 border-red-400 text-red-700 animate-pulse'
                  : sel   ? 'bg-amber-100 border-amber-500 scale-105'
                           : 'bg-white border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50'
                }`}>{p.inga}</button>
            );
          })}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Español</p>
          {pares.map(p => {
            const listo = emparejados.includes(p.espanol);
            const error = errores.includes(p.espanol);
            const sel = activo?.texto === p.espanol;
            return (
              <button key={`e-${p.id}`} onClick={() => !listo && seleccionar(p.espanol, 'esp')}
                disabled={listo}
                className={`w-full p-3 rounded-xl border-2 text-sm font-medium transition ${
                  listo  ? 'bg-green-100 border-green-400 text-green-800'
                  : error ? 'bg-red-100 border-red-400 text-red-700 animate-pulse'
                  : sel   ? 'bg-amber-100 border-amber-500 scale-105'
                           : 'bg-white border-amber-200 hover:border-amber-500 hover:bg-amber-50'
                }`}>{p.espanol}</button>
            );
          })}
        </div>
      </div>
      {terminado && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
            <CheckCircle className="w-4 h-4" /> ¡Todos los pares correctos!
          </div>
          <button onClick={reiniciar} className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900">
            <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Actividad: Verdadero / Falso ────────────────────────────────────────────
function ActividadVF({ act }: { act: ActividadPublicaAPI }) {
  const enunciados = act.enunciados_vf ?? [];
  const [respuestas, setRespuestas] = useState<Record<number, boolean | null>>({});
  const [mostrar, setMostrar] = useState(false);

  const todos = enunciados.every(e => respuestas[Number(e.id)] !== undefined && respuestas[Number(e.id)] !== null);
  const correctos = enunciados.filter(e => respuestas[Number(e.id)] === Boolean(e.es_verdadero)).length;

  const reiniciar = () => { setRespuestas({}); setMostrar(false); };

  return (
    <div className="space-y-3">
      {enunciados.map(en => {
        const resp = respuestas[Number(en.id)];
        const esCorrecto = resp === Boolean(en.es_verdadero);
        return (
          <div key={en.id} className={`rounded-xl border-2 p-4 transition ${
            mostrar && resp !== undefined && resp !== null
              ? esCorrecto ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
              : 'border-slate-200 bg-white'
          }`}>
            <p className="text-sm font-medium text-slate-800 mb-3">{en.enunciado}</p>
            <div className="flex gap-2">
              {[true, false].map(val => {
                const esSeleccionada = resp === val;
                return (
                  <button key={String(val)}
                    onClick={() => !mostrar && setRespuestas(r => ({ ...r, [Number(en.id)]: val }))}
                    disabled={mostrar}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition ${
                      esSeleccionada
                        ? val ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-red-500 border-red-500 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}>
                    {val ? '✓ Verdadero' : '✗ Falso'}
                  </button>
                );
              })}
            </div>
            {mostrar && resp !== undefined && resp !== null && (
              <p className={`text-xs mt-2 font-medium ${esCorrecto ? 'text-green-700' : 'text-red-600'}`}>
                {esCorrecto ? '¡Correcto!' : `Respuesta correcta: ${Boolean(en.es_verdadero) ? 'Verdadero' : 'Falso'}`}
              </p>
            )}
          </div>
        );
      })}
      {todos && !mostrar && (
        <button onClick={() => setMostrar(true)}
          className="w-full bg-emerald-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition">
          Ver resultados
        </button>
      )}
      {mostrar && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
          <span className="text-sm font-medium text-slate-700">
            {correctos} / {enunciados.length} correctas
          </span>
          <button onClick={reiniciar} className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900">
            <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Actividad: Ordenar ──────────────────────────────────────────────────────
function ActividadOrdenar({ act }: { act: ActividadPublicaAPI }) {
  const originales = act.fragmentos_ordenar ?? [];
  const [orden, setOrden] = useState<typeof originales>(() =>
    [...originales].sort(() => Math.random() - 0.5)
  );
  const [verificado, setVerificado] = useState(false);

  const mover = (i: number, dir: -1 | 1) => {
    if (verificado) return;
    const j = i + dir;
    if (j < 0 || j >= orden.length) return;
    setOrden(prev => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const correcto = orden.every((f, i) => f.orden_correcto === i);
  const reiniciar = () => {
    setOrden([...originales].sort(() => Math.random() - 0.5));
    setVerificado(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 mb-1">Usa las flechas para ordenar los fragmentos correctamente</p>
      {orden.map((fr, i) => (
        <div key={fr.id} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition ${
          verificado
            ? fr.orden_correcto === i ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
            : 'border-slate-200 bg-white'
        }`}>
          <span className="text-xs text-slate-400 w-5 text-right shrink-0">{i + 1}.</span>
          <span className="flex-1 text-sm font-medium text-slate-800">{fr.fragmento}</span>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => mover(i, -1)} disabled={i === 0 || verificado}
              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => mover(i, 1)} disabled={i === orden.length - 1 || verificado}
              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      {!verificado && (
        <button onClick={() => setVerificado(true)}
          className="w-full bg-emerald-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition mt-2">
          Verificar orden
        </button>
      )}
      {verificado && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
          <span className={`text-sm font-medium ${correcto ? 'text-green-700' : 'text-red-600'}`}>
            {correcto ? '¡Orden correcto!' : 'Orden incorrecto'}
          </span>
          <button onClick={reiniciar} className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900">
            <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tipo badge de sección ───────────────────────────────────────────────────
const TIPO_SEC_BADGE: Record<string, string> = {
  texto:         'bg-slate-100 text-slate-600',
  vocabulario:   'bg-emerald-100 text-emerald-700',
  cultural:      'bg-amber-100 text-amber-700',
  pronunciacion: 'bg-blue-100 text-blue-700',
  gramatica:     'bg-purple-100 text-purple-700',
};
const TIPO_SEC_LABEL: Record<string, string> = {
  texto: 'Texto', vocabulario: 'Vocabulario', cultural: 'Cultural',
  pronunciacion: 'Pronunciación', gramatica: 'Gramática',
};
const TIPO_ACT_LABEL: Record<string, string> = {
  emparejar: 'Emparejar', completar: 'Completar',
  verdadero_falso: 'Verdadero/Falso', ordenar: 'Ordenar',
};
const TIPO_ACT_COLOR: Record<string, string> = {
  emparejar: 'bg-emerald-100 text-emerald-700',
  completar: 'bg-blue-100 text-blue-700',
  verdadero_falso: 'bg-amber-100 text-amber-700',
  ordenar: 'bg-purple-100 text-purple-700',
};

// ── Autoplay: añade parámetros a URL de embed ──────────────────────────────
const ALLOWED_VIDEO_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'player.vimeo.com', 'vimeo.com'];

const safeVideoUrl = (url: string): string | null => {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_VIDEO_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`)) ? url : null;
  } catch {
    return null;
  }
};

const withAutoplay = (url: string): string => {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}autoplay=1&mute=1`;
};

// ── Color del hero según módulo ─────────────────────────────────────────────
const HERO_GRADIENT: Record<string, string> = {
  emerald: 'from-emerald-800 via-emerald-700 to-green-600',
  green:   'from-green-800 via-green-700 to-emerald-600',
  amber:   'from-amber-700 via-amber-600 to-orange-500',
  purple:  'from-purple-800 via-purple-700 to-violet-600',
  pink:    'from-pink-700 via-pink-600 to-rose-500',
};

// ── Skeleton de carga ───────────────────────────────────────────────────────
function SkeletonModulo() {
  return (
    <div className="space-y-5 pb-10 animate-pulse">
      <div className="h-5 w-32 bg-slate-200 rounded-lg" />
      <div className="rounded-3xl overflow-hidden">
        <div className="bg-slate-200 h-56" />
        <div className="bg-slate-100 h-12" />
      </div>
      <div className="bg-slate-100 rounded-2xl h-48" />
      <div className="space-y-3">
        <div className="h-5 w-40 bg-slate-200 rounded" />
        <div className="bg-slate-100 rounded-2xl h-28" />
        <div className="bg-slate-100 rounded-2xl h-20" />
      </div>
    </div>
  );
}

// ── Badge de stat ───────────────────────────────────────────────────────────
function StatBadge({ icon: Icon, label }: { icon: React.FC<React.SVGProps<SVGSVGElement>>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full text-white/90 text-xs font-medium">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
  );
}

// ── Reproductor de audio ────────────────────────────────────────────────────
function AudioPlayer({ src, titulo, descripcion }: { src: string; titulo: string; descripcion?: string }) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent]   = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else         { audioRef.current.play();  setPlaying(true);  }
  };

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    setCurrent(a.currentTime);
    setProgress((a.currentTime / a.duration) * 100);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrent(0); }}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition shadow-sm"
        >
          {playing
            ? <Pause className="w-4 h-4" />
            : <Play  className="w-4 h-4 translate-x-px" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-emerald-800 truncate mb-1.5">{titulo}</p>
          <div
            className="w-full h-2 bg-emerald-200 rounded-full cursor-pointer overflow-hidden"
            onClick={seek}
          >
            <div
              className="h-full bg-emerald-500 rounded-full transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <span className="text-[11px] text-emerald-600 shrink-0 font-mono tabular-nums">
          {fmt(current)}<span className="text-emerald-300 mx-0.5">/</span>{fmt(duration)}
        </span>
      </div>

      {descripcion && (
        <p className="text-xs text-emerald-600 italic mt-2 pl-12 leading-relaxed">{descripcion}</p>
      )}
    </div>
  );
}

// ── Vista principal ─────────────────────────────────────────────────────────
export const VistaModulo: React.FC = () => {
  const { moduloActual, volverAInicio, irAModulo } = useNavigation();
  const { modulos } = useApp();
  const { usuarioAutenticado } = useAuth();
  const [modulo, setModulo] = useState<ModuloAPI | null>(null);
  const [actExpandida, setActExpandida] = useState<number | null>(null);
  const [modalNav, setModalNav] = useState(false);
  const actividadesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moduloActual) return;
    setModulo(null);
    const controller = new AbortController();
    modulosAPI.obtener(moduloActual.clave).then(data => {
      if (!controller.signal.aborted) setModulo(data);
    }).catch(() => {});
    return () => controller.abort();
  }, [moduloActual?.clave]);

  if (!moduloActual) return <div className="text-center py-12 text-slate-400">Cargando módulo…</div>;
  if (!modulo) return <SkeletonModulo />;

  const IconoModulo = getIcon(modulo.icono);
  const imagenes    = modulo.imagenes   ?? [];
  const secciones   = modulo.secciones  ?? [];
  const audios      = modulo.audios     ?? [];
  const actividades = modulo.actividades ?? [];
  const heroGradient = HERO_GRADIENT[modulo.color] ?? HERO_GRADIENT.emerald;

  // Navegación entre módulos
  const idxActual   = modulos.findIndex(m => m.clave === moduloActual.clave);
  const moduloPrev  = idxActual > 0 ? modulos[idxActual - 1] : null;
  const moduloNext  = idxActual < modulos.length - 1 ? modulos[idxActual + 1] : null;

  const irAlSiguiente = (destino: typeof moduloNext) => {
    if (!destino) return;
    // Si está logueado Y hay actividades sin completar → pedir confirmación
    if (usuarioAutenticado && actividades.length > 0) {
      setModalNav(true);
      return;
    }
    irAModulo(destino.clave);
  };

  const confirmarYNavegar = () => {
    if (moduloNext) irAModulo(moduloNext.clave);
    setModalNav(false);
  };

  const irAActividades = () => {
    setModalNav(false);
    // Expandir la primera actividad y hacer scroll
    if (actividades.length > 0) setActExpandida(Number(actividades[0].id));
    setTimeout(() => actividadesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  return (
    <div className="space-y-6 pb-10">

      {/* Volver */}
      <button onClick={volverAInicio}
        className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 font-medium text-sm transition">
        <ArrowLeft className="w-4 h-4" /> Volver al inicio
      </button>

      {/* ══════════════════════════════════════════
          HERO: título + frase + stats del contenido
      ══════════════════════════════════════════ */}
      <div className={`bg-gradient-to-br ${heroGradient} text-white rounded-3xl shadow-xl overflow-hidden`}>

        {/* Cuerpo principal */}
        <div className="relative px-6 pt-7 pb-6 md:px-8">
          {/* Círculos decorativos */}
          <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full" />
          <div className="pointer-events-none absolute -bottom-12 -left-6 w-36 h-36 bg-white/5 rounded-full" />

          <div className="relative flex flex-col md:flex-row md:items-start gap-5">

            {/* Izquierda: icono + título + descripción */}
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl border border-white/20 shrink-0">
                <IconoModulo className="w-9 h-9" />
              </div>
              <div className="min-w-0">
                <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">
                  Módulo de aprendizaje
                </p>
                <h2 className="text-2xl md:text-3xl font-bold leading-snug">{modulo.titulo}</h2>
                {modulo.descripcion && (
                  <p className="text-white/75 text-sm mt-2 leading-relaxed">{modulo.descripcion}</p>
                )}
              </div>
            </div>

            {/* Derecha: tarjeta frase Inga */}
            <div className="md:shrink-0 md:w-52 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <p className="text-white/55 text-xs font-semibold uppercase tracking-wider mb-2">Frase Inga</p>
              <p className="text-2xl font-extrabold tracking-wide leading-tight">{modulo.frase}</p>
              <div className="mt-2 pt-2 border-t border-white/20">
                <p className="text-white/80 text-sm italic">"{modulo.traduccion}"</p>
              </div>
            </div>
          </div>
        </div>

        {/* Franja inferior: stats del contenido disponible */}
        <div className="bg-black/25 px-6 py-3 flex flex-wrap gap-2">
          {safeVideoUrl(modulo.video_url ?? '') && <StatBadge icon={Play} label="Video" />}
          {secciones.length  > 0 && <StatBadge icon={BookOpen}  label={`${secciones.length} sección${secciones.length > 1 ? 'es' : ''}`} />}
          {imagenes.length   > 0 && <StatBadge icon={ImageIcon} label={`${imagenes.length} imagen${imagenes.length > 1 ? 'es' : ''}`} />}
          {audios.length     > 0 && <StatBadge icon={Volume2}   label={`${audios.length} audio${audios.length > 1 ? 's' : ''}`} />}
          {actividades.length > 0 && <StatBadge icon={Zap}       label={`${actividades.length} actividad${actividades.length > 1 ? 'es' : ''}`} />}
          {!safeVideoUrl(modulo.video_url ?? '') && secciones.length === 0 && imagenes.length === 0 && audios.length === 0 && actividades.length === 0 && (
            <span className="text-white/50 text-xs">Contenido próximamente</span>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          VIDEO
      ══════════════════════════════════════════ */}
      {safeVideoUrl(modulo.video_url ?? '') && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
            <div className="bg-emerald-100 p-1.5 rounded-lg">
              <Play className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <span className="text-sm font-semibold text-slate-700">Video del módulo</span>
          </div>
          <div className="relative aspect-video bg-slate-900">
            <iframe className="w-full h-full" src={withAutoplay(safeVideoUrl(modulo.video_url ?? '') ?? '')}
              title="Video educativo" frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          CONTENIDO: imagen + texto en pares
      ══════════════════════════════════════════ */}
      {(imagenes.length > 0 || secciones.length > 0 || audios.length > 0) && (() => {
        const total = Math.max(imagenes.length, secciones.length, audios.length);
        return (
          <div className="space-y-4">
            {Array.from({ length: total }).map((_, i) => {
              const img = imagenes[i] ?? null;
              const sec = secciones[i] ?? null;
              const aud = audios[i] ?? null;
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col sm:flex-row"
                >
                  {/* Imagen */}
                  {img && (
                    <div className="sm:w-5/12 shrink-0 overflow-hidden">
                      <img
                        src={img.url}
                        alt={img.alt ?? ''}
                        className="w-full h-52 sm:h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Texto + Audio */}
                  <div className="flex-1 flex flex-col justify-center px-4 py-4 sm:px-6 sm:py-5 gap-3">
                    {/* Texto */}
                    {sec ? (
                      <div>
                        <h4 className="font-bold text-lg text-stone-800 leading-snug mb-2">
                          {sec.titulo}
                        </h4>
                        {sec.contenido && (
                          <p className="text-stone-600 leading-relaxed whitespace-pre-wrap text-sm">
                            {sec.contenido}
                          </p>
                        )}
                        <span className={`mt-3 inline-block text-xs px-2.5 py-1 rounded-full font-medium ${TIPO_SEC_BADGE[sec.tipo] ?? 'bg-stone-100 text-stone-500'}`}>
                          {TIPO_SEC_LABEL[sec.tipo] ?? sec.tipo}
                        </span>
                      </div>
                    ) : img?.caption ? (
                      <p className="text-stone-600 italic text-sm">{img.caption}</p>
                    ) : null}

                    {/* Reproductor de audio */}
                    {aud && <AudioPlayer src={aud.url} titulo={aud.titulo} descripcion={aud.descripcion ?? undefined} />}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════
          ACTIVIDADES
      ══════════════════════════════════════════ */}
      {actividades.length > 0 && (
        <div className="space-y-3" ref={actividadesRef}>
          <div className="flex items-center gap-2 px-1">
            <div className="bg-amber-100 p-1.5 rounded-lg">
              <Zap className="w-4 h-4 text-amber-700" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Actividades interactivas</h3>
            <span className="text-xs text-slate-400 ml-1">{actividades.length} actividad{actividades.length > 1 ? 'es' : ''}</span>
          </div>
          {actividades.map((act, idx) => (
            <div key={act.id} className="bg-white rounded-2xl border-2 border-amber-100 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-amber-50/50 transition"
                onClick={() => setActExpandida(actExpandida === Number(act.id) ? null : Number(act.id))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-amber-100 w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-amber-700">{idx + 1}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${TIPO_ACT_COLOR[act.tipo] ?? ''}`}>
                        {TIPO_ACT_LABEL[act.tipo] ?? act.tipo}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">{act.pregunta}</p>
                  </div>
                </div>
                <div className={`shrink-0 ml-3 w-6 h-6 rounded-full flex items-center justify-center transition ${
                  actExpandida === act.id ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-600'
                }`}>
                  <span className="text-xs font-bold">{actExpandida === act.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {actExpandida === act.id && (
                <div className="px-5 pb-5 border-t-2 border-amber-100 pt-4 bg-amber-50/20">
                  {act.tipo === 'completar'       && <ActividadCompletar act={act} />}
                  {act.tipo === 'emparejar'       && <ActividadEmparejar act={act} />}
                  {act.tipo === 'verdadero_falso' && <ActividadVF act={act} />}
                  {act.tipo === 'ordenar'         && <ActividadOrdenar act={act} />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sin contenido */}
      {!safeVideoUrl(modulo.video_url ?? '') && secciones.length === 0 && imagenes.length === 0 && audios.length === 0 && actividades.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          Este módulo no tiene contenido publicado aún.
        </div>
      )}

      {/* ══════════════════════════════════════════
          NAVEGACIÓN PREV / NEXT
      ══════════════════════════════════════════ */}
      {(moduloPrev || moduloNext) && (
        <div className="flex items-stretch gap-3 pt-2">
          {/* Anterior */}
          {moduloPrev ? (
            <button
              onClick={() => irAModulo(moduloPrev.clave)}
              className="flex-1 flex items-center gap-3 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-2xl px-4 py-4 transition text-left group"
            >
              <div className="bg-slate-100 group-hover:bg-emerald-100 p-2 rounded-xl shrink-0 transition">
                <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">Módulo anterior</p>
                <p className="text-sm font-semibold text-slate-700 group-hover:text-emerald-800 truncate">
                  {moduloPrev.titulo}
                </p>
              </div>
            </button>
          ) : <div className="flex-1" />}

          {/* Siguiente */}
          {moduloNext && (
            <button
              onClick={() => irAlSiguiente(moduloNext)}
              className="flex-1 flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 rounded-2xl px-4 py-4 transition text-right justify-end group shadow-md"
            >
              <div className="min-w-0">
                <p className="text-xs text-emerald-200 font-medium">Siguiente módulo</p>
                <p className="text-sm font-bold text-white truncate">{moduloNext.titulo}</p>
              </div>
              <div className="bg-emerald-500 group-hover:bg-emerald-600 p-2 rounded-xl shrink-0 transition">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL: completar actividades primero
      ══════════════════════════════════════════ */}
      {modalNav && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Franja superior */}
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-5 flex gap-3">
              <div className="bg-amber-100 p-2.5 rounded-xl shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base leading-snug">
                  ¿Continuar sin practicar?
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Este módulo tiene {actividades.length} actividad{actividades.length > 1 ? 'es' : ''} para reforzar lo aprendido.
                </p>
              </div>
            </div>

            {/* Opciones */}
            <div className="p-5 space-y-2">
              <button
                onClick={irAActividades}
                className="w-full flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition"
              >
                <Zap className="w-4 h-4 shrink-0" />
                <span>Practicar las actividades</span>
              </button>
              <button
                onClick={confirmarYNavegar}
                className="w-full flex items-center gap-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium py-3 px-4 rounded-xl transition"
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
                <span>Continuar al siguiente módulo</span>
              </button>
              <button
                onClick={() => setModalNav(false)}
                className="w-full text-slate-400 hover:text-slate-600 font-medium py-2 text-sm transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
