'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

export interface LocationValue {
  country: string
  state: string
  city: string
}

interface Props {
  value?: Partial<LocationValue>
  onChange: (value: LocationValue) => void
  /** Si false, solo muestra País + Departamento */
  showCity?: boolean
  /** Clases adicionales para el wrapper */
  className?: string
}

export function LocationPicker({ value = {}, onChange, showCity = true, className = '' }: Props) {
  const [countries, setCountries] = useState<{ name: string; iso2: string }[]>([])
  const [states, setStates] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])

  const [loadingCountries, setLoadingCountries] = useState(false)
  const [loadingStates, setLoadingStates] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)

  const country = value.country || ''
  const state = value.state || ''
  const city = value.city || ''

  // Cargar países al montar
  useEffect(() => {
    setLoadingCountries(true)
    api.getCountries()
      .then(r => { if (r.success && r.data) setCountries(r.data) })
      .finally(() => setLoadingCountries(false))
  }, [])

  // Cargar departamentos cuando cambia el país
  useEffect(() => {
    if (!country) { setStates([]); setCities([]); return }
    setLoadingStates(true)
    setStates([])
    setCities([])
    api.getStates(country)
      .then(r => { if (r.success && r.data) setStates(r.data) })
      .finally(() => setLoadingStates(false))
  }, [country])

  // Cargar ciudades cuando cambia el departamento
  useEffect(() => {
    if (!country || !state || !showCity) { setCities([]); return }
    setLoadingCities(true)
    setCities([])
    api.getCities(country, state)
      .then(r => { if (r.success && r.data) setCities(r.data) })
      .finally(() => setLoadingCities(false))
  }, [country, state, showCity])

  const handleCountry = (val: string) => {
    onChange({ country: val, state: '', city: '' })
  }
  const handleState = (val: string) => {
    onChange({ country, state: val, city: '' })
  }
  const handleCity = (val: string) => {
    onChange({ country, state, city: val })
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-${showCity ? '3' : '2'} gap-3 ${className}`}>
      {/* País */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          País de Origen
          {loadingCountries && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </Label>
        <Select value={country || '__none__'} onValueChange={v => handleCountry(v === '__none__' ? '' : v)} disabled={loadingCountries}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Seleccionar país" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__none__">— Sin especificar —</SelectItem>
            {countries.map(c => (
              <SelectItem key={c.iso2} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Departamento / Estado */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          Departamento
          {loadingStates && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </Label>
        <Select
          value={state || '__none__'}
          onValueChange={v => handleState(v === '__none__' ? '' : v)}
          disabled={!country || loadingStates}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={country ? 'Seleccionar' : 'Primero elige país'} />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__none__">— Sin especificar —</SelectItem>
            {states.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Municipio / Ciudad */}
      {showCity && (
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            Municipio
            {loadingCities && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </Label>
          <Select
            value={city || '__none__'}
            onValueChange={v => handleCity(v === '__none__' ? '' : v)}
            disabled={!state || loadingCities}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={state ? 'Seleccionar' : 'Primero elige depto.'} />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="__none__">— Sin especificar —</SelectItem>
              {cities.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
