'use client'

/**
 * health-profile.tsx
 * Perfil 360° de salud del miembro. Dashboard unificado con evaluaciones,
 * fotos de progreso, lesiones, analytics y timeline.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Activity, Scale, Ruler, Droplets, Heart, TrendingUp, TrendingDown,
  Camera, Plus, Trash2, X, ChevronRight, AlertTriangle, FileText,
  Calendar, Loader2, Gauge, Zap, BedDouble, Clock,
} from 'lucide-react'
import { api } from '@/lib/api'

export function HealthProfile({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'resumen' | 'evaluaciones' | 'fotos' | 'lesiones'>('resumen')

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api.getHealthDashboard(memberId)
    if (r.success) setDashboard(r.data)
    setLoading(false)
  }, [memberId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex justify-center py-12 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  if (!dashboard) return <div className="text-center py-12 text-sm text-gray-400">Sin datos de salud</div>

  const { latestAssessment, assessments, photos, conditions, activeConditions, comparatives, analytics } = dashboard

  return (
    <div className="space-y-4">
      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <MetricCard icon={Scale} label="Peso" value={latestAssessment?.weightKg ? `${latestAssessment.weightKg} kg` : '—'} />
        <MetricCard icon={Ruler} label="IMC" value={latestAssessment?.imc ? String(latestAssessment.imc) : '—'} sub={analytics?.imcCategory} />
        <MetricCard icon={Droplets} label="% Grasa" value={latestAssessment?.bodyFatPct ? `${latestAssessment.bodyFatPct}%` : '—'} />
        <MetricCard icon={Heart} label="Músculo" value={latestAssessment?.muscleMassKg ? `${latestAssessment.muscleMassKg} kg` : '—'} />
        <MetricCard icon={Activity} label="Eval." value={String(analytics?.totalAssessments || 0)} />
      </div>

      {/* Comparativas */}
      {comparatives?.weight?.current != null && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Cambios desde última evaluación</div>
          <div className="grid grid-cols-4 gap-2">
            <ComparisonPill label="Peso" cmp={comparatives.weight} unit="kg" invert />
            <ComparisonPill label="% Grasa" cmp={comparatives.bodyFat} unit="%" invert />
            <ComparisonPill label="Músculo" cmp={comparatives.muscleMass} unit="kg" />
            <ComparisonPill label="IMC" cmp={comparatives.imc} unit="" invert />
          </div>
        </div>
      )}

      {/* Condiciones activas */}
      {activeConditions?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <div className="text-xs font-semibold text-red-700 uppercase">Restricciones activas ({activeConditions.length})</div>
          </div>
          {activeConditions.map((c: any) => (
            <div key={c.id} className="text-xs text-red-600 mt-1">
              {c.type}: {c.description?.substring(0, 60)}{c.restrictedExercises?.length ? ` · ${c.restrictedExercises.length} ejercicios restringidos` : ''}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          ['resumen', 'Resumen'], ['evaluaciones', 'Evaluaciones'],
          ['fotos', 'Fotos'], ['lesiones', 'Lesiones'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${tab === k ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500'}`}>{l}</button>
        ))}
      </div>

      {tab === 'resumen' && <HealthSummary analytics={analytics} photos={photos} />}
      {tab === 'evaluaciones' && <AssessmentList assessments={assessments} onReload={load} memberId={memberId} />}
      {tab === 'fotos' && <PhotoGrid photos={photos} onReload={load} />}
      {tab === 'lesiones' && <ConditionsList conditions={conditions} onReload={load} memberId={memberId} />}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, sub }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
      <Icon className="w-4 h-4 mx-auto text-gray-400 mb-1" />
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
      {sub && <div className="text-[10px] text-violet-500">{sub}</div>}
    </div>
  )
}

function ComparisonPill({ label, cmp, unit, invert }: any) {
  if (!cmp || cmp.current == null) return null
  const improved = invert ? (cmp.change ?? 0) < 0 : (cmp.change ?? 0) > 0
  const color = improved ? 'text-emerald-600' : cmp.change === 0 ? 'text-gray-400' : 'text-red-500'
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 text-center">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-xs font-bold">{cmp.current}{unit}</div>
      {cmp.change != null && (
        <div className={`text-[10px] font-medium ${color} flex items-center justify-center gap-0.5`}>
          {improved ? <TrendingDown className="w-3 h-3" /> : cmp.change > 0 ? <TrendingUp className="w-3 h-3" /> : '—'}
          {cmp.change > 0 ? '+' : ''}{cmp.change}{unit}
        </div>
      )}
    </div>
  )
}

function HealthSummary({ analytics, photos }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SummaryItem label="Peso perdido" value={analytics?.weightLostKg != null ? `${analytics.weightLostKg} kg` : '—'} />
        <SummaryItem label="Músculo ganado" value={analytics?.muscleGainedKg != null ? `${analytics.muscleGainedKg} kg` : '—'} />
        <SummaryItem label="Grasa perdida" value={analytics?.bodyFatLostPct != null ? `${analytics.bodyFatLostPct}%` : '—'} />
        <SummaryItem label="Días registrados" value={String(analytics?.daysTracked || 0)} />
        <SummaryItem label="IMC mejoró" value={analytics?.bmiImproved ? 'Sí' : 'No'} />
        <SummaryItem label="% Grasa mejoró" value={analytics?.bodyFatImproved ? 'Sí' : 'No'} />
      </div>
      {photos?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Fotos recientes</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.slice(0, 6).map((p: any) => (
              <div key={p.id} className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                <img src={p.thumbnailUrl || p.photoUrl} alt={p.label || ''} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryItem({ label, value }: any) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

function AssessmentList({ assessments, onReload, memberId }: any) {
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<any>(null)

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-violet-300 rounded-lg text-xs text-violet-600 hover:bg-violet-50">
        <Plus className="w-3.5 h-3.5" /> Nueva evaluación
      </button>

      {assessments?.length ? assessments.map((a: any) => (
        <button key={a.id} onClick={() => api.getHealthAssessment(a.id).then(r => r.success && setDetail(r.data))}
          className="w-full text-left bg-white border border-gray-100 rounded-xl p-3 hover:bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium">{new Date(a.assessmentDate).toLocaleDateString('es-CO')}</span>
              <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full capitalize">{a.type}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
          <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
            {a.weightKg && <span>Peso: {a.weightKg}kg</span>}
            {a.bodyFatPct && <span>Grasa: {a.bodyFatPct}%</span>}
            {a.imc && <span>IMC: {a.imc}</span>}
          </div>
        </button>
      )) : <div className="text-center py-6 text-xs text-gray-400">Sin evaluaciones</div>}

      {showForm && <AssessmentFormModal memberId={memberId} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); onReload() }} />}
      {detail && <AssessmentDetailModal assessment={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function AssessmentFormModal({ memberId, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ type: 'periodica', assessmentDate: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const body: any = {
      memberId, type: f.type, assessmentDate: f.assessmentDate,
      weightKg: f.weightKg ? Number(f.weightKg) : null,
      heightCm: f.heightCm ? Number(f.heightCm) : null,
      bodyFatPct: f.bodyFatPct ? Number(f.bodyFatPct) : null,
      muscleMassKg: f.muscleMassKg ? Number(f.muscleMassKg) : null,
      bodyWaterPct: f.bodyWaterPct ? Number(f.bodyWaterPct) : null,
      observations: f.observations || null,
    }
    const r = await api.createHealthAssessment(body)
    setSaving(false)
    if (r.success) onSaved()
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 h-14 border-b border-gray-100">
          <h3 className="font-semibold text-sm">Nueva evaluación</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo"><select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="modal-input"><option value="inicial">Inicial</option><option value="periodica">Periódica</option><option value="especial">Especial</option><option value="alta">Alta</option></select></Field>
            <Field label="Fecha"><input type="date" value={f.assessmentDate} onChange={e => setF({ ...f, assessmentDate: e.target.value })} className="modal-input" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Peso (kg)"><input type="number" value={f.weightKg || ''} onChange={e => setF({ ...f, weightKg: e.target.value })} className="modal-input" /></Field>
            <Field label="Altura (cm)"><input type="number" value={f.heightCm || ''} onChange={e => setF({ ...f, heightCm: e.target.value })} className="modal-input" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="% Grasa"><input type="number" value={f.bodyFatPct || ''} onChange={e => setF({ ...f, bodyFatPct: e.target.value })} className="modal-input" /></Field>
            <Field label="Músculo (kg)"><input type="number" value={f.muscleMassKg || ''} onChange={e => setF({ ...f, muscleMassKg: e.target.value })} className="modal-input" /></Field>
          </div>
          <Field label="% Agua"><input type="number" value={f.bodyWaterPct || ''} onChange={e => setF({ ...f, bodyWaterPct: e.target.value })} className="modal-input" /></Field>
          <Field label="Observaciones"><textarea value={f.observations || ''} onChange={e => setF({ ...f, observations: e.target.value })} className="modal-input" rows={2} /></Field>
          <button onClick={save} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium">{saving ? 'Guardando...' : 'Guardar evaluación'}</button>
        </div>
      </div>
      <style jsx global>{`.modal-input{width:100%;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.modal-input:focus{border-color:#8b5cf6}`}</style>
    </div>
  )
}

function AssessmentDetailModal({ assessment, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 h-14 border-b border-gray-100">
          <h3 className="font-semibold text-sm">{new Date(assessment.assessmentDate).toLocaleDateString('es-CO')} · <span className="capitalize">{assessment.type}</span></h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          {assessment.weightKg && <Row label="Peso" value={`${assessment.weightKg} kg`} />}
          {assessment.heightCm && <Row label="Altura" value={`${assessment.heightCm} cm`} />}
          {assessment.imc && <Row label="IMC" value={assessment.imc} />}
          {assessment.bodyFatPct != null && <Row label="% Grasa corporal" value={`${assessment.bodyFatPct}%`} />}
          {assessment.muscleMassKg != null && <Row label="Masa muscular" value={`${assessment.muscleMassKg} kg`} />}
          {assessment.bodyWaterPct != null && <Row label="Agua corporal" value={`${assessment.bodyWaterPct}%`} />}
          {assessment.visceralFat != null && <Row label="Grasa visceral" value={assessment.visceralFat} />}
          {assessment.metabolicAge && <Row label="Edad metabólica" value={assessment.metabolicAge} />}
          {assessment.restingHrBpm && <Row label="FC reposo" value={`${assessment.restingHrBpm} bpm`} />}
          {assessment.systolicBp && <Row label="Presión" value={`${assessment.systolicBp}/${assessment.diastolicBp}`} />}
          {assessment.observations && <Row label="Observaciones" value={assessment.observations} />}
          {assessment.measurements && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Circunferencias (cm)</div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {assessment.measurements.neckCm && <span>Cuello: {assessment.measurements.neckCm}</span>}
                {assessment.measurements.chestCm && <span>Pecho: {assessment.measurements.chestCm}</span>}
                {assessment.measurements.waistCm && <span>Cintura: {assessment.measurements.waistCm}</span>}
                {assessment.measurements.hipCm && <span>Cadera: {assessment.measurements.hipCm}</span>}
                {assessment.measurements.leftArmCm && <span>Brazo izq: {assessment.measurements.leftArmCm}</span>}
                {assessment.measurements.rightArmCm && <span>Brazo der: {assessment.measurements.rightArmCm}</span>}
                {assessment.measurements.leftThighCm && <span>Muslo izq: {assessment.measurements.leftThighCm}</span>}
                {assessment.measurements.rightThighCm && <span>Muslo der: {assessment.measurements.rightThighCm}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: any) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function PhotoGrid({ photos, onReload }: any) {
  const [preview, setPreview] = useState<any>(null)
  return (
    <div className="space-y-3">
      {photos?.length ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p: any) => (
            <button key={p.id} onClick={() => setPreview(p)}
              className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden group">
              <img src={p.thumbnailUrl || p.photoUrl} alt={p.label || ''} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              {p.dayLabel && <div className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1.5 py-0.5 rounded-full">{p.dayLabel}</div>}
            </button>
          ))}
        </div>
      ) : <div className="text-center py-6 text-xs text-gray-400"><Camera className="w-6 h-6 mx-auto mb-1 text-gray-300" />Sin fotos</div>}

      {preview && (
        <div className="fixed inset-0 z-[140] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview.photoUrl} alt={preview.label || ''} className="max-w-full max-h-[90vh] object-contain rounded-xl" />
          <div className="absolute bottom-4 left-4 text-white text-sm">{preview.label || preview.dayLabel || preview.takenAt}</div>
          <button className="absolute top-4 right-4 text-white" onClick={() => setPreview(null)}><X className="w-6 h-6" /></button>
        </div>
      )}
    </div>
  )
}

function ConditionsList({ conditions, onReload, memberId }: any) {
  const [showForm, setShowForm] = useState(false)

  const badgeColors: Record<string, string> = {
    activa: 'bg-red-100 text-red-700', recuperando: 'bg-amber-100 text-amber-700',
    recuperada: 'bg-emerald-100 text-emerald-700', cronica: 'bg-orange-100 text-orange-700', controlada: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-red-300 rounded-lg text-xs text-red-600 hover:bg-red-50">
        <Plus className="w-3.5 h-3.5" /> Reportar lesión / condición
      </button>

      {conditions?.length ? conditions.map((c: any) => (
        <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${badgeColors[c.status] || ''}`}>{c.status}</span>
            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full capitalize">{c.type}</span>
            <span className="text-[10px] text-gray-400 capitalize ml-auto">{c.severity}</span>
          </div>
          <div className="text-sm font-medium mt-1">{c.zone ? `${c.zone} — ` : ''}{c.description}</div>
          <div className="text-[10px] text-gray-400 mt-1">{c.dateReported ? new Date(c.dateReported).toLocaleDateString('es-CO') : ''}{c.recoveryDate ? ` · Alta: ${new Date(c.recoveryDate).toLocaleDateString('es-CO')}` : ''}</div>
        </div>
      )) : <div className="text-center py-6 text-xs text-gray-400">Sin condiciones registradas</div>}

      {showForm && <ConditionFormModal memberId={memberId} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); onReload() }} />}
    </div>
  )
}

function ConditionFormModal({ memberId, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ type: 'lesion', status: 'activa', severity: 'moderada', dateReported: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!f.description?.trim()) return
    setSaving(true)
    const r = await api.reportHealthCondition({ memberId, ...f })
    setSaving(false)
    if (r.success) onSaved()
  }
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-100">
          <h3 className="font-semibold text-sm">Reportar condición</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo"><select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="modal-input"><option value="lesion">Lesión</option><option value="enfermedad">Enfermedad</option><option value="alergia">Alergia</option><option value="condicion">Condición</option><option value="restriccion">Restricción</option><option value="cirugia">Cirugía</option></select></Field>
            <Field label="Severidad"><select value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })} className="modal-input"><option value="leve">Leve</option><option value="moderada">Moderada</option><option value="grave">Grave</option></select></Field>
          </div>
          <Field label="Zona corporal"><input value={f.zone || ''} onChange={e => setF({ ...f, zone: e.target.value })} className="modal-input" placeholder="Ej: hombro derecho" /></Field>
          <Field label="Descripción *"><textarea value={f.description || ''} onChange={e => setF({ ...f, description: e.target.value })} className="modal-input" rows={3} placeholder="Describe la lesión o condición" /></Field>
          <Field label="Fecha"><input type="date" value={f.dateReported} onChange={e => setF({ ...f, dateReported: e.target.value })} className="modal-input" /></Field>
          <button onClick={save} disabled={saving} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium">{saving ? 'Guardando...' : 'Reportar'}</button>
        </div>
      </div>
      <style jsx global>{`.modal-input{width:100%;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.modal-input:focus{border-color:#8b5cf6}`}</style>
    </div>
  )
}

function Field({ label, children }: any) {
  return <label className="block"><span className="text-[10px] text-gray-500 mb-1 block">{label}</span>{children}</label>
}
