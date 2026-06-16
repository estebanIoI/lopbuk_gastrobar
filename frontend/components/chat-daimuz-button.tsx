'use client'

// Botón "CHAT DAIMUZ" (estilo glitch de Uiverse, by namecho) que abre el Modo Chat Daimuz.
// CSS scoped a la clase .cd-glitch para NO afectar a los demás <button> de la app.
import { useRouter } from 'next/navigation'

export function ChatDaimuzButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  return (
    <div className={className}>
      <style>{`
        .cd-glitch, .cd-glitch::after {
          padding: 14px 18px;
          font-size: 16px;
          background: linear-gradient(45deg, transparent 5%, #ff013c 5%);
          border: 0;
          color: #fff;
          letter-spacing: 3px;
          line-height: 1;
          box-shadow: 6px 0px 0px #00e6f6;
          outline: transparent;
          position: relative;
          font-weight: 700;
          cursor: pointer;
        }
        .cd-glitch::after {
          --slice-0: inset(50% 50% 50% 50%);
          --slice-1: inset(80% -6px 0 0);
          --slice-2: inset(50% -6px 30% 0);
          --slice-3: inset(10% -6px 85% 0);
          --slice-4: inset(40% -6px 43% 0);
          --slice-5: inset(80% -6px 5% 0);
          content: "CHAT DAIMUZ";
          display: block;
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(45deg, transparent 3%, #00e6f6 3%, #00e6f6 5%, #ff013c 5%);
          text-shadow: -3px -3px 0px #f8f005, 3px 3px 0px #00e6f6;
          clip-path: var(--slice-0);
        }
        .cd-glitch:hover::after {
          animation: 1s cdGlitch;
          animation-timing-function: steps(2, end);
        }
        @keyframes cdGlitch {
          0%   { clip-path: var(--slice-1); transform: translate(-20px, -10px); }
          10%  { clip-path: var(--slice-3); transform: translate(10px, 10px); }
          20%  { clip-path: var(--slice-1); transform: translate(-10px, 10px); }
          30%  { clip-path: var(--slice-3); transform: translate(0px, 5px); }
          40%  { clip-path: var(--slice-2); transform: translate(-5px, 0px); }
          50%  { clip-path: var(--slice-3); transform: translate(5px, 0px); }
          60%  { clip-path: var(--slice-4); transform: translate(5px, 10px); }
          70%  { clip-path: var(--slice-2); transform: translate(-10px, 10px); }
          80%  { clip-path: var(--slice-5); transform: translate(20px, -10px); }
          90%  { clip-path: var(--slice-1); transform: translate(-10px, 0px); }
          100% { clip-path: var(--slice-1); transform: translate(0); }
        }
      `}</style>
      <button className="cd-glitch" onClick={() => router.push('/modo-chat')}>CHAT DAIMUZ</button>
    </div>
  )
}
