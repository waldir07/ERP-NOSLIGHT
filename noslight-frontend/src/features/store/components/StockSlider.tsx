import { useState, useEffect } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

// Datos falsos (Mock Data) para diseñar antes de conectar al backend
const mockCriticalStock = [
  { id: 1, name: "Batería NS40 Block Simple", currentStock: 83, speed: "3 días" },
  { id: 2, name: "Bobina de Encendido Universal", currentStock: 2, speed: "Mañana" },
  { id: 3, name: "Batería 13 Placas Premium", currentStock: 0, speed: "Agotado" },
];

export const StockSlider = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Lógica del auto-slider (cambia cada 5 segundos)
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % mockCriticalStock.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isPaused]);

  const currentItem = mockCriticalStock[currentIndex];

  return (
    <div 
      className="mb-8 bg-red-50 border border-red-100 rounded-[30px] p-6 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-center justify-between">
        
        {/* Lado izquierdo: Información y Alerta */}
        <div className="flex items-center gap-4">
          <div className="bg-red-500 p-3 rounded-full text-white animate-pulse">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black text-red-800 uppercase tracking-widest">
              Alerta de Stock Predictivo
            </h3>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {currentItem.name}: <span className="text-red-600">Quedan {currentItem.currentStock}</span>
            </p>
            <p className="text-sm text-gray-500 font-medium">
              Al ritmo de ventas actual, se agotará en: <strong className="text-gray-700">{currentItem.speed}</strong>
            </p>
          </div>
        </div>

        {/* Lado derecho: Acción rápida */}
        <button className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors">
          Solicitar ahora <ArrowRight size={18} />
        </button>

      </div>
      
      {/* Indicadores de bolitas abajo */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
        {mockCriticalStock.map((_, idx) => (
          <div 
            key={idx} 
            className={`h-1.5 w-1.5 rounded-full transition-all ${idx === currentIndex ? 'bg-red-500 w-4' : 'bg-red-200'}`} 
          />
        ))}
      </div>
    </div>
  );
};