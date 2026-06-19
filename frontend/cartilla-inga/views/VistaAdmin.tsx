import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Users, BookOpen, MessageSquare,
  ArrowLeft, Pencil, Trash2, ShieldCheck, ShieldOff,
  Plus, Save, X, ChevronDown, ChevronUp, AlertTriangle,
  TrendingUp, Star, FileText, Award, Database,
  LayoutGrid, Settings, ImagePlus, Upload, Eye, EyeOff,
} from 'lucide-react';
import { useNavigation } from '../hooks/useNavigation';
import {
  adminAPI,
  bancoAPI,
  configAPI,
  uploadAPI,
  seccionesAPI,
  type AdminStatsAPI,
  type AdminUsuarioAPI,
  type AdminModuloAPI,
  type AdminActividadAPI,
  type AdminPublicacionAPI,
  type BancoVocabAPI,
  type BancoTextoAPI,
  type CartillaSeccionAPI,
  type ModuloImagenAPI,
  type ModuloSeccionAPI,
  type ModuloAudioAPI,
} from '../services/api';

// =====================================================
// Tipos internos
// =====================================================
type Seccion = 'dashboard' | 'usuarios' | 'modulos' | 'comunidad' | 'banco' | 'secciones' | 'configuracion';
type BancoTab = 'vocabulario' | 'textos' | 'importar';

interface Toast { id: number; mensaje: string; tipo: 'ok' | 'error' }

// =====================================================
// Utilidades compartidas
// =====================================================
const COLORES = ['emerald', 'green', 'amber', 'purple', 'pink'] as const;
const ICONOS = ['Heart', 'Leaf', 'Mountain', 'Book', 'Star', 'Globe', 'Users', 'Home', 'Music', 'Palette', 'Hash', 'Sprout'] as const;
const NIVELES = ['Nuevo', 'Aprendiz', 'Intermedio', 'Avanzado', 'Experta'] as const;

const colorBadge: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800',
  green:   'bg-green-100   text-green-800',
  amber:   'bg-amber-100   text-amber-800',
  purple:  'bg-purple-100  text-purple-800',
  pink:    'bg-pink-100    text-pink-800',
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================
let _toastId = 0;
function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all
            ${t.tipo === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}
        >
          <span>{t.tipo === 'ok' ? '✓' : '✗'} {t.mensaje}</span>
          <button onClick={() => remove(t.id)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// =====================================================
// MODAL GENÉRICO
// =====================================================
function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-slate-800">{titulo}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// =====================================================
// STAT CARD
// =====================================================
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.FC<React.SVGProps<SVGSVGElement>>; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// =====================================================
// SECCIÓN DASHBOARD
// =====================================================
function SeccionDashboard({ stats }: { stats: AdminStatsAPI | null }) {
  if (!stats) return <div className="text-center py-16 text-slate-400">Cargando estadísticas…</div>;
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Resumen general</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Usuarios registrados"  value={stats.total_usuarios}       icon={Users}         color="bg-emerald-500" />
        <StatCard label="Activos hoy"           value={stats.usuarios_activos_hoy}  icon={TrendingUp}    color="bg-blue-500" />
        <StatCard label="Módulos completados"   value={stats.modulos_completados}   icon={BookOpen}      color="bg-purple-500" />
        <StatCard label="Publicaciones"         value={stats.total_publicaciones}   icon={MessageSquare} color="bg-pink-500" />
        <StatCard label="Puntos otorgados"      value={stats.puntos_totales}        icon={Award}         color="bg-amber-500" />
        <StatCard label="Módulos de aprendizaje" value={stats.total_modulos}       icon={FileText}      color="bg-green-500" />
      </div>
    </div>
  );
}

// =====================================================
// EDITOR DE ACTIVIDAD (todos los tipos)
// =====================================================
const TIPOS_ACTIVIDAD = [
  { value: 'emparejar',      label: 'Emparejar — relacionar vocabulario Inga↔Español' },
  { value: 'completar',      label: 'Completar — selección múltiple con respuesta correcta' },
  { value: 'verdadero_falso', label: 'Verdadero / Falso — enunciados sobre el módulo' },
  { value: 'ordenar',        label: 'Ordenar — arrastrar fragmentos en el orden correcto' },
] as const;

function EditorActividad({
  actividad,
  onChange,
}: {
  actividad: Partial<AdminActividadAPI>;
  onChange: (act: Partial<AdminActividadAPI>) => void;
}) {
  const tipo = actividad.tipo ?? 'emparejar';

  const updPares = (fn: (p: NonNullable<AdminActividadAPI['pares']>) => NonNullable<AdminActividadAPI['pares']>) =>
    onChange({ ...actividad, pares: fn(actividad.pares ?? []) });
  const updOpciones = (fn: (o: NonNullable<AdminActividadAPI['opciones']>) => NonNullable<AdminActividadAPI['opciones']>) =>
    onChange({ ...actividad, opciones: fn(actividad.opciones ?? []) });
  const updVF = (fn: (v: NonNullable<AdminActividadAPI['enunciados_vf']>) => NonNullable<AdminActividadAPI['enunciados_vf']>) =>
    onChange({ ...actividad, enunciados_vf: fn(actividad.enunciados_vf ?? []) });
  const updOrdenar = (fn: (f: NonNullable<AdminActividadAPI['fragmentos_ordenar']>) => NonNullable<AdminActividadAPI['fragmentos_ordenar']>) =>
    onChange({ ...actividad, fragmentos_ordenar: fn(actividad.fragmentos_ordenar ?? []) });

  return (
    <div className="space-y-4">
      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de actividad</label>
        <select value={tipo}
          onChange={e => onChange({ ...actividad, tipo: e.target.value as AdminActividadAPI['tipo'], pares: [], opciones: [], enunciados_vf: [], fragmentos_ordenar: [] })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          {TIPOS_ACTIVIDAD.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Pregunta */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Instrucción / pregunta</label>
        <input type="text" value={actividad.pregunta ?? ''}
          onChange={e => onChange({ ...actividad, pregunta: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Ej: Empareja cada palabra con su significado en Inga" />
      </div>

      {/* COMPLETAR */}
      {tipo === 'completar' && (<>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Respuesta correcta</label>
          <input type="text" value={actividad.respuesta_correcta ?? ''}
            onChange={e => onChange({ ...actividad, respuesta_correcta: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Texto exacto de la opción correcta" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Opciones</label>
            <button onClick={() => updOpciones(o => [...o, { id: Date.now(), texto: '', orden: o.length + 1 }])}
              className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Opción
            </button>
          </div>
          {(actividad.opciones ?? []).map((op, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="text" value={op.texto}
                onChange={e => updOpciones(o => o.map((x, idx) => idx === i ? { ...x, texto: e.target.value } : x))}
                placeholder={`Opción ${i + 1}`} className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
              <button onClick={() => updOpciones(o => o.filter((_, idx) => idx !== i))}
                className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </>)}

      {/* EMPAREJAR */}
      {tipo === 'emparejar' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Pares Inga ↔ Español</label>
            <button onClick={() => updPares(p => [...p, { id: Date.now(), inga: '', espanol: '' }])}
              className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Par
            </button>
          </div>
          {(actividad.pares ?? []).map((par, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="text" value={par.inga}
                onChange={e => updPares(p => p.map((x, idx) => idx === i ? { ...x, inga: e.target.value } : x))}
                placeholder="Inga" className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
              <input type="text" value={par.espanol}
                onChange={e => updPares(p => p.map((x, idx) => idx === i ? { ...x, espanol: e.target.value } : x))}
                placeholder="Español" className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
              <button onClick={() => updPares(p => p.filter((_, idx) => idx !== i))}
                className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* VERDADERO / FALSO */}
      {tipo === 'verdadero_falso' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Enunciados</label>
            <button onClick={() => updVF(v => [...v, { id: Date.now(), enunciado: '', es_verdadero: true, orden: v.length }])}
              className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Enunciado
            </button>
          </div>
          {(actividad.enunciados_vf ?? []).map((en, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <input type="text" value={en.enunciado}
                onChange={e => updVF(v => v.map((x, idx) => idx === i ? { ...x, enunciado: e.target.value } : x))}
                placeholder="Ej: El saludo Inga 'Puangi' significa buenos días"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
              <select value={en.es_verdadero ? 'true' : 'false'}
                onChange={e => updVF(v => v.map((x, idx) => idx === i ? { ...x, es_verdadero: e.target.value === 'true' } : x))}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                <option value="true">✓ Verdadero</option>
                <option value="false">✗ Falso</option>
              </select>
              <button onClick={() => updVF(v => v.filter((_, idx) => idx !== i))}
                className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* ORDENAR */}
      {tipo === 'ordenar' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-slate-700">Fragmentos (en el orden correcto)</label>
            <button onClick={() => updOrdenar(f => [...f, { id: Date.now(), fragmento: '', orden_correcto: f.length }])}
              className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Fragmento
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-2">El orden en que los escribas aquí será el orden correcto para el alumno.</p>
          {(actividad.fragmentos_ordenar ?? []).map((fr, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <span className="text-xs text-slate-400 w-5 text-right">{i + 1}.</span>
              <input type="text" value={fr.fragmento}
                onChange={e => updOrdenar(f => f.map((x, idx) => idx === i ? { ...x, fragmento: e.target.value } : x))}
                placeholder="Ej: Puangi" className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
              <button onClick={() => updOrdenar(f => f.filter((_, idx) => idx !== i))}
                className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// MODAL DE CONTENIDO DEL MÓDULO (Actividades + Imágenes + Secciones + Audio)
// =====================================================
type ContenidoTab = 'actividades' | 'imagenes' | 'secciones' | 'audio';

function ModalContenidoModulo({ modulo, onClose, toast }: {
  modulo: AdminModuloAPI;
  onClose: () => void;
  toast: (m: string, t: 'ok' | 'error') => void;
}) {
  const [tab, setTab] = useState<ContenidoTab>('actividades');
  const [actividades, setActividades] = useState<AdminActividadAPI[]>([]);
  const [imagenes, setImagenes] = useState<ModuloImagenAPI[]>([]);
  const [secciones, setSecciones] = useState<ModuloSeccionAPI[]>([]);
  const [audios, setAudios] = useState<ModuloAudioAPI[]>([]);
  const [editAct, setEditAct] = useState<Partial<AdminActividadAPI> | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  // Carga inicial de todas las pestañas
  useEffect(() => {
    Promise.all([
      adminAPI.listarActividades(modulo.id),
      adminAPI.listarImagenes(modulo.id),
      adminAPI.listarSeccionesContenido(modulo.id),
      adminAPI.listarAudios(modulo.id),
    ]).then(([acts, imgs, secs, auds]) => {
      setActividades(acts); setImagenes(imgs); setSecciones(secs); setAudios(auds);
    }).catch(() => {});
  }, [modulo.id]);

  // ── Actividades ──
  const guardarActividad = async () => {
    if (!editAct) return;
    try {
      if (editAct.id) {
        const updated = await adminAPI.actualizarActividadV2(modulo.id, editAct.id, editAct);
        setActividades(prev => prev.map(a => a.id === updated.id ? updated : a));
        toast('Actividad actualizada', 'ok');
      } else {
        const nueva = await adminAPI.crearActividad(modulo.id, editAct);
        setActividades(prev => [...prev, nueva]);
        toast('Actividad creada', 'ok');
      }
      setEditAct(null);
    } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'error'); }
  };
  const eliminarActividad = async (id: number | string) => {
    const nId = Number(id);
    try {
      await adminAPI.eliminarActividadV2(modulo.id, nId);
      setActividades(prev => prev.filter(a => a.id !== nId));
      toast('Actividad eliminada', 'ok');
    } catch { toast('Error al eliminar', 'error'); }
  };

  // ── Imágenes ──
  const subirImagen = async (file: File) => {
    setSubiendo(true);
    try {
      const { url } = await uploadAPI.imagen(file);
      const img = await adminAPI.crearImagen(modulo.id, { url, orden: imagenes.length });
      setImagenes(prev => [...prev, img]);
      toast('Imagen subida', 'ok');
    } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'error'); }
    finally { setSubiendo(false); }
  };
  const eliminarImagen = async (id: number | string) => {
    const nId = Number(id);
    try {
      await adminAPI.eliminarImagen(modulo.id, nId);
      setImagenes(prev => prev.filter(i => i.id !== nId));
      toast('Imagen eliminada', 'ok');
    } catch { toast('Error', 'error'); }
  };

  // ── Secciones ──
  const [editSec, setEditSec] = useState<Partial<ModuloSeccionAPI> | null>(null);
  const guardarSeccion = async () => {
    if (!editSec?.titulo) return;
    try {
      if (editSec.id) {
        const u = await adminAPI.actualizarSeccionContenido(modulo.id, editSec.id, editSec);
        setSecciones(prev => prev.map(s => s.id === u.id ? u : s));
      } else {
        const n = await adminAPI.crearSeccionContenido(modulo.id, { ...editSec, orden: secciones.length });
        setSecciones(prev => [...prev, n]);
      }
      setEditSec(null); toast('Sección guardada', 'ok');
    } catch { toast('Error', 'error'); }
  };
  const eliminarSeccion = async (id: number | string) => {
    const nId = Number(id);
    try {
      await adminAPI.eliminarSeccionContenido(modulo.id, nId);
      setSecciones(prev => prev.filter(s => s.id !== nId));
      toast('Sección eliminada', 'ok');
    } catch { toast('Error', 'error'); }
  };

  // ── Audios ──
  const [editAud, setEditAud] = useState<Partial<ModuloAudioAPI> | null>(null);
  const guardarAudio = async () => {
    if (!editAud?.titulo || !editAud?.url) return;
    try {
      if (editAud.id) {
        const u = await adminAPI.actualizarAudio(modulo.id, editAud.id, editAud);
        setAudios(prev => prev.map(a => a.id === u.id ? u : a));
      } else {
        const n = await adminAPI.crearAudio(modulo.id, { ...editAud, orden: audios.length });
        setAudios(prev => [...prev, n]);
      }
      setEditAud(null); toast('Audio guardado', 'ok');
    } catch { toast('Error', 'error'); }
  };
  const eliminarAudio = async (id: number | string) => {
    const nId = Number(id);
    try {
      await adminAPI.eliminarAudio(modulo.id, nId);
      setAudios(prev => prev.filter(a => a.id !== nId));
      toast('Audio eliminado', 'ok');
    } catch { toast('Error', 'error'); }
  };

  const TABS: { key: ContenidoTab; label: string; count: number }[] = [
    { key: 'actividades', label: 'Actividades', count: actividades.length },
    { key: 'imagenes',    label: 'Imágenes',    count: imagenes.length },
    { key: 'secciones',  label: 'Secciones',   count: secciones.length },
    { key: 'audio',      label: 'Audio',        count: audios.length },
  ];

  const TIPO_ACT_LABEL: Record<string, string> = {
    emparejar: 'Emparejar', completar: 'Completar', verdadero_falso: 'V/F', ordenar: 'Ordenar',
  };
  const TIPO_ACT_COLOR: Record<string, string> = {
    emparejar: 'bg-emerald-100 text-emerald-700', completar: 'bg-blue-100 text-blue-700',
    verdadero_falso: 'bg-amber-100 text-amber-700', ordenar: 'bg-purple-100 text-purple-700',
  };
  const TIPO_SEC_COLOR: Record<string, string> = {
    texto: 'bg-slate-100 text-slate-600', vocabulario: 'bg-emerald-100 text-emerald-700',
    cultural: 'bg-amber-100 text-amber-700', pronunciacion: 'bg-blue-100 text-blue-700',
    gramatica: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Contenido: {modulo.titulo}</h3>
            <p className="text-xs text-slate-400">Gestiona actividades, imágenes, secciones y audio</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
                tab === t.key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {t.label}
              {t.count > 0 && <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ── ACTIVIDADES ── */}
          {tab === 'actividades' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">{actividades.length} actividad(es) en este módulo</p>
                <button onClick={() => setEditAct({ tipo: 'emparejar', pregunta: '', pares: [] })}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-emerald-700">
                  <Plus className="w-4 h-4" /> Nueva actividad
                </button>
              </div>
              {actividades.map(act => (
                <div key={act.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_ACT_COLOR[act.tipo] ?? ''}`}>
                          {TIPO_ACT_LABEL[act.tipo] ?? act.tipo}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800">{act.pregunta}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {act.tipo === 'emparejar' && `${act.pares?.length ?? 0} pares`}
                        {act.tipo === 'completar' && `${act.opciones?.length ?? 0} opciones`}
                        {act.tipo === 'verdadero_falso' && `${act.enunciados_vf?.length ?? 0} enunciados`}
                        {act.tipo === 'ordenar' && `${act.fragmentos_ordenar?.length ?? 0} fragmentos`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditAct({ ...act })}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => eliminarActividad(Number(act.id))}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {actividades.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">Sin actividades aún. Crea la primera.</div>
              )}

              {/* Editor inline de actividad */}
              {editAct && (
                <div className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50/30 mt-3">
                  <h4 className="font-semibold text-slate-700 mb-3">{editAct.id ? 'Editar actividad' : 'Nueva actividad'}</h4>
                  <EditorActividad actividad={editAct} onChange={setEditAct} />
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setEditAct(null)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarActividad} className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg flex items-center gap-1.5">
                      <Save className="w-3.5 h-3.5" /> Guardar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── IMÁGENES ── */}
          {tab === 'imagenes' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">{imagenes.length} imagen(es)</p>
                <label className={`cursor-pointer flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-emerald-700 ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}>
                  <ImagePlus className="w-4 h-4" />
                  {subiendo ? 'Subiendo…' : 'Subir imagen'}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && subirImagen(e.target.files[0])} />
                </label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {imagenes.map(img => (
                  <div key={img.id} className="relative group rounded-xl overflow-hidden border border-slate-200">
                    <img src={img.url} alt={img.alt ?? ''} className="w-full h-32 object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button onClick={() => eliminarImagen(img.id)}
                        className="p-1.5 bg-red-500 text-white rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {img.caption && <p className="text-xs text-slate-500 p-2 truncate">{img.caption}</p>}
                  </div>
                ))}
              </div>
              {imagenes.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Sin imágenes. Sube la primera.</div>}
            </div>
          )}

          {/* ── SECCIONES ── */}
          {tab === 'secciones' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">{secciones.length} sección(es) de contenido</p>
                <button onClick={() => setEditSec({ titulo: '', contenido: '', tipo: 'texto', orden: secciones.length })}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-emerald-700">
                  <Plus className="w-4 h-4" /> Nueva sección
                </button>
              </div>
              {secciones.map(sec => (
                <div key={sec.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_SEC_COLOR[sec.tipo] ?? ''}`}>{sec.tipo}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{sec.titulo}</p>
                      {sec.contenido && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{sec.contenido}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditSec({ ...sec })}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => eliminarSeccion(sec.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {secciones.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Sin secciones aún.</div>}

              {editSec && (
                <div className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50/30 mt-3 space-y-3">
                  <h4 className="font-semibold text-slate-700">{editSec.id ? 'Editar sección' : 'Nueva sección'}</h4>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Título *</label>
                    <input type="text" value={editSec.titulo ?? ''}
                      onChange={e => setEditSec(p => ({ ...p!, titulo: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Tipo</label>
                    <select value={editSec.tipo ?? 'texto'}
                      onChange={e => setEditSec(p => ({ ...p!, tipo: e.target.value as ModuloSeccionAPI['tipo'] }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="texto">Texto general</option>
                      <option value="vocabulario">Vocabulario</option>
                      <option value="cultural">Contexto cultural</option>
                      <option value="pronunciacion">Pronunciación</option>
                      <option value="gramatica">Gramática</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Contenido</label>
                    <textarea rows={5} value={editSec.contenido ?? ''}
                      onChange={e => setEditSec(p => ({ ...p!, contenido: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-y" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditSec(null)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarSeccion} className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg flex items-center gap-1.5">
                      <Save className="w-3.5 h-3.5" /> Guardar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── AUDIO ── */}
          {tab === 'audio' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">{audios.length} audio(s)</p>
                <button onClick={() => setEditAud({ titulo: '', url: '', descripcion: '', orden: audios.length })}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-emerald-700">
                  <Plus className="w-4 h-4" /> Agregar audio
                </button>
              </div>
              {audios.map(aud => (
                <div key={aud.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{aud.titulo}</p>
                      {aud.descripcion && <p className="text-xs text-slate-500 mt-0.5">{aud.descripcion}</p>}
                      <audio controls src={aud.url} className="mt-2 w-full h-10" />
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditAud({ ...aud })}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => eliminarAudio(aud.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {audios.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Sin audios aún. Sube un archivo o pega una URL.</div>}

              {editAud && (
                <div className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50/30 mt-3 space-y-3">
                  <h4 className="font-semibold text-slate-700">{editAud.id ? 'Editar audio' : 'Nuevo audio'}</h4>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Título *</label>
                    <input type="text" value={editAud.titulo ?? ''}
                      onChange={e => setEditAud(p => ({ ...p!, titulo: e.target.value }))}
                      placeholder="Ej: Saludo en Inga"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>

                  {/* Subir archivo desde PC */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Archivo de audio</label>
                    <label className={`flex items-center gap-2 cursor-pointer border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl px-4 py-3 transition ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}>
                      <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-500">
                        {subiendo ? 'Subiendo a Cloudinary…' : 'Seleccionar archivo MP3, WAV, OGG, M4A'}
                      </span>
                      <input type="file" accept="audio/*" className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setSubiendo(true);
                          try {
                            const { url } = await uploadAPI.audio(file);
                            setEditAud(p => ({ ...p!, url }));
                            toast('Audio subido a Cloudinary', 'ok');
                          } catch (err) {
                            toast(err instanceof Error ? err.message : 'Error al subir', 'error');
                          } finally { setSubiendo(false); }
                        }} />
                    </label>
                    <p className="text-xs text-slate-400 mt-1">O pega la URL directamente abajo</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">URL del audio *</label>
                    <input type="text" value={editAud.url ?? ''}
                      onChange={e => setEditAud(p => ({ ...p!, url: e.target.value }))}
                      placeholder="https://res.cloudinary.com/… o cualquier URL pública"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-xs" />
                  </div>

                  {editAud.url && (
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-500 mb-2">Vista previa:</p>
                      <audio controls src={editAud.url} className="w-full h-10" />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Descripción</label>
                    <input type="text" value={editAud.descripcion ?? ''}
                      onChange={e => setEditAud(p => ({ ...p!, descripcion: e.target.value }))}
                      placeholder="Ej: Pronunciación del saludo matutino"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditAud(null)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarAudio} disabled={!editAud.titulo || !editAud.url}
                      className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                      <Save className="w-3.5 h-3.5" /> Guardar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// =====================================================
// SECCIÓN MÓDULOS
// =====================================================
function SeccionModulos({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [modulos, setModulos] = useState<AdminModuloAPI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalModulo, setModalModulo] = useState<Partial<AdminModuloAPI> | null>(null);
  const [modalContenido, setModalContenido] = useState<AdminModuloAPI | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setModulos(await adminAPI.listarModulos());
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarModulo = async () => {
    if (!modalModulo) return;
    try {
      if (modalModulo.id) {
        await adminAPI.actualizarModulo(modalModulo.id, modalModulo);
        toast('Módulo actualizado', 'ok');
      } else {
        await adminAPI.crearModulo(modalModulo as Omit<AdminModuloAPI, 'id' | 'completados' | 'tiene_actividad'>);
        toast('Módulo creado', 'ok');
      }
      setModalModulo(null);
      cargar();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error');
    }
  };

  const eliminar = async (id: number) => {
    try {
      await adminAPI.eliminarModulo(id);
      toast('Módulo eliminado', 'ok');
      setConfirmDelete(null);
      cargar();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al eliminar', 'error');
    }
  };

  const nuevoModulo: Partial<AdminModuloAPI> = {
    clave: '', titulo: '', icono: 'Book', color: 'emerald',
    descripcion: '', video_url: '', frase: '', traduccion: '',
  };

  if (cargando) return <div className="text-center py-16 text-slate-400">Cargando módulos…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Módulos de aprendizaje</h2>
        <button
          onClick={() => setModalModulo(nuevoModulo)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Nuevo módulo
        </button>
      </div>

      <div className="space-y-3">
        {modulos.map(m => (
          <div key={m.id} className="bg-white rounded-xl shadow border border-slate-100">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer"
              onClick={() => setExpandedId(expandedId === Number(m.id) ? null : Number(m.id))}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorBadge[m.color] ?? 'bg-slate-100 text-slate-700'}`}>
                  {m.color}
                </span>
                <span className="font-semibold text-slate-800 truncate">{m.titulo}</span>
                <span className="text-xs text-slate-400 hidden md:inline">/{m.clave}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-500">{m.completados} completados</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${m.tiene_actividad ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {m.tiene_actividad ? 'Con actividad' : 'Sin actividad'}
                </span>
                {expandedId === m.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {expandedId === m.id && (
              <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 rounded-b-xl space-y-2">
                <p className="text-sm text-slate-600">{m.descripcion}</p>
                <p className="text-sm text-slate-500">
                  <span className="font-medium">Frase destacada:</span> {m.frase} — <em>{m.traduccion}</em>
                </p>
                {m.video_url && (
                  <p className="text-xs text-slate-400 truncate">Video: {m.video_url}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => setModalModulo({ ...m })}
                    className="flex items-center gap-1.5 text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar info
                  </button>
                  <button
                    onClick={() => setModalContenido(m)}
                    className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" /> Contenido
                  </button>
                  <button
                    onClick={() => setConfirmDelete(Number(m.id))}
                    className="flex items-center gap-1.5 text-sm bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal editar/crear módulo */}
      {modalModulo && (
        <Modal titulo={modalModulo.id ? 'Editar módulo' : 'Nuevo módulo'} onClose={() => setModalModulo(null)}>
          <div className="space-y-3">
            {!modalModulo.id && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Clave única (slug)</label>
                <input type="text" value={modalModulo.clave ?? ''}
                  onChange={e => setModalModulo(p => ({ ...p!, clave: e.target.value }))}
                  placeholder="ej: saludos" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
              <input type="text" value={modalModulo.titulo ?? ''}
                onChange={e => setModalModulo(p => ({ ...p!, titulo: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ícono</label>
                <select value={modalModulo.icono ?? 'Book'}
                  onChange={e => setModalModulo(p => ({ ...p!, icono: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {ICONOS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                <select value={modalModulo.color ?? 'emerald'}
                  onChange={e => setModalModulo(p => ({ ...p!, color: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {COLORES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <textarea rows={2} value={modalModulo.descripcion ?? ''}
                onChange={e => setModalModulo(p => ({ ...p!, descripcion: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Frase en Inga</label>
                <input type="text" value={modalModulo.frase ?? ''}
                  onChange={e => setModalModulo(p => ({ ...p!, frase: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Traducción</label>
                <input type="text" value={modalModulo.traduccion ?? ''}
                  onChange={e => setModalModulo(p => ({ ...p!, traduccion: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">URL del video (embed)</label>
              <input type="text" value={modalModulo.video_url ?? ''}
                onChange={e => setModalModulo(p => ({ ...p!, video_url: e.target.value }))}
                placeholder="https://www.youtube.com/embed/..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModalModulo(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={guardarModulo} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-2">
                <Save className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal contenido del módulo */}
      {modalContenido && (
        <ModalContenidoModulo
          modulo={modalContenido}
          onClose={() => setModalContenido(null)}
          toast={toast}
        />
      )}

      {/* Confirmar eliminación */}
      {confirmDelete !== null && (
        <Modal titulo="Confirmar eliminación" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-amber-600">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                Esta acción eliminará el módulo y toda su actividad asociada de forma permanente.
                También se perderá el progreso de los usuarios en este módulo.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={() => eliminar(confirmDelete)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700">Sí, eliminar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =====================================================
// SECCIÓN USUARIOS
// =====================================================
function SeccionUsuarios({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [usuarios, setUsuarios] = useState<AdminUsuarioAPI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<AdminUsuarioAPI | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUsuarioAPI | null>(null);
  const [form, setForm] = useState({ nombre: '', puntos: 0, nivel: '', role: '' });

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setUsuarios(await adminAPI.listarUsuarios());
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirEdicion = (u: AdminUsuarioAPI) => {
    setEditando(u);
    setForm({ nombre: u.nombre, puntos: u.puntos, nivel: u.nivel, role: u.role });
  };

  const guardar = async () => {
    if (!editando) return;
    try {
      await adminAPI.actualizarUsuario(editando.id, form);
      toast('Usuario actualizado', 'ok');
      setEditando(null);
      cargar();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al actualizar', 'error');
    }
  };

  const eliminar = async () => {
    if (!confirmDelete) return;
    try {
      await adminAPI.eliminarUsuario(confirmDelete.id);
      toast('Usuario eliminado', 'ok');
      setConfirmDelete(null);
      cargar();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al eliminar', 'error');
    }
  };

  const toggleAdmin = async (u: AdminUsuarioAPI) => {
    const nuevoRole = u.role === 'admin' ? 'user' : 'admin';
    try {
      await adminAPI.actualizarUsuario(u.id, { role: nuevoRole });
      toast(nuevoRole === 'admin' ? 'Usuario promovido a administrador' : 'Rol de admin removido', 'ok');
      cargar();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al cambiar rol', 'error');
    }
  };

  const filtrados = usuarios.filter(u =>
    u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.email.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (cargando) return <div className="text-center py-16 text-slate-400">Cargando usuarios…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800">Usuarios ({filtrados.length})</h2>
        <input
          type="search"
          placeholder="Buscar por nombre o email…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-64"
        />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Usuario</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold hidden md:table-cell">Nivel</th>
                <th className="text-center px-4 py-3 text-slate-600 font-semibold">Puntos</th>
                <th className="text-center px-4 py-3 text-slate-600 font-semibold hidden lg:table-cell">Módulos</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold hidden xl:table-cell">Último acceso</th>
                <th className="text-center px-4 py-3 text-slate-600 font-semibold">Rol</th>
                <th className="text-center px-4 py-3 text-slate-600 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{u.avatar}</span>
                      <div>
                        <p className="font-medium text-slate-800">{u.nombre}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{u.nivel}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{u.puntos}</td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell text-slate-500">{u.modulos_completados}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-slate-400 text-xs">{fmtDate(u.ultimo_acceso)}</td>
                  <td className="px-4 py-3 text-center">
                    {u.role === 'admin'
                      ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
                      : <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Usuario</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => abrirEdicion(u)} title="Editar" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleAdmin(u)} title={u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
                        {u.role === 'admin' ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setConfirmDelete(u)} title="Eliminar"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar usuario */}
      {editando && (
        <Modal titulo={`Editar: ${editando.nombre}`} onClose={() => setEditando(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
              <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Puntos</label>
                <input type="number" min={0} value={form.puntos} onChange={e => setForm(p => ({ ...p, puntos: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nivel</label>
                <select value={form.nivel} onChange={e => setForm(p => ({ ...p, nivel: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditando(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={guardar} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-2">
                <Save className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmar eliminación */}
      {confirmDelete && (
        <Modal titulo="Eliminar usuario" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-amber-600">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                ¿Eliminar a <strong>{confirmDelete.nombre}</strong> ({confirmDelete.email})? Esta acción no se puede deshacer.
                Se perderán todos sus datos de progreso, publicaciones y retos.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={eliminar} className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700">Sí, eliminar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =====================================================
// SECCIÓN COMUNIDAD
// =====================================================
function SeccionComunidad({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [pubs, setPubs] = useState<AdminPublicacionAPI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try { setCargando(true); setPubs(await adminAPI.listarPublicaciones()); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async () => {
    if (!confirmDelete) return;
    try {
      await adminAPI.eliminarPublicacion(confirmDelete);
      toast('Publicación eliminada', 'ok');
      setConfirmDelete(null);
      cargar();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al eliminar', 'error');
    }
  };

  if (cargando) return <div className="text-center py-16 text-slate-400">Cargando publicaciones…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Comunidad ({pubs.length} publicaciones)</h2>

      {pubs.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-slate-400">No hay publicaciones aún.</div>
      )}

      <div className="space-y-3">
        {pubs.map(p => (
          <div key={p.id} className="bg-white rounded-xl shadow p-4 border border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-2xl shrink-0">{p.avatar}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-800 text-sm">{p.usuario}</span>
                    <span className="text-xs text-slate-400">{fmtDate(p.creado_en)}</span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-3">{p.contenido}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>❤️ {p.likes} me gusta</span>
                    <span>💬 {p.comentarios} comentarios</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setConfirmDelete(Number(p.id))}
                className="shrink-0 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                title="Eliminar publicación"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmDelete !== null && (
        <Modal titulo="Eliminar publicación" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-amber-600">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                ¿Eliminar esta publicación? Se eliminarán también todos sus comentarios y reacciones.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={eliminar} className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700">Sí, eliminar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =====================================================
// SECCIÓN PRESENTACIÓN — CARTILLA DIGITAL
// =====================================================
const TIPO_SEC_BADGE: Record<string, string> = {
  banner:       'bg-rose-100    text-rose-700',
  portada:      'bg-amber-100   text-amber-700',
  presentacion: 'bg-blue-100    text-blue-700',
  modulo:       'bg-emerald-100 text-emerald-700',
  galeria:      'bg-purple-100  text-purple-700',
  cierre:       'bg-slate-100   text-slate-600',
};
const TIPOS_SECCION = ['banner', 'portada', 'presentacion', 'modulo', 'galeria', 'cierre'] as const;

function SeccionPresentacion({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [secciones, setSecciones] = useState<CartillaSeccionAPI[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [editando, setEditando]   = useState<Partial<CartillaSeccionAPI> | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [subiendo, setSubiendo]   = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setSecciones(await seccionesAPI.listar()); } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!editando) return;
    try {
      if (editando.id) {
        await seccionesAPI.actualizar(editando.id, editando);
        toast('Sección actualizada', 'ok');
      } else {
        await seccionesAPI.crear(editando as Omit<CartillaSeccionAPI, 'id' | 'creado_en' | 'actualizado_en'>);
        toast('Sección creada', 'ok');
      }
      setEditando(null); cargar();
    } catch (e) { toast(e instanceof Error ? e.message : 'Error al guardar', 'error'); }
  };

  const eliminar = async () => {
    if (confirmDel === null) return;
    try {
      await seccionesAPI.eliminar(confirmDel);
      toast('Sección eliminada', 'ok');
      setConfirmDel(null); cargar();
    } catch (e) { toast(e instanceof Error ? e.message : 'Error al eliminar', 'error'); }
  };

  const mover = async (id: number | string, dir: 'up' | 'down') => {
    const nId = Number(id);
    const idx = secciones.findIndex(s => s.id === nId);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === secciones.length - 1) return;
    const other = secciones[dir === 'up' ? idx - 1 : idx + 1];
    const curr  = secciones[idx];
    try {
      await seccionesAPI.reordenar([
        { id: curr.id,  orden: other.orden },
        { id: other.id, orden: curr.orden },
      ]);
      cargar();
    } catch { toast('Error al reordenar', 'error'); }
  };

  const toggleActivo = async (s: CartillaSeccionAPI) => {
    try {
      await seccionesAPI.actualizar(s.id, { activo: !s.activo });
      toast(s.activo ? 'Sección ocultada' : 'Sección activada', 'ok');
      cargar();
    } catch { toast('Error', 'error'); }
  };

  const handleFile = async (file: File) => {
    setSubiendo(true);
    try {
      const { url } = await uploadAPI.imagen(file);
      setEditando(p => p ? { ...p, imagen_url: url } : null);
      toast('Imagen cargada', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al subir imagen', 'error');
    } finally { setSubiendo(false); }
  };

  const nuevaSeccion: Partial<CartillaSeccionAPI> = {
    titulo: '', subtitulo: null, contenido: null,
    imagen_url: null, imagen_alt: null, link_url: null,
    orden: secciones.length, tipo: 'presentacion', activo: true,
  };

  if (cargando) return <div className="text-center py-16 text-slate-400">Cargando secciones…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Presentación de la Cartilla</h2>
          <p className="text-sm text-slate-500 mt-0.5">Secciones con imagen y texto de la cartilla digital. {secciones.length} secciones.</p>
        </div>
        <button onClick={() => setEditando(nuevaSeccion)}
          className="shrink-0 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nueva sección
        </button>
      </div>

      {secciones.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-slate-400">No hay secciones aún.</div>
      )}

      <div className="space-y-2">
        {secciones.map((s, idx) => (
          <div key={s.id}
            className={`bg-white rounded-xl shadow border border-slate-100 flex overflow-hidden transition ${!s.activo ? 'opacity-55' : ''}`}>
            {/* Miniatura */}
            <div className="w-24 h-24 shrink-0 bg-slate-100 flex items-center justify-center overflow-hidden">
              {s.imagen_url
                ? <img src={s.imagen_url} alt={s.imagen_alt ?? s.titulo} className="w-full h-full object-cover" />
                : <ImagePlus className="w-8 h-8 text-slate-300" />}
            </div>
            {/* Info */}
            <div className="flex-1 px-4 py-3 min-w-0 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-xs text-slate-400 font-mono tabular-nums">#{s.orden}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_SEC_BADGE[s.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                    {s.tipo}
                  </span>
                  {!s.activo && <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">Oculta</span>}
                  {!s.imagen_url && <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Sin imagen</span>}
                </div>
                <p className="font-semibold text-slate-800 text-sm truncate">{s.titulo}</p>
                {s.subtitulo && <p className="text-xs text-slate-500 truncate">{s.subtitulo}</p>}
              </div>
              {/* Acciones */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => mover(s.id, 'up')} disabled={idx === 0} title="Subir"
                  className="p-1.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => mover(s.id, 'down')} disabled={idx === secciones.length - 1} title="Bajar"
                  className="p-1.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button onClick={() => toggleActivo(s)} title={s.activo ? 'Ocultar' : 'Mostrar'}
                  className={`p-1.5 rounded-lg transition ${s.activo ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-50'}`}>
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => setEditando({ ...s })}
                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmDel(Number(s.id))}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal editar / crear */}
      {editando && (
        <Modal titulo={editando.id ? 'Editar sección' : 'Nueva sección'} onClose={() => setEditando(null)}>
          <div className="space-y-4">
            {/* Imagen */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Imagen</label>
              {editando.imagen_url ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={editando.imagen_url} alt="" className="w-full h-44 object-cover rounded-xl" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition rounded-xl flex items-center justify-center gap-3">
                    <label className="cursor-pointer flex items-center gap-1.5 bg-white text-slate-800 px-3 py-1.5 rounded-lg text-sm font-medium shadow">
                      <Upload className="w-4 h-4" />
                      {subiendo ? 'Subiendo…' : 'Cambiar'}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    </label>
                    <button onClick={() => setEditando(p => p ? { ...p, imagen_url: null } : null)}
                      className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow">
                      <Trash2 className="w-4 h-4" /> Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <label className={`cursor-pointer flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-200 rounded-xl hover:bg-slate-50 transition ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}>
                  {subiendo
                    ? <p className="text-sm text-slate-500 animate-pulse">Subiendo imagen…</p>
                    : <>
                        <ImagePlus className="w-10 h-10 text-slate-300" />
                        <p className="text-sm text-slate-500 font-medium">Haz clic para cargar una imagen</p>
                        <p className="text-xs text-slate-400">JPG, PNG, WEBP — máx. 10 MB</p>
                      </>
                  }
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                </label>
              )}
              <input type="text" value={editando.imagen_url ?? ''}
                onChange={e => setEditando(p => p ? { ...p, imagen_url: e.target.value || null } : null)}
                placeholder="O pega una URL directamente…"
                className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 placeholder:text-slate-300" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
              <input type="text" value={editando.titulo ?? ''}
                onChange={e => setEditando(p => ({ ...p!, titulo: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subtítulo / frase Inga</label>
              <input type="text" value={editando.subtitulo ?? ''}
                onChange={e => setEditando(p => ({ ...p!, subtitulo: e.target.value || null }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contenido</label>
              <textarea rows={4} value={editando.contenido ?? ''}
                onChange={e => setEditando(p => ({ ...p!, contenido: e.target.value || null }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-y" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enlace al hacer clic</label>
              <input type="text" value={editando.link_url ?? ''}
                onChange={e => setEditando(p => ({ ...p!, link_url: e.target.value || null }))}
                placeholder="https://… o ruta interna"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-slate-400 mt-1">Opcional. Para banners: el clic redirige aquí. URLs externas abren en nueva pestaña.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select value={editando.tipo ?? 'presentacion'}
                  onChange={e => setEditando(p => ({ ...p!, tipo: e.target.value as CartillaSeccionAPI['tipo'] }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {TIPOS_SECCION.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Orden</label>
                <input type="number" min={0} value={editando.orden ?? 0}
                  onChange={e => setEditando(p => ({ ...p!, orden: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={editando.activo !== false}
                onChange={e => setEditando(p => ({ ...p!, activo: e.target.checked }))}
                className="w-4 h-4 accent-emerald-600 rounded" />
              <span className="text-sm text-slate-700">Sección visible en la cartilla</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditando(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={guardar} disabled={subiendo || !editando.titulo}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDel !== null && (
        <Modal titulo="Eliminar sección" onClose={() => setConfirmDel(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-amber-600">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">¿Eliminar esta sección de la cartilla? Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={eliminar} className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700">Sí, eliminar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =====================================================
// SECCIÓN CONFIGURACIÓN (Cloudinary y otras)
// =====================================================
function SeccionConfiguracion({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [cfg, setCfg] = useState({ cloudinary_cloud_name: '', cloudinary_api_key: '', cloudinary_api_secret: '' });
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    configAPI.get()
      .then(data => setCfg({
        cloudinary_cloud_name: data.cloudinary_cloud_name ?? '',
        cloudinary_api_key:    data.cloudinary_api_key    ?? '',
        cloudinary_api_secret: data.cloudinary_api_secret ?? '',
      }))
      .catch(() => null)
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try {
      await configAPI.save(cfg);
      toast('Configuración guardada', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error');
    } finally { setGuardando(false); }
  };

  if (cargando) return <div className="text-center py-16 text-slate-400">Cargando configuración…</div>;

  const allSet = cfg.cloudinary_cloud_name && cfg.cloudinary_api_key && cfg.cloudinary_api_secret;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800">Configuración</h2>

      {/* Cloudinary */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-xl shrink-0">
            <Upload className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Cloudinary — Almacenamiento de imágenes</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Configura tu cuenta de Cloudinary para poder cargar imágenes en las secciones de la cartilla.
            </p>
            {allSet
              ? <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">✓ Credenciales configuradas</span>
              : <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">⚠ Pendiente de configurar</span>
            }
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cloud Name</label>
            <input
              type="text"
              value={cfg.cloudinary_cloud_name}
              onChange={e => setCfg(p => ({ ...p, cloudinary_cloud_name: e.target.value }))}
              placeholder="Ej: my-cartilla-cloud"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
            <input
              type="text"
              value={cfg.cloudinary_api_key}
              onChange={e => setCfg(p => ({ ...p, cloudinary_api_key: e.target.value }))}
              placeholder="123456789012345"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={cfg.cloudinary_api_secret}
                onChange={e => setCfg(p => ({ ...p, cloudinary_api_secret: e.target.value }))}
                placeholder="••••••••••••••••••••••••"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <button
                type="button"
                onClick={() => setShowSecret(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 transition"
          >
            <Save className="w-4 h-4" />
            {guardando ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 space-y-1.5 border border-slate-100">
          <p className="font-semibold text-slate-600 text-sm">¿Cómo obtener las credenciales?</p>
          <p>1. Crea una cuenta gratuita en <strong>cloudinary.com</strong> (plan gratuito es suficiente).</p>
          <p>2. En tu <strong>Dashboard</strong> encontrarás el <em>Cloud Name</em>, <em>API Key</em> y <em>API Secret</em>.</p>
          <p>3. Copia y pega los tres valores aquí, guarda y ya podrás subir imágenes desde la sección <em>Presentación</em>.</p>
          <p className="text-slate-400 pt-1">Las credenciales se almacenan en la base de datos del servidor, nunca en el navegador.</p>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// SECCIÓN BANCO DE CONOCIMIENTO
// =====================================================
const TIPOS_TEXTO = ['cancion', 'relato', 'dialogo', 'sentido_cultural', 'principio', 'frase'] as const;
const TIPO_BADGE: Record<string, string> = {
  cancion:          'bg-pink-100   text-pink-700',
  relato:           'bg-purple-100 text-purple-700',
  dialogo:          'bg-blue-100   text-blue-700',
  sentido_cultural: 'bg-amber-100  text-amber-700',
  principio:        'bg-emerald-100 text-emerald-700',
  frase:            'bg-green-100  text-green-700',
};

function SeccionBanco({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [tab, setTab] = useState<BancoTab>('vocabulario');
  const [modulos, setModulos] = useState<AdminModuloAPI[]>([]);

  // ── Vocabulario ────────────────────────────────────
  const [vocab, setVocab]           = useState<BancoVocabAPI[]>([]);
  const [vocabCargando, setVocabC]  = useState(true);
  const [busqueda, setBusqueda]     = useState('');
  const [filtroMod, setFiltroMod]   = useState('');
  const [editVocab, setEditVocab]   = useState<Partial<BancoVocabAPI> | null>(null);

  // ── Textos ─────────────────────────────────────────
  const [textos, setTextos]         = useState<BancoTextoAPI[]>([]);
  const [textosCargando, setTextoC] = useState(true);
  const [editTexto, setEditTexto]   = useState<Partial<BancoTextoAPI> | null>(null);

  // ── Importar ───────────────────────────────────────
  const [importRaw, setImportRaw]         = useState('');
  const [importModId, setImportModId]     = useState('');
  const [importCat, setImportCat]         = useState('general');
  const [preview, setPreview]             = useState<{ espanol: string; inga: string }[]>([]);
  const [importando, setImportando]       = useState(false);

  const cargarVocab = useCallback(async () => {
    setVocabC(true);
    try { setVocab(await bancoAPI.listarVocabulario()); } finally { setVocabC(false); }
  }, []);

  const cargarTextos = useCallback(async () => {
    setTextoC(true);
    try { setTextos(await bancoAPI.listarTextos()); } finally { setTextoC(false); }
  }, []);

  useEffect(() => {
    cargarVocab();
    cargarTextos();
    adminAPI.listarModulos().then(setModulos).catch(() => null);
  }, [cargarVocab, cargarTextos]);

  const vocabFiltrados = vocab.filter(v => {
    const q = busqueda.toLowerCase();
    const matchText = !q || v.espanol.toLowerCase().includes(q) || v.inga.toLowerCase().includes(q);
    const matchMod  = !filtroMod || String(v.modulo_id) === filtroMod;
    return matchText && matchMod;
  });

  const guardarVocab = async () => {
    if (!editVocab) return;
    try {
      if (editVocab.id) {
        await bancoAPI.actualizarVocabulario(editVocab.id, editVocab as BancoVocabAPI);
        toast('Entrada actualizada', 'ok');
      } else {
        await bancoAPI.crearVocabulario(editVocab as Omit<BancoVocabAPI, 'id' | 'creado_en'>);
        toast('Entrada creada', 'ok');
      }
      setEditVocab(null); cargarVocab();
    } catch (e) { toast(e instanceof Error ? e.message : 'Error al guardar', 'error'); }
  };

  const eliminarVocab = async (id: number | string) => {
    try { await bancoAPI.eliminarVocabulario(Number(id)); toast('Entrada eliminada', 'ok'); cargarVocab(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Error al eliminar', 'error'); }
  };

  const guardarTexto = async () => {
    if (!editTexto) return;
    try {
      if (editTexto.id) {
        await bancoAPI.actualizarTexto(editTexto.id, editTexto as BancoTextoAPI);
        toast('Texto actualizado', 'ok');
      } else {
        await bancoAPI.crearTexto(editTexto as Omit<BancoTextoAPI, 'id' | 'creado_en'>);
        toast('Texto creado', 'ok');
      }
      setEditTexto(null); cargarTextos();
    } catch (e) { toast(e instanceof Error ? e.message : 'Error al guardar', 'error'); }
  };

  const eliminarTexto = async (id: number | string) => {
    try { await bancoAPI.eliminarTexto(Number(id)); toast('Texto eliminado', 'ok'); cargarTextos(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Error al eliminar', 'error'); }
  };

  const parsear = (raw: string) =>
    raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => {
      const sep = l.includes(' = ') ? ' = ' : l.includes(' | ') ? ' | ' : '\t';
      const p = l.split(sep);
      return p.length >= 2 ? { espanol: p[0].trim(), inga: p[1].trim() } : null;
    }).filter(Boolean) as { espanol: string; inga: string }[];

  const handleImportar = async () => {
    if (preview.length === 0) { toast('Nada que importar', 'error'); return; }
    setImportando(true);
    try {
      const { insertados } = await bancoAPI.importarVocabulario(preview, importModId ? Number(importModId) : null, importCat);
      toast(`${insertados} entradas importadas`, 'ok');
      setImportRaw(''); setPreview([]); cargarVocab();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al importar', 'error');
    } finally { setImportando(false); }
  };

  const nuevoVocab: Partial<BancoVocabAPI> = { espanol: '', inga: '', categoria: 'general', modulo_id: null, notas: null };
  const nuevoTexto: Partial<BancoTextoAPI> = { titulo: '', tipo: 'cancion', contenido: '', modulo_id: null };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Banco de Conocimiento</h2>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {(['vocabulario', 'textos', 'importar'] as BancoTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${tab === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {t === 'vocabulario' ? 'Vocabulario' : t === 'textos' ? 'Textos culturales' : 'Importar'}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB VOCABULARIO ── */}
      {tab === 'vocabulario' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <input type="search" placeholder="Buscar español o inga…" value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-40" />
            <select value={filtroMod} onChange={e => setFiltroMod(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm">
              <option value="">Todos los módulos</option>
              {modulos.map(m => <option key={m.id} value={String(m.id)}>{m.titulo}</option>)}
            </select>
            <button onClick={() => setEditVocab(nuevoVocab)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            {vocabCargando ? (
              <div className="text-center py-10 text-slate-400">Cargando vocabulario…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-slate-600 font-semibold">Español</th>
                      <th className="text-left px-4 py-3 text-slate-600 font-semibold">Inga</th>
                      <th className="text-left px-4 py-3 text-slate-600 font-semibold hidden md:table-cell">Categoría</th>
                      <th className="text-left px-4 py-3 text-slate-600 font-semibold hidden lg:table-cell">Módulo</th>
                      <th className="text-center px-4 py-3 text-slate-600 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {vocabFiltrados.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{v.espanol}</td>
                        <td className="px-4 py-2.5 text-emerald-700 font-semibold">{v.inga}</td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{v.categoria}</span>
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell text-slate-400 text-xs">
                          {modulos.find(m => m.id === v.modulo_id)?.titulo ?? '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setEditVocab({ ...v })}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => eliminarVocab(v.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {vocabFiltrados.length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    {busqueda || filtroMod ? 'Sin resultados.' : 'No hay vocabulario registrado.'}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">{vocabFiltrados.length} de {vocab.length} entradas</p>
        </div>
      )}

      {/* ── TAB TEXTOS ── */}
      {tab === 'textos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setEditTexto(nuevoTexto)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Nuevo texto
            </button>
          </div>
          {textosCargando ? (
            <div className="text-center py-10 text-slate-400">Cargando textos…</div>
          ) : (
            <div className="space-y-3">
              {textos.length === 0 && (
                <div className="bg-white rounded-xl shadow p-8 text-center text-slate-400">No hay textos culturales registrados.</div>
              )}
              {textos.map(t => (
                <div key={t.id} className="bg-white rounded-xl shadow border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_BADGE[t.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                          {t.tipo.replace('_', ' ')}
                        </span>
                        <h3 className="font-semibold text-slate-800 text-sm">{t.titulo}</h3>
                        {t.modulo_id && (
                          <span className="text-xs text-slate-400">{modulos.find(m => m.id === t.modulo_id)?.titulo}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-line line-clamp-4 font-mono text-xs">{t.contenido}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setEditTexto({ ...t })}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => eliminarTexto(t.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB IMPORTAR ── */}
      {tab === 'importar' && (
        <div className="bg-white rounded-xl shadow p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-800 mb-1">Importar vocabulario masivo</h3>
            <p className="text-sm text-slate-500">
              Escribe pares uno por línea. Formatos aceptados:{' '}
              <code className="bg-slate-100 px-1 rounded">español = inga</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">español | inga</code>, o tabulación.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Módulo asociado</label>
              <select value={importModId} onChange={e => setImportModId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Sin módulo específico</option>
                {modulos.map(m => <option key={m.id} value={String(m.id)}>{m.titulo}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
              <input type="text" value={importCat} onChange={e => setImportCat(e.target.value)}
                placeholder="general, saludo, animal, color…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vocabulario (uno por línea)</label>
            <textarea rows={8} value={importRaw}
              onChange={e => { setImportRaw(e.target.value); setPreview(parsear(e.target.value)); }}
              placeholder={'Buenos días = Puangi\nGracias = Pagui\nAdiós | Rinilla'}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          {preview.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">{preview.length} pares detectados:</p>
              <div className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                {preview.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-700 flex-1">{p.espanol}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-emerald-700 font-semibold flex-1">{p.inga}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={handleImportar} disabled={preview.length === 0 || importando}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              <Save className="w-4 h-4" />
              {importando ? 'Importando…' : `Importar ${preview.length} pares`}
            </button>
          </div>
        </div>
      )}

      {/* Modal vocabulario */}
      {editVocab && (
        <Modal titulo={editVocab.id ? 'Editar entrada' : 'Nueva entrada'} onClose={() => setEditVocab(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Español</label>
                <input type="text" value={editVocab.espanol ?? ''}
                  onChange={e => setEditVocab(p => ({ ...p!, espanol: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Inga</label>
                <input type="text" value={editVocab.inga ?? ''}
                  onChange={e => setEditVocab(p => ({ ...p!, inga: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                <input type="text" value={editVocab.categoria ?? 'general'}
                  onChange={e => setEditVocab(p => ({ ...p!, categoria: e.target.value }))}
                  placeholder="general, saludo, animal…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Módulo</label>
                <select value={editVocab.modulo_id ?? ''}
                  onChange={e => setEditVocab(p => ({ ...p!, modulo_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Sin módulo</option>
                  {modulos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notas (opcional)</label>
              <input type="text" value={editVocab.notas ?? ''}
                onChange={e => setEditVocab(p => ({ ...p!, notas: e.target.value || null }))}
                placeholder="Contexto, pronunciación, etc."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditVocab(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={guardarVocab} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-2">
                <Save className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal texto */}
      {editTexto && (
        <Modal titulo={editTexto.id ? 'Editar texto' : 'Nuevo texto cultural'} onClose={() => setEditTexto(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
              <input type="text" value={editTexto.titulo ?? ''}
                onChange={e => setEditTexto(p => ({ ...p!, titulo: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select value={editTexto.tipo ?? 'cancion'}
                  onChange={e => setEditTexto(p => ({ ...p!, tipo: e.target.value as BancoTextoAPI['tipo'] }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {TIPOS_TEXTO.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Módulo</label>
                <select value={editTexto.modulo_id ?? ''}
                  onChange={e => setEditTexto(p => ({ ...p!, modulo_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Sin módulo</option>
                  {modulos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contenido</label>
              <textarea rows={7} value={editTexto.contenido ?? ''}
                onChange={e => setEditTexto(p => ({ ...p!, contenido: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-xs" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditTexto(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
              <button onClick={guardarTexto} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-2">
                <Save className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL — VistaAdmin
// =====================================================
export const VistaAdmin: React.FC = () => {
  const { volverAInicio } = useNavigation();
  const [seccion, setSeccion] = useState<Seccion>('dashboard');
  const [stats, setStats] = useState<AdminStatsAPI | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    adminAPI.getStats().then(setStats).catch(() => null);
  }, []);

  const addToast = useCallback((mensaje: string, tipo: 'ok' | 'error') => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const navItems: { key: Seccion; label: string; icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
    { key: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
    { key: 'usuarios',  label: 'Usuarios',   icon: Users },
    { key: 'modulos',   label: 'Módulos',    icon: BookOpen },
    { key: 'comunidad', label: 'Comunidad',  icon: MessageSquare },
    { key: 'banco',         label: 'Banco',          icon: Database },
    { key: 'secciones',     label: 'Presentación',   icon: LayoutGrid },
    { key: 'configuracion', label: 'Configuración',  icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-800 text-white flex flex-col transform transition-transform
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <span className="text-lg font-bold">Panel Admin</span>
          </div>
          <p className="text-xs text-slate-400">Cartilla Digital Inga</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setSeccion(key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition
                ${seccion === key
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>

        {/* Volver */}
        <div className="px-3 py-4 border-t border-slate-700">
          <button
            onClick={volverAInicio}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a la cartilla
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-white shadow-sm px-4 md:px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
          >
            <LayoutDashboard className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 capitalize">
              {navItems.find(n => n.key === seccion)?.label ?? 'Admin'}
            </h1>
            <p className="text-xs text-slate-400">Resguardo Indígena Inga de Mocoa</p>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {seccion === 'dashboard'  && <SeccionDashboard stats={stats} />}
          {seccion === 'usuarios'   && <SeccionUsuarios  toast={addToast} />}
          {seccion === 'modulos'    && <SeccionModulos   toast={addToast} />}
          {seccion === 'comunidad'  && <SeccionComunidad toast={addToast} />}
          {seccion === 'banco'         && <SeccionBanco         toast={addToast} />}
          {seccion === 'secciones'     && <SeccionPresentacion  toast={addToast} />}
          {seccion === 'configuracion' && <SeccionConfiguracion toast={addToast} />}
        </main>
      </div>

      <ToastContainer toasts={toasts} remove={removeToast} />
    </div>
  );
};
