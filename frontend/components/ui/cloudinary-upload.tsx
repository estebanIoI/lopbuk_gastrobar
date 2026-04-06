'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { api } from '@/lib/api'

interface CloudinaryUploadProps {
  value: string
  onChange: (url: string) => void
  label?: string
  previewClassName?: string
  accept?: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Module-level cache so we don't hit the API on every upload
let _cloudinaryCache: { cloudName: string; uploadPreset: string } | null = null

async function getCloudinaryConfig(): Promise<{ cloudName: string; uploadPreset: string }> {
  // 1. Use module cache
  if (_cloudinaryCache?.cloudName && _cloudinaryCache?.uploadPreset) {
    return _cloudinaryCache
  }
  // 2. Try fetching from backend (platform_settings — set by superadmin)
  try {
    const token = api.getToken()
    const res = await fetch(`${API_URL}/chatbot/cloudinary-config`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.data?.cloudName) {
        _cloudinaryCache = {
          cloudName: json.data.cloudName,
          uploadPreset: json.data.uploadPreset,
        }
        return _cloudinaryCache
      }
    }
  } catch { /* fallback */ }
  // 3. Fallback: env vars
  return {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
    uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '',
  }
}

/** Call this after superadmin updates Cloudinary credentials to force a refresh */
export function clearCloudinaryCache() {
  _cloudinaryCache = null
}

export function CloudinaryUpload({
  value,
  onChange,
  label,
  previewClassName = 'h-20 w-20 object-cover rounded-lg border',
  accept = 'image/*',
}: CloudinaryUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const { cloudName, uploadPreset } = await getCloudinaryConfig()

    if (!cloudName) {
      setError('Cloudinary no configurado — el superadmin debe configurar las credenciales en Integraciones')
      return
    }
    if (!uploadPreset) {
      setError('Upload Preset no configurado — el superadmin debe configurarlo en Integraciones')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', uploadPreset)

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData }
      )

      if (!res.ok) {
        const data = await res.json()
        const msg = data?.error?.message ?? 'Error al subir la imagen'
        if (res.status === 400) {
          _cloudinaryCache = null // force re-fetch next time
          throw new Error(`${msg} — Verifica que el Upload Preset esté en modo "Unsigned"`)
        }
        throw new Error(msg)
      }

      const data = await res.json()
      onChange(data.secure_url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium mb-1 block">{label}</label>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex gap-2 items-center flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading ? 'Subiendo...' : 'Subir imagen'}
        </Button>

        <Input
          type="url"
          placeholder="o pega una URL"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 min-w-[180px] text-sm"
        />

        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange('')}
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {value ? (
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Vista previa"
            className={previewClassName}
            onError={e => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
      ) : (
        <div
          className="flex items-center justify-center border border-dashed rounded-lg h-16 text-muted-foreground/40 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <ImageIcon className="h-6 w-6 mr-2" />
          <span className="text-xs">Click para seleccionar imagen</span>
        </div>
      )}
    </div>
  )
}
