'use client'

// Subida de medios (imagen/gif/video) a Cloudinary con validación de tipo y
// tamaño + preview correcto (img o video). Reusa la config de CloudinaryUpload.
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, X, Loader2, Image as ImageIcon, Film } from 'lucide-react'
import { getCloudinaryConfig } from '@/components/ui/cloudinary-upload'

type Kind = 'image' | 'video'

interface MediaUploadProps {
  value: string
  onChange: (url: string) => void
  label?: string
  kind?: Kind          // 'image' incluye gif; 'video' para mp4/webm
  maxMB?: number       // límite de tamaño en MB
  hint?: string
}

const isVideoUrl = (u: string) =>
  /\.(mp4|webm|mov|ogg)(\?|#|$)/i.test(u) || /\/video\/upload\//.test(u)

export function MediaUpload({ value, onChange, label, kind = 'image', maxMB, hint }: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limitMB = maxMB ?? (kind === 'video' ? 12 : 4)
  const accept = kind === 'video' ? 'video/mp4,video/webm,video/ogg' : 'image/*'

  const reset = () => { if (inputRef.current) inputRef.current.value = '' }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const okType = kind === 'video' ? file.type.startsWith('video/') : file.type.startsWith('image/')
    if (!okType) { setError(`Selecciona un archivo de ${kind === 'video' ? 'video' : 'imagen'}.`); reset(); return }

    const mb = file.size / (1024 * 1024)
    if (mb > limitMB) { setError(`Máximo ${limitMB} MB (este pesa ${mb.toFixed(1)} MB).`); reset(); return }

    const { cloudName, uploadPreset } = await getCloudinaryConfig()
    if (!cloudName || !uploadPreset) {
      setError('Cloudinary no configurado — configúralo en Integraciones.'); return
    }

    setError(null); setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', uploadPreset)
      // /auto/ permite imagen y video con un mismo endpoint.
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.error?.message ?? 'Error al subir'
        throw new Error(res.status === 400 ? `${msg} — el Upload Preset debe ser "Unsigned" y permitir ${kind}.` : msg)
      }
      onChange(data.secure_url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploading(false); reset()
    }
  }

  const showVideo = kind === 'video' || isVideoUrl(value)

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium mb-1 block">{label}</label>}

      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />

      <div className="flex gap-2 items-center flex-wrap">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : (kind === 'video' ? <Film className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />)}
          {uploading ? 'Subiendo…' : (kind === 'video' ? 'Subir video' : 'Subir imagen')}
        </Button>
        <Input type="url" placeholder="o pega una URL" value={value} onChange={e => onChange(e.target.value)} className="flex-1 min-w-[180px] text-sm" />
        {value && (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange('')}>
            <X className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">{hint || `Máximo ${limitMB} MB · ${kind === 'video' ? 'mp4 / webm' : 'jpg, png, webp, gif'}`}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {value ? (
        <div className="mt-1">
          {showVideo ? (
            <video src={value} muted controls playsInline className="h-24 rounded-lg border" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Vista previa" className="h-20 w-20 object-cover rounded-lg border" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center border border-dashed rounded-lg h-16 text-muted-foreground/40 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => inputRef.current?.click()}>
          {kind === 'video' ? <Film className="h-6 w-6 mr-2" /> : <ImageIcon className="h-6 w-6 mr-2" />}
          <span className="text-xs">Click para seleccionar {kind === 'video' ? 'video' : 'imagen'}</span>
        </div>
      )}
    </div>
  )
}
