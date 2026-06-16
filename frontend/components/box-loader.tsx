'use client'

// Loader 3D de cajas (Uiverse by Admin12121). CSS scoped bajo .dz-loader y keyframes
// prefijados (dzl-) para no colisionar con nada del resto de la app.
// NOTA: no se usa en el portafolio (ese conserva su propio preloader).

const CSS = `
.dz-loader {
  --duration: 3s;
  --primary: rgba(39, 94, 254, 1);
  --primary-light: #2f71ff;
  --primary-rgba: rgba(39, 94, 254, 0);
  width: 200px; height: 320px; position: relative; transform-style: preserve-3d;
}
.dz-loader:before, .dz-loader:after {
  --r: 20.5deg; content: ""; width: 320px; height: 140px; position: absolute; right: 32%; bottom: -11px;
  background: var(--dz-bg, #e8e8e8); transform: translateZ(200px) rotate(var(--r));
  animation: dzl-mask var(--duration) linear forwards infinite;
}
.dz-loader:after { --r: -20.5deg; right: auto; left: 32%; }
.dz-loader .ground {
  position: absolute; left: -50px; bottom: -120px; transform-style: preserve-3d;
  transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(1);
}
.dz-loader .ground div {
  transform: rotateX(90deg) rotateY(0deg) translate(-48px, -120px) translateZ(100px) scale(0);
  width: 200px; height: 200px; background: var(--primary);
  background: linear-gradient(45deg, var(--primary) 0%, var(--primary) 50%, var(--primary-light) 50%, var(--primary-light) 100%);
  transform-style: preserve-3d; animation: dzl-ground var(--duration) linear forwards infinite;
}
.dz-loader .ground div:before, .dz-loader .ground div:after {
  --rx: 90deg; --ry: 0deg; --x: 44px; --y: 162px; --z: -50px; content: ""; width: 156px; height: 300px; opacity: 0;
  background: linear-gradient(var(--primary), var(--primary-rgba)); position: absolute;
  transform: rotateX(var(--rx)) rotateY(var(--ry)) translate(var(--x), var(--y)) translateZ(var(--z));
  animation: dzl-ground-shine var(--duration) linear forwards infinite;
}
.dz-loader .ground div:after { --rx: 90deg; --ry: 90deg; --x: 0; --y: 177px; --z: 150px; }
.dz-loader .box {
  --x: 0; --y: 0; position: absolute; animation: var(--duration) linear forwards infinite;
  transform: translate(var(--x), var(--y));
}
.dz-loader .box div {
  background-color: var(--primary); width: 48px; height: 48px; position: relative; transform-style: preserve-3d;
  animation: var(--duration) ease forwards infinite; transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(0);
}
.dz-loader .box div:before, .dz-loader .box div:after {
  --rx: 90deg; --ry: 0deg; --z: 24px; --y: -24px; --x: 0; content: ""; position: absolute; background-color: inherit;
  width: inherit; height: inherit; transform: rotateX(var(--rx)) rotateY(var(--ry)) translate(var(--x), var(--y)) translateZ(var(--z));
  filter: brightness(var(--b, 1.2));
}
.dz-loader .box div:after { --rx: 0deg; --ry: 90deg; --x: 24px; --y: 0; --b: 1.4; }
.dz-loader .box.box0 { --x: -220px; --y: -120px; left: 58px; top: 108px; }
.dz-loader .box.box1 { --x: -260px; --y: 120px; left: 25px; top: 120px; }
.dz-loader .box.box2 { --x: 120px; --y: -190px; left: 58px; top: 64px; }
.dz-loader .box.box3 { --x: 280px; --y: -40px; left: 91px; top: 120px; }
.dz-loader .box.box4 { --x: 60px; --y: 200px; left: 58px; top: 132px; }
.dz-loader .box.box5 { --x: -220px; --y: -120px; left: 25px; top: 76px; }
.dz-loader .box.box6 { --x: -260px; --y: 120px; left: 91px; top: 76px; }
.dz-loader .box.box7 { --x: -240px; --y: 200px; left: 58px; top: 87px; }
.dz-loader .box0 { animation-name: dzl-box-move0; } .dz-loader .box0 div { animation-name: dzl-box-scale0; }
.dz-loader .box1 { animation-name: dzl-box-move1; } .dz-loader .box1 div { animation-name: dzl-box-scale1; }
.dz-loader .box2 { animation-name: dzl-box-move2; } .dz-loader .box2 div { animation-name: dzl-box-scale2; }
.dz-loader .box3 { animation-name: dzl-box-move3; } .dz-loader .box3 div { animation-name: dzl-box-scale3; }
.dz-loader .box4 { animation-name: dzl-box-move4; } .dz-loader .box4 div { animation-name: dzl-box-scale4; }
.dz-loader .box5 { animation-name: dzl-box-move5; } .dz-loader .box5 div { animation-name: dzl-box-scale5; }
.dz-loader .box6 { animation-name: dzl-box-move6; } .dz-loader .box6 div { animation-name: dzl-box-scale6; }
.dz-loader .box7 { animation-name: dzl-box-move7; } .dz-loader .box7 div { animation-name: dzl-box-scale7; }
@keyframes dzl-box-move0 { 12% { transform: translate(var(--x), var(--y)); } 25%, 52% { transform: translate(0, 0); } 80% { transform: translate(0, -32px); } 90%, 100% { transform: translate(0, 188px); } }
@keyframes dzl-box-scale0 { 6% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(0); } 14%, 100% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(1); } }
@keyframes dzl-box-move1 { 16% { transform: translate(var(--x), var(--y)); } 29%, 52% { transform: translate(0, 0); } 80% { transform: translate(0, -32px); } 90%, 100% { transform: translate(0, 188px); } }
@keyframes dzl-box-scale1 { 10% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(0); } 18%, 100% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(1); } }
@keyframes dzl-box-move2 { 20% { transform: translate(var(--x), var(--y)); } 33%, 52% { transform: translate(0, 0); } 80% { transform: translate(0, -32px); } 90%, 100% { transform: translate(0, 188px); } }
@keyframes dzl-box-scale2 { 14% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(0); } 22%, 100% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(1); } }
@keyframes dzl-box-move3 { 24% { transform: translate(var(--x), var(--y)); } 37%, 52% { transform: translate(0, 0); } 80% { transform: translate(0, -32px); } 90%, 100% { transform: translate(0, 188px); } }
@keyframes dzl-box-scale3 { 18% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(0); } 26%, 100% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(1); } }
@keyframes dzl-box-move4 { 28% { transform: translate(var(--x), var(--y)); } 41%, 52% { transform: translate(0, 0); } 80% { transform: translate(0, -32px); } 90%, 100% { transform: translate(0, 188px); } }
@keyframes dzl-box-scale4 { 22% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(0); } 30%, 100% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(1); } }
@keyframes dzl-box-move5 { 32% { transform: translate(var(--x), var(--y)); } 45%, 52% { transform: translate(0, 0); } 80% { transform: translate(0, -32px); } 90%, 100% { transform: translate(0, 188px); } }
@keyframes dzl-box-scale5 { 26% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(0); } 34%, 100% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(1); } }
@keyframes dzl-box-move6 { 36% { transform: translate(var(--x), var(--y)); } 49%, 52% { transform: translate(0, 0); } 80% { transform: translate(0, -32px); } 90%, 100% { transform: translate(0, 188px); } }
@keyframes dzl-box-scale6 { 30% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(0); } 38%, 100% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(1); } }
@keyframes dzl-box-move7 { 40% { transform: translate(var(--x), var(--y)); } 53%, 52% { transform: translate(0, 0); } 80% { transform: translate(0, -32px); } 90%, 100% { transform: translate(0, 188px); } }
@keyframes dzl-box-scale7 { 34% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(0); } 42%, 100% { transform: rotateY(-47deg) rotateX(-15deg) rotateZ(15deg) scale(1); } }
@keyframes dzl-ground { 0%, 65% { transform: rotateX(90deg) rotateY(0deg) translate(-48px, -120px) translateZ(100px) scale(0); } 75%, 90% { transform: rotateX(90deg) rotateY(0deg) translate(-48px, -120px) translateZ(100px) scale(1); } 100% { transform: rotateX(90deg) rotateY(0deg) translate(-48px, -120px) translateZ(100px) scale(0); } }
@keyframes dzl-ground-shine { 0%, 70% { opacity: 0; } 75%, 87% { opacity: 0.2; } 100% { opacity: 0; } }
@keyframes dzl-mask { 0%, 65% { opacity: 0; } 66%, 100% { opacity: 1; } }
`

export function BoxLoader() {
  return (
    <>
      <style>{CSS}</style>
      <div className="dz-loader">
        <div className="box box0"><div /></div>
        <div className="box box1"><div /></div>
        <div className="box box2"><div /></div>
        <div className="box box3"><div /></div>
        <div className="box box4"><div /></div>
        <div className="box box5"><div /></div>
        <div className="box box6"><div /></div>
        <div className="box box7"><div /></div>
        <div className="ground"><div /></div>
      </div>
    </>
  )
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" style={{ ['--dz-bg' as any]: 'hsl(var(--background))' }}>
      <BoxLoader />
    </div>
  )
}
