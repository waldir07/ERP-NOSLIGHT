// src/pages/warehouse/TransferHistoryPage.tsx
import { useState, useEffect } from "react";
import axios from "@/lib/axios";

// --- ESTE ES EL MODAL ---
function TransferDetailModal({
  transfer,
  onClose,
}: {
  transfer: any;
  onClose: () => void;
}) {
  console.log("📦 DATOS QUE LLEGAN AL MODAL:", transfer);
  if (!transfer) return null;

  const handlePrint = () => {
    // 1. Abrimos ventana limpia
    const ventana = window.open("", "_blank", "width=800,height=900");
    if (!ventana) return alert("Por favor, permite las ventanas emergentes");

    // 2. Preparamos los items (limpiando el SKU y detectando envío directo)
    const itemsHtml = transfer.items
      ?.map((item: any) => {
        const isDirect = !!item.variant?.product?.is_direct_sale;
        let sku = item.variant?.sku || "S/N";
        if (isDirect && sku.startsWith("M-")) sku = sku.substring(2);

        return `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; font-family: monospace; font-size: 13px;">${sku}</td>
          <td style="padding: 12px; font-size: 13px;">
            ${item.variant?.product?.name}
            ${isDirect ? '<br><small style="color: #666; font-weight: bold;">✨ ENVÍO ESPECIAL DIRECTO</small>' : ""}
          </td>
          <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 14px;">${item.quantity}</td>
        </tr>
      `;
      })
      .join("");

    // 3. Escribimos el documento serio
    ventana.document.write(`
      <html>
        <head>
          <title>Vale de Salida - ${transfer.transfer_number}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #000; }
            .header { border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; background: #f9f9f9; padding: 10px; border-bottom: 2px solid #000; font-size: 12px; }
            .footer { margin-top: 100px; display: flex; justify-content: space-between; }
            .firma { width: 250px; border-top: 1px solid #000; text-align: center; padding-top: 10px; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">NOSLIGHT - VALE DE SALIDA</h1>
            <p style="margin: 5px 0;"><strong>N° Vale:</strong> ${transfer.transfer_number}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${new Date(transfer.created_at).toLocaleString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>DESCRIPCIÓN</th>
                <th style="text-align: right;">CANTIDAD</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="footer">
            <div class="firma">ENTREGADO POR (ALMACÉN)</div>
            <div class="firma">RECIBIDO POR (TIENDA)</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    ventana.document.close();
  };

  console.log("Datos del Vale en el Modal:", transfer.items);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* 1. CAJA PRINCIPAL: Añadimos flex, flex-col y max-h-[90vh] para limitar la altura */}
      <div className="bg-white rounded-[40px] p-8 md:p-10 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl relative">
        
        {/* BOTÓN CERRAR */}
        <button
          onClick={onClose}
          className="absolute top-6 right-8 text-gray-400 hover:text-gray-600 text-3xl font-light z-10"
        >
          &times;
        </button>

        {/* 2. CABECERA FIJA: Añadimos shrink-0 para que no se encoja nunca */}
        <div className="shrink-0 mb-6">
          <h2 className="text-2xl font-black mb-1">{transfer.transfer_number}</h2>
          <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">
            Resumen de Salida
          </p>
        </div>

        {/* 3. ZONA SCROLLEABLE (El "sánguche"): Aquí va el mensaje rojo y la lista de productos */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          
          {/* MENSAJE DE DISCREPANCIA (Solo se muestra si hay error) */}
          {transfer.status === "completed" && transfer.discrepancy_note && (
            <div className="bg-red-50 border-2 border-red-100 p-5 rounded-[28px] flex gap-4 items-start animate-in zoom-in-95 duration-300">
              <div className="bg-red-500 p-2 rounded-xl text-white shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-none mb-1">
                  Reporte de Tienda (Irregularidad)
                </p>
                <p className="text-sm font-bold text-gray-700 italic leading-tight mb-4">
                  "{transfer.discrepancy_note}"
                </p>
                
                {/* TABLA DE COMPARACIÓN */}
                <div className="overflow-hidden border border-gray-100 rounded-3xl">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Producto</th>
                        <th className="px-4 py-4 text-center text-[10px] font-black text-gray-400 uppercase">Env.</th>
                        <th className="px-4 py-4 text-center text-[10px] font-black text-gray-400 uppercase">Rec.</th>
                        <th className="px-4 py-4 text-center text-[10px] font-black text-gray-400 uppercase">Dif.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {transfer.items?.map((item: any) => {
                        const enviado = Number(item.quantity);
                        const recibido = item.received_quantity !== null ? Number(item.received_quantity) : transfer.status === "completed" ? 0 : enviado;
                        const diferencia = recibido - enviado;
                        const tieneError = diferencia !== 0;

                        return (
                          <tr key={`diff-${item.id}`} className={`${tieneError ? "bg-red-50/30" : ""} hover:bg-gray-50/50 transition-colors`}>
                            <td className="px-6 py-4">
                              <p className="text-[10px] font-black text-blue-600 uppercase">{item.variant?.sku}</p>
                              <p className="text-sm font-bold text-gray-800 leading-tight">{item.variant?.product?.name}</p>
                            </td>
                            <td className="px-4 py-4 text-center font-black text-gray-500">{enviado}</td>
                            <td className={`px-4 py-4 text-center font-black ${tieneError ? "text-red-600" : "text-green-600"}`}>
                              {transfer.status === "pending" ? "---" : recibido}
                            </td>
                            <td className="px-4 py-4 text-center">
                              {tieneError ? (
                                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-lg">
                                  {diferencia > 0 ? `+${diferencia}` : diferencia}
                                </span>
                              ) : (
                                <span className="text-gray-300">--</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LISTA DE PRODUCTOS ORIGINAL (Le quitamos el max-h porque ahora lo controla el padre) */}
          <div className="space-y-3">
            {transfer.items?.map((item: any) => {
              const isDirect = !!item.variant?.product?.is_direct_sale;
              let sku = item.variant?.sku || "S/N";
              if (isDirect && sku.startsWith("M-")) sku = sku.substring(2);

              return (
                <div key={`list-${item.id}`} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <span className="text-[10px] font-black text-blue-600 block">{sku}</span>
                    <p className="font-bold text-gray-800 text-sm">{item.variant?.product?.name}</p>
                    {isDirect && (
                      <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full mt-1 inline-block italic uppercase">
                        ✨ Envío Especial Directo
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Cant.</p>
                    <span className="text-xl font-black text-gray-900">{item.quantity}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. BOTONES DEL PIE FIJOS: Añadimos shrink-0 y un margen superior para separarlos */}
        <div className="shrink-0 mt-6 flex gap-4 pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-800 transition-colors"
          >
            Cerrar
          </button>
          <button
            className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-black transition-all"
            onClick={handlePrint}
          >
            IMPRIMIR VALE
          </button>
        </div>

      </div>
    </div>
  );
}

// --- ESTA ES LA PÁGINA PRINCIPAL QUE VA EN EL SIDEBAR ---
export default function TransferHistoryPage() {
  const [transfers, setTransfers] = useState([]);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [ampFilter, setAmpFilter] = useState("");
  const [fromDate, setFromDate] = useState(""); // Fecha Inicio
  const [toDate, setToDate] = useState(""); // Fecha Fin
  const [modelFilter, setModelFilter] = useState("");
  const [polesFilter, setPolesFilter] = useState("");

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/transfers", {
        params: {
          search: searchTerm, // Nro de Vale
          model: modelFilter,
          amperaje: ampFilter,
          polos: polesFilter,
          from: fromDate,
          to: toDate,
        },
      });
      setTransfers(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900">
            Historial de Envíos
          </h1>
          <p className="text-gray-500 font-medium">
            Control de mercadería en tránsito a tienda
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 bg-white p-6 rounded-[35px] border border-gray-100 shadow-sm items-end">
        {/* Buscador Global */}
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
            CODIGO DE ENVIO
          </label>
          <input
            type="text"
            className="w-full mt-1 p-3 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 text-sm"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Polos */}
        <div className="w-24">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
            Polos
          </label>
          <input
            type="text"
            className="w-full mt-1 p-3 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 text-sm"
            placeholder="2"
            value={polesFilter}
            onChange={(e) => setPolesFilter(e.target.value)}
          />
        </div>

        {/* Amperaje */}
        <div className="w-24">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
            Amp.
          </label>
          <input
            type="text"
            className="w-full mt-1 p-3 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 text-sm"
            placeholder="100"
            value={ampFilter}
            onChange={(e) => setAmpFilter(e.target.value)}
          />
        </div>

        {/* Modelo */}
        <div className="flex-1 min-w-[150px]">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
            Modelo
          </label>
          <input
            type="text"
            className="w-full mt-1 p-3 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 text-sm"
            placeholder="Ej: ABC-123"
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
          />
        </div>

        {/* CALENDARIO: DESDE */}
        <div className="w-40">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
            Desde
          </label>
          <input
            type="date"
            className="w-full mt-1 p-3 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 text-sm text-gray-500"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        {/* CALENDARIO: HASTA */}
        <div className="w-40">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
            Hasta
          </label>
          <input
            type="date"
            className="w-full mt-1 p-3 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 text-sm text-gray-500"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {/* BOTONES */}
        <div className="flex gap-2">
          <button
            onClick={fetchTransfers}
            className="bg-blue-600 text-white px-6 h-[48px] rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            FILTRAR
          </button>
          <button
            onClick={() => {
              setSearchTerm("");
              setAmpFilter("");
              setFromDate("");
              setToDate("");
              setTimeout(fetchTransfers, 50);
            }}
            className="bg-gray-100 text-gray-400 px-4 h-[48px] rounded-2xl hover:bg-gray-200 transition-all"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[35px] shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                Vale N°
              </th>
              <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                Fecha y Hora
              </th>
              <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                Estado
              </th>
              <th className="px-6 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
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
                  Cargando envíos...
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
              transfers.map((t: any) => {
                // Calculamos la lógica antes del return
                const isCompleted = t.status === "completed";
                const hasIssue =
                  isCompleted &&
                  t.discrepancy_note &&
                  t.discrepancy_note.trim() !== "";

                return (
                  <tr
                    key={t.id}
                    className={`transition-colors group ${hasIssue ? "bg-red-50/50" : "hover:bg-blue-50/20"}`}
                  >
                    <td className="px-6 py-5 font-black text-gray-800">
                      <div className="flex flex-col">
                        {t.transfer_number}
                        {hasIssue && (
                          <span className="text-[9px] text-red-500 font-black italic uppercase leading-none mt-1">
                            ⚠️ Discrepancia reportada
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-5 text-sm font-medium text-gray-500">
                      {new Date(t.created_at).toLocaleString("es-PE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="px-6 py-5 text-center">
                      <span
                        className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-wider border ${
                          t.status === "pending"
                            ? "bg-amber-100 text-amber-600 border-amber-200"
                            : hasIssue
                              ? "bg-red-600 text-white border-red-700 shadow-sm"
                              : "bg-green-100 text-green-600 border-green-200"
                        }`}
                      >
                        {t.status === "pending"
                          ? "EN TRÁNSITO"
                          : hasIssue
                            ? "RECIBIDO CON ERROR"
                            : "RECIBIDO OK"}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => setSelectedTransfer(t)}
                        className={`px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all transform hover:scale-105 shadow-md ${
                          hasIssue
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-gray-900 text-white hover:bg-blue-600"
                        }`}
                      >
                        DETALLE
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedTransfer && (
        <TransferDetailModal
          transfer={selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
        />
      )}
    </div>
  );
}
