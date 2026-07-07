import React, { useState, useEffect, useRef } from "react";

export const ValePaymentsExpress = ({ saleId }: { saleId: number }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  
  // 🟢 CANDADO DE PROTECCIÓN EN SEGUNDO PLANO (Evita el colapso de red y los errores 500)
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const loadPayments = async () => {
      // 🔒 CANDADO ABSOLUTO: Si este ID ya se evaluó o hay una petición viajando en este instante, abortamos de inmediato
      if (loadedId === saleId || isFetchingRef.current) return;

      try {
        isFetchingRef.current = true; // Cerramos el candado en el acto
        
        const token = localStorage.getItem("noslight_token");
        const cleanId = String(saleId).replace("lote_", "");

        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/credits/vales/${cleanId}/payments`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setPayments(data.payments || []);
          }
        }
        
        setLoadedId(saleId);
      } catch (e) {
        console.error("Error cargando abonos", e);
        setLoadedId(saleId); 
      } finally {
        isFetchingRef.current = false; // Liberamos el candado de forma segura al terminar
      }
    };

    if (saleId) loadPayments();
  }, [saleId, loadedId]);

  if (payments.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200/80 rounded-xl p-2 mt-1.5 space-y-1">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
        💰 Adelantos parciales a este vale:
      </p>
      {payments.map((pago: any) => (
        <div key={pago.id} className="flex justify-between items-center text-[10px] text-gray-600 bg-gray-50/60 px-2 py-1 rounded border border-gray-100">
          <span>
            📅 {new Date(pago.payment_date).toLocaleDateString("es-PE")} —
            Método: <strong className="uppercase font-bold text-gray-700">{pago.payment_method}</strong>
          </span>
          <span className="font-black text-emerald-600">
            + S/ {parseFloat(pago.amount).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
};
