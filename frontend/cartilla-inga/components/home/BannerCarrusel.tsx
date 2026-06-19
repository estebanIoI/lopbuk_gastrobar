import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { seccionesPublicAPI, BannerSlideAPI } from '../../services/api';

const FADE_MS = 250;

const FALLBACK_SLIDES: BannerSlideAPI[] = [
  {
    id: -1,
    titulo: 'Aprende la lengua Inga',
    subtitulo: 'Videos, actividades interactivas y la sabiduría ancestral del pueblo Inga, ahora en digital',
    imagen_url: null,
    imagen_alt: null,
    link_url: null,
    orden: 1,
  },
  {
    id: -2,
    titulo: 'Actividades interactivas',
    subtitulo: 'Completa y empareja palabras Inga para ganar puntos y avanzar más rápido',
    imagen_url: null,
    imagen_alt: null,
    link_url: null,
    orden: 2,
  },
  {
    id: -3,
    titulo: 'Comunidad Inga digital',
    subtitulo: 'Conecta con otros aprendices, comparte experiencias y crece juntos',
    imagen_url: null,
    imagen_alt: null,
    link_url: null,
    orden: 3,
  },
];

const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #005C2A 0%, #00833E 60%, #00a854 100%)',
  'linear-gradient(135deg, #003d75 0%, #0066cc 60%, #0080ff 100%)',
  'linear-gradient(135deg, #7B3500 0%, #c25500 60%, #e06600 100%)',
];

interface BannerCarruselProps {
  noRounded?: boolean;
}

export const BannerCarrusel: React.FC<BannerCarruselProps> = ({ noRounded = false }) => {
  const [slides, setSlides] = useState<BannerSlideAPI[]>([]);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const changingRef = useRef(false);

  useEffect(() => {
    seccionesPublicAPI.getBanner()
      .then(data => setSlides(data.length > 0 ? data : FALLBACK_SLIDES))
      .catch(() => setSlides(FALLBACK_SLIDES));
  }, []);

  const fadeTo = (idx: number) => {
    if (changingRef.current) return;
    changingRef.current = true;
    setVisible(false);
    setTimeout(() => {
      setCurrent(idx);
      setVisible(true);
      changingRef.current = false;
    }, FADE_MS);
  };

  const currentRef = useRef(current);
  useEffect(() => { currentRef.current = current; }, [current]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      fadeTo((currentRef.current + 1) % slides.length);
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [slides.length]);

  if (slides.length === 0) return null;

  const go = (idx: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    fadeTo(idx);
    if (slides.length > 1) {
      timerRef.current = setInterval(() => {
        fadeTo((currentRef.current + 1) % slides.length);
      }, 4000);
    }
  };

  const prev = () => go((current - 1 + slides.length) % slides.length);
  const next = () => go((current + 1) % slides.length);

  const handleClick = (slide: BannerSlideAPI) => {
    if (!slide.link_url) return;
    if (slide.link_url.startsWith('http')) {
      window.open(slide.link_url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.hash = slide.link_url;
    }
  };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    touchStartX.current = null;
  };

  const slide = slides[current];
  const isFallback = Number(slide.id) < 0;
  const fallbackIdx = isFallback ? Math.abs(Number(slide.id)) - 1 : 0;

  return (
    <div
      className={`relative w-full overflow-hidden select-none bg-black ${noRounded ? '' : 'rounded-2xl shadow-lg'}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Imagen o gradiente */}
      <div
        className="w-full transition-opacity ease-in-out"
        style={{ opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      >
        {slide.imagen_url ? (
          <img
            src={slide.imagen_url}
            alt={slide.imagen_alt || slide.titulo}
            className="w-full h-auto block"
            draggable={false}
          />
        ) : (
          <div
            className="w-full flex items-flex-end"
            style={{
              minHeight: 220,
              background: FALLBACK_GRADIENTS[fallbackIdx % FALLBACK_GRADIENTS.length],
            }}
          >
            {/* Tag institucional en la esquina */}
            <div className="absolute top-4 left-5">
              <span className="bg-[#F0A500] text-[#1A1A1A] text-[10px] font-bold px-2.5 py-1 rounded tracking-wide uppercase">
                {fallbackIdx === 0 ? 'Nuevo' : fallbackIdx === 1 ? 'Actividades' : 'Comunidad'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Overlay con texto */}
      {(slide.titulo || slide.subtitulo) && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-5 pb-5 pt-12 md:px-8 md:pb-7 transition-opacity ease-in-out"
          style={{ opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        >
          {slide.titulo && (
            <h2 className="text-white font-bold text-xl md:text-3xl drop-shadow leading-tight">
              {slide.titulo}
            </h2>
          )}
          {slide.subtitulo && (
            <p className="text-white/80 text-sm md:text-base mt-1 drop-shadow max-w-lg">
              {slide.subtitulo}
            </p>
          )}
        </div>
      )}

      {/* Botón de enlace */}
      {slide.link_url && (
        <button
          className="absolute inset-0 w-full h-full cursor-pointer focus:outline-none"
          onClick={() => handleClick(slide)}
          aria-label={`Ver más: ${slide.titulo}`}
        />
      )}

      {/* Controles */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 text-white rounded-full p-2 transition z-10"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 text-white rounded-full p-2 transition z-10"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 right-5 flex gap-1.5 z-10">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-5 h-2 bg-[#F0A500]'
                    : 'w-2 h-2 bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
