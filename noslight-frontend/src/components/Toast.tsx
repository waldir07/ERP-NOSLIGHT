// src/components/Toast.tsx
import { useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: number;
  message: string;
  type: ToastType;
  onRemove: (id: number) => void;
}

const variants: Record<ToastType, string> = {
  success: 'bg-gradient-to-r from-emerald-600 to-green-700 border-emerald-400/30',
  error:   'bg-gradient-to-r from-red-600 to-rose-700 border-red-400/30',
  info:    'bg-gradient-to-r from-blue-600 to-indigo-700 border-blue-400/30',
  warning: 'bg-gradient-to-r from-amber-600 to-orange-700 border-amber-400/30 text-white',
};

export default function Toast({ id, message, type, onRemove }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(id);
    }, 4500); // un poco más de tiempo

    return () => clearTimeout(timer);
  }, [id, onRemove]);

  return (
    <div
      className={`
        pointer-events-auto flex w-full max-w-sm transform items-center gap-3 
        rounded-xl border p-4 shadow-2xl backdrop-blur-md text-white
        transition-all duration-300 animate-in slide-in-from-right-5 fade-in
        ${variants[type]}
      `}
    >
      {/* Icono */}
      <div className="text-2xl font-bold">
        {type === 'success' && '✓'}
        {type === 'error' && '✕'}
        {type === 'info' && 'ℹ'}
        {type === 'warning' && '!'}
      </div>

      <div className="flex-1 text-sm font-medium leading-tight">
        {message}
      </div>

      <button
        onClick={() => onRemove(id)}
        className="ml-2 rounded-lg p-1.5 hover:bg-white/20 transition"
        aria-label="Cerrar"
      >
        ✕
      </button>

      {/* Barra de progreso (opcional pero queda muy pro) */}
      <div className="absolute bottom-0 left-0 h-1 w-full overflow-hidden rounded-b-xl bg-black/20">
        <div
          className="h-full w-full origin-left animate-progress bg-white/40"
        />
      </div>
    </div>
  );
}