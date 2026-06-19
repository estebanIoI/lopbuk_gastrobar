import React from 'react';
import { Calendar, CheckCircle, Flame, Target, MessageCircle, BookOpen, Star, Trophy, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CategoriaReto, DificultadReto } from '../../types';

const iconoCategoria: Record<CategoriaReto, React.ComponentType<{ className?: string }>> = {
  vocabulario: BookOpen,
  conversacion: MessageCircle,
  modulo: Target,
  comunidad: Star,
};

const colorDificultad: Record<DificultadReto, { bg: string; text: string; label: string }> = {
  facil: { bg: 'bg-green-100', text: 'text-green-700', label: 'Fácil' },
  medio: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medio' },
  dificil: { bg: 'bg-red-100', text: 'text-red-700', label: 'Difícil' },
};

export const RetosDiarios: React.FC = () => {
  const { retos } = useApp();

  const completados = retos.filter(r => r.completado).length;
  const totalPuntos = retos.reduce((sum, r) => sum + r.puntos, 0);
  const puntosGanados = retos.filter(r => r.completado).reduce((sum, r) => sum + r.puntos, 0);
  const porcentajeTotal = Math.round((completados / retos.length) * 100);

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-amber-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 md:p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
              <Flame className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold">Retos del Día</h2>
              <p className="text-amber-100 text-sm">Completa retos para ganar puntos extra</p>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="text-center">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-200" />
                <span className="text-2xl font-bold">{completados}/{retos.length}</span>
              </div>
              <p className="text-xs text-amber-200">Completados</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-200" />
                <span className="text-2xl font-bold">{puntosGanados}</span>
              </div>
              <p className="text-xs text-amber-200">de {totalPuntos} pts</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-amber-200 mb-1">
            <span>Progreso del día</span>
            <span>{porcentajeTotal}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2.5">
            <div
              className="bg-white rounded-full h-2.5 transition-all duration-500"
              style={{ width: `${porcentajeTotal}%` }}
            />
          </div>
        </div>
      </div>

      {/* Retos grid */}
      <div className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {retos.map((reto) => {
            const IconoCategoria = iconoCategoria[reto.categoria];
            const dif = colorDificultad[reto.dificultad];

            return (
              <div
                key={reto.id}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  reto.completado
                    ? 'bg-green-50 border-green-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                {/* Top row: category icon + difficulty badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-1.5 rounded-lg ${reto.completado ? 'bg-green-100' : 'bg-amber-50'}`}>
                    <IconoCategoria className={`w-4 h-4 ${reto.completado ? 'text-green-600' : 'text-amber-600'}`} />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dif.bg} ${dif.text}`}>
                    {dif.label}
                  </span>
                </div>

                {/* Title + description */}
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {reto.completado ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm leading-snug ${reto.completado ? 'text-green-800' : 'text-gray-800'}`}>
                      {reto.titulo}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{reto.descripcion}</p>
                  </div>
                </div>

                {/* Progress bar per reto */}
                {reto.meta && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">{reto.actual}/{reto.meta}</span>
                      <span className="text-gray-400">{reto.progreso}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`rounded-full h-1.5 transition-all duration-500 ${reto.completado ? 'bg-green-500' : 'bg-amber-400'}`}
                        style={{ width: `${reto.progreso}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Points */}
                <div className={`flex items-center gap-1 text-xs font-bold ${reto.completado ? 'text-green-600' : 'text-amber-600'}`}>
                  <Star className="w-3.5 h-3.5" />
                  +{reto.puntos} puntos
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
