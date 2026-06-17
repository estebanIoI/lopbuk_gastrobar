'use client'

// Barra de bienvenida con estilo de marco animado (Uiverse by dexter-st).
// CSS scoped bajo .dz-frame y keyframes prefijados (dzf-) para NO romper el resto
// de la app (las clases originales .btn/.frame/.point/.txt son demasiado genéricas).

const CSS = `
.dz-frame {
  --color: #b5faff31;
  --txt-color: #283a3b;
  --txt-color-2: #283a3b;
  --point-size: 8px;
  --point-color: #ffffff;
  --line-color: #00000015;
  --line-weight: 1px;
  --anim-speed: 1s;
  position: relative;
  display: grid;
  place-items: center;
  min-width: 240px;
  min-height: 44px;
  padding: 0.25rem 1.5rem;
  user-select: none;
}
.dz-frame .fbtn {
  filter: drop-shadow(0 3px 2px #0000002e) drop-shadow(0 8px 4px #0000001f);
  position: absolute;
  display: flex; align-items: center; justify-content: center;
  cursor: default; border: none; background: none;
  width: 100%; height: 100%;
}
.dz-frame .txt-box {
  position: absolute; display: grid; place-items: center; text-wrap: nowrap;
  inset: 0 0%; overflow: clip;
  animation: dzf-frame-half calc(var(--anim-speed) * 0.5) forwards;
}
.dz-frame .txt-box::after {
  content: ""; position: absolute; inset: var(--point-size);
  background: repeating-linear-gradient(45deg, #3f87a6, #ebf8e1 15%, #fff 20%);
  mix-blend-mode: hard-light; background-size: 440%;
  transition: background-size 0.4s ease-in; filter: blur(1px); z-index: 3; opacity: 0.1;
}
.dz-frame .txt {
  position: absolute; padding: 0.5rem 1.5rem; z-index: 2;
  font: 600 0.9rem "Inter", system-ui, sans-serif; color: var(--txt-color);
  text-shadow: 0 -1px 1px #ffffff60, 0 2px 1px #00000015;
}
.dz-frame .txt:last-child { color: var(--txt-color-2); opacity: 0; }
.dz-frame .frame {
  position: absolute; inset: 0 0%; z-index: 1;
  border: solid var(--line-weight) var(--line-color);
  background-color: var(--color); border-radius: 6px;
  transition-delay: calc(var(--anim-speed) * 0.5);
  box-shadow: inset 0 1px 4px 1px #fff5;
  animation: dzf-frame-half calc(var(--anim-speed) * 0.5) forwards;
}
.dz-frame .point {
  position: absolute; box-sizing: border-box; width: var(--point-size); aspect-ratio: 1;
  border-radius: 25%; border: solid var(--line-weight) var(--line-color);
  background-color: var(--point-color);
  background-image: radial-gradient(circle at 50% 120%, #0005, #ffff);
}
.dz-frame .point.top { top: calc(var(--point-size) * -0.5); }
.dz-frame .point.bottom { bottom: calc(var(--point-size) * -0.5); }
.dz-frame .point.left { left: calc(var(--point-size) * -0.5); }
.dz-frame .point.right { right: calc(var(--point-size) * -0.5); }
.dz-frame .fbtn:hover .txt { animation: dzf-txt-out calc(var(--anim-speed) * 0.5) forwards; }
.dz-frame .fbtn:hover .txt:last-child { animation: dzf-txt-in calc(var(--anim-speed) * 0.5) forwards; }
.dz-frame .fbtn:hover .txt-box { animation: dzf-frame var(--anim-speed) ease; }
.dz-frame .fbtn:hover .txt-box::after { background-size: 700%; }
.dz-frame .fbtn:hover .frame { animation: dzf-frame var(--anim-speed) ease; }
@keyframes dzf-txt-in { 90% { opacity: 0; } 100% { opacity: 1; } }
@keyframes dzf-txt-out { 50% { opacity: 1; } 100% { opacity: 0; } }
@keyframes dzf-frame-half { 0% { inset: 0 50%; } 100% { inset: 0 0%; } }
@keyframes dzf-frame { 50% { inset: 0 50%; } }
`

export function DaimuzWelcomeFrame({ text1, text2 }: { text1: string; text2: string }) {
  return (
    <div className="dz-frame">
      <style>{CSS}</style>
      <div className="fbtn">
        <span className="frame">
          <span className="point top left" />
          <span className="point top right" />
          <span className="point bottom left" />
          <span className="point bottom right" />
        </span>
        <span className="txt-box">
          <span className="txt">{text1}</span>
          <span className="txt">{text2}</span>
        </span>
      </div>
    </div>
  )
}
