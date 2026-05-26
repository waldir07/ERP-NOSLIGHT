import { useState, useEffect } from "react";
import axios from "@/lib/axios";

export default function TransferHistoryPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    axios
      .get("/api/transfers")
      .then((res) => {
        setTransfers(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  
  
  return (
    
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-gray-900">
          Historial de Envíos gaaaaa
        </h1>
        <p className="text-gray-500 font-medium italic">
          Control de mercadería en tránsito
        </p>
      </div>

      

      <div className="bg-white rounded-[35px] shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Vale N°
              </th>
              <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Fecha y Hora
              </th>
              <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Estado
              </th>
              <th className="px-6 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center py-10 font-bold text-gray-400"
                >
                  Cargando datos...
                </td>
              </tr>
            ) : transfers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center py-10 font-bold text-gray-400"
                >
                  No hay envíos registrados
                </td>
              </tr>
            ) : (
              transfers.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-blue-50/20 transition-colors"
                >
                  <td className="px-6 py-5 font-black text-gray-800">
                    {t.transfer_number}
                  </td>
                  <td className="px-6 py-5 text-sm font-medium text-gray-500">
                    {new Date(t.created_at).toLocaleString("es-PE")}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span
                      className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest border ${
                        t.status === "pending"
                          ? "bg-amber-100 text-amber-600 border-amber-200"
                          : "bg-green-100 text-green-600 border-green-200"
                      }`}
                    >
                      {t.status === "pending" ? "EN TRÁNSITO" : "RECIBIDO"}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button
                      onClick={() => setSelectedTransfer(t)}
                      className="bg-gray-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black hover:bg-blue-600 transition-all"
                    >
                      DETALLE
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
