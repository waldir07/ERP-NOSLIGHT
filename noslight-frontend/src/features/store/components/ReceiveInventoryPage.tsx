import { useState, useEffect } from "react";
import axios from "@/lib/axios";
import { toast } from "react-hot-toast";
import { AlertTriangle, CheckCircle2, ChevronRight, X } from "lucide-react";

// 1. COMPONENTE DEL MODAL (Pégalo arriba de todo)
function TransferDetailModal({
  transfer,
  onClose,
}: {
  transfer: any;
  onClose: () => void;
}) {
  if (!transfer) return null;

  // Calculamos totales para el mini-resumen
  const totalEnviado = transfer.items?.reduce(
    (acc: number, item: any) => acc + Number(item.quantity),
    0,
  );
  const totalRecibido = transfer.items?.reduce(
    (acc: number, item: any) => acc + Number(item.received_quantity ?? 0),
    0,
  );
  const totalFaltante = totalEnviado - totalRecibido;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-999 flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* CABECERA CON COLOR SEGÚN ESTADO */}
        <div
          className={`p-8 ${totalFaltante > 0 ? "bg-amber-500" : "bg-green-600"} text-white relative`}
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-8 text-white/80 hover:text-white text-3xl font-light"
          >
            &times;
          </button>
          <span className="text-[10px] font-black uppercase tracking-[3px] opacity-80">
            Resumen de Recepción
          </span>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">
            Vale {transfer.transfer_number}
          </h2>

          {/* MINI STATS EN CABECERA */}
          <div className="flex gap-6 mt-6">
            <div className="bg-white/20 px-4 py-2 rounded-2xl backdrop-blur-md">
              <p className="text-[9px] font-black uppercase opacity-70">
                Enviado
              </p>
              <p className="text-xl font-black">{totalEnviado}</p>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-2xl backdrop-blur-md">
              <p className="text-[9px] font-black uppercase opacity-70">
                Recibido
              </p>
              <p className="text-xl font-black">{totalRecibido}</p>
            </div>
            {totalFaltante > 0 && (
              <div className="bg-red-500/40 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/30">
                <p className="text-[9px] font-black uppercase opacity-90 text-red-100">
                  Faltante
                </p>
                <p className="text-xl font-black">-{totalFaltante}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-8">
          {/* NOTA SI EXISTE */}
          {transfer.discrepancy_note && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl">
              <p className="text-[10px] font-black text-red-600 uppercase mb-1">
                Observación del Encargado:
              </p>
              <p className="text-sm font-bold text-gray-700 italic">
                "{transfer.discrepancy_note}"
              </p>
            </div>
          )}

          {/* TABLA DE PRODUCTOS */}
          <div className="space-y-3 max-h-350px overflow-y-auto pr-2 custom-scrollbar">
            {transfer.items?.map((item: any) => {
              const env = Number(item.quantity);
              const rec = Number(item.received_quantity ?? 0);
              const diff = env - rec; // Diferencia (lo que faltó)

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-4 rounded-3xl border-2 transition-all ${diff > 0 ? "border-red-100 bg-red-50/30" : "border-gray-50 bg-gray-50/50"}`}
                >
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">
                      {item.variant?.sku}
                    </p>
                    <p className="font-black text-gray-800 text-sm leading-tight">
                      {item.variant?.product?.name}
                    </p>
                  </div>

                  <div className="flex gap-4 items-center">
                    <div className="text-center w-12">
                      <p className="text-[8px] font-black text-gray-400 uppercase">
                        Env.
                      </p>
                      <p className="text-sm font-black text-gray-400">{env}</p>
                    </div>
                    <div className="text-center w-12">
                      <p className="text-[8px] font-black text-blue-600 uppercase">
                        Rec.
                      </p>
                      <p className="text-sm font-black text-blue-700">{rec}</p>
                    </div>

                    {/* COLUMNA DE ALERTA DE FALTANTE */}
                    <div className="text-center w-16 bg-white rounded-xl py-1 shadow-sm border border-gray-100">
                      <p className="text-[8px] font-black text-gray-400 uppercase">
                        Estado
                      </p>
                      {diff === 0 ? (
                        <span className="text-green-500 text-[10px] font-black">
                          OK
                        </span>
                      ) : (
                        <span className="text-red-500 text-[10px] font-black">
                          -{diff}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <button
              onClick={onClose}
              className="w-full py-5 bg-gray-900 text-white rounded-[25px] font-black uppercase text-[11px] tracking-[3px] hover:bg-blue-600 transition-all shadow-xl active:scale-95"
            >
              Cerrar Resumen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReceiveInventoryPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingTransfer, setVerifyingTransfer] = useState<any>(null); // Vale seleccionado para revisar
  const [receivedQuantities, setReceivedQuantities] = useState<{
    [key: number]: number;
  }>({});
  const [note, setNote] = useState("");
  const [viewingDetails, setViewingDetails] = useState<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    hasIssue: "all", // all, yes, no
    amp: "",
    poles: "",
    search: "",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [ampFilter, setAmpFilter] = useState("");
  const [polesFilter, setPolesFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [issueFilter, setIssueFilter] = useState("all"); // 'all', 'yes', 'no'

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/transfers", {
        params: {
          destination: 2, // Tu tienda
          search: searchTerm,
          amperaje: ampFilter,
          polos: polesFilter,
          from: fromDate,
          to: toDate,
          has_issue: issueFilter, // Filtro para irregularidades
        },
      });
      setTransfers(res.data);
    } catch (error) {
      console.error("Error al filtrar:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  // Abrir el modal de verificación
  const startVerification = (transfer: any) => {
    setVerifyingTransfer(transfer);
    setNote("");
    // Inicializamos las cantidades recibidas con lo que dice el vale originalmente
    const initialData: any = {};
    transfer.items.forEach((item: any) => {
      initialData[item.id] = item.quantity;
    });
    setReceivedQuantities(initialData);
  };

  // 1. LA FUNCIÓN QUE DETECTA SI HAY DIFERENCIAS (Blindada)
  const hasDiscrepancy = () => {
    if (!verifyingTransfer) return false;
    return verifyingTransfer.items.some((item: any) => {
      const enviado = Number(item.quantity);
      const recibido = Number(receivedQuantities[item.id]);
      return enviado !== recibido; // Compara números puros
    });
  };

  // 2. LA FUNCIÓN DE ENVÍO COMPLETA
  const handleReceive = async () => {
    const isDiscrepant = hasDiscrepancy();

    // Validación de seguridad: si hay falta/sobra, la nota es obligatoria
    if (isDiscrepant && (!note || note.trim().length < 5)) {
      return toast.error(
        "⚠️ MOTIVO OBLIGATORIO: Indica por qué no coincide la cantidad.",
      );
    }

    try {
      setLoading(true);

      // USAMOS Object.entries para asegurar que el ID (key) y la cantidad (value)
      // mantengan su relación correcta
      const itemsPayload = Object.entries(receivedQuantities).map(
        ([itemId, qty]) => ({
          id: Number(itemId), // Este DEBE ser el ID de la tabla transfer_items (el 4 en tu ejemplo)
          received_quantity: Number(qty),
        }),
      );

      const payload = {
        discrepancy_note: isDiscrepant ? note : null,
        items: itemsPayload,
      };

      console.log("🚀 PAYLOAD REAL ENVIADO:", payload);

      const res = await axios.post(
        `/api/transfers/${verifyingTransfer.id}/receive`,
        payload,
      );

      toast.success("Ingreso procesado correctamente");
      setVerifyingTransfer(null);
      setNote("");
      fetchPending(); // Recargamos la lista
    } catch (error: any) {
      console.error("Error detallado:", error.response?.data);
      toast.error("Error al procesar el ingreso");
    } finally {
      setLoading(false);
    }
  };

  // 3. EL RENDERIZADO (RETURN) CON EL SEMÁFORO DE COLORES
  return (
    <div className="p-10 bg-[#F8FAFC] min-h-screen">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-gray-900 italic uppercase tracking-tighter">
          Gestión de Ingresos
        </h1>
        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[3px]">
          Control de inventario y recepción de carga
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-8 bg-white p-6 rounded-[35px] border border-gray-100 shadow-sm items-end">
        {/* BUSCADOR POR CÓDIGO */}
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">
            Vale N°
          </label>
          <input
            type="text"
            className="w-full mt-1 p-3 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 text-sm font-bold"
            placeholder="Ej: TR-2026..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* FILTRO TÉCNICO: AMP Y POLOS */}
        <div className="flex gap-2">
          <div className="w-20">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">
              Amp.
            </label>
            <input
              type="text"
              className="w-full mt-1 p-3 rounded-2xl bg-gray-50 ring-1 ring-gray-100 text-sm font-bold text-center"
              placeholder="100"
              value={ampFilter}
              onChange={(e) => setAmpFilter(e.target.value)}
            />
          </div>
          <div className="w-20">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">
              Polos
            </label>
            <input
              type="text"
              className="w-full mt-1 p-3 rounded-2xl bg-gray-50 ring-1 ring-gray-100 text-sm font-bold text-center"
              placeholder="3"
              value={polesFilter}
              onChange={(e) => setPolesFilter(e.target.value)}
            />
          </div>
        </div>

        {/* FECHAS */}
        <div className="flex gap-2">
          <div className="w-36">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">
              Desde
            </label>
            <input
              type="date"
              className="w-full mt-1 p-3 rounded-2xl bg-gray-50 ring-1 ring-gray-100 text-xs font-bold text-gray-500"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="w-36">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">
              Hasta
            </label>
            <input
              type="date"
              className="w-full mt-1 p-3 rounded-2xl bg-gray-50 ring-1 ring-gray-100 text-xs font-bold text-gray-500"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        {/* FILTRO DE IRREGULARIDAD */}
        <div className="w-44">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">
            Estado
          </label>
          <select
            className="w-full mt-1 p-3 rounded-2xl bg-gray-50 ring-1 ring-gray-100 text-xs font-black uppercase"
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value)}
          >
            <option value="all">TODOS LOS VALES</option>
            <option value="yes">SOLO CON IRREGULARIDAD ⚠️</option>
            <option value="no">SOLO CONFORMES ✅</option>
          </select>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="flex gap-2">
          <button
            onClick={fetchPending}
            className="bg-blue-600 text-white px-6 h-[48px] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            FILTRAR
          </button>
          <button
            onClick={() => {
              // 1. Limpiamos estados visualmente
              setSearchTerm("");
              setAmpFilter("");
              setPolesFilter("");
              setFromDate("");
              setToDate("");
              setIssueFilter("all");

              // 2. Disparamos la búsqueda enviando los parámetros vacíos manualmente
              // para no esperar al re-renderizado
              setLoading(true);
              axios
                .get("/api/transfers", {
                  params: { destination: 2 }, // Sin filtros, trae todo
                })
                .then((res) => {
                  setTransfers(res.data);
                  setLoading(false);
                });
            }}
            className="bg-gray-100 text-gray-400 px-4 h-[48px] rounded-2xl hover:bg-gray-200 transition-all font-black text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="grid gap-6">
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
            <p className="text-gray-400 font-black uppercase text-xs tracking-widest">
              Buscando en el inventario...
            </p>
          </div>
        ) : transfers.length === 0 ? (
          <div className="bg-white p-20 rounded-[40px] text-center border-2 border-dashed border-gray-100">
            <p className="text-gray-400 font-bold">
              No se encontraron transferencias con esos filtros.
            </p>
          </div>
        ) : (
          transfers.map((t) => {
            const isCompleted = t.status === "completed";
            // Si tiene nota (aunque sea un string) y está completado, es irregular
            const hasRealNote =
              isCompleted &&
              t.discrepancy_note &&
              t.discrepancy_note.trim() !== "";

            // LÓGICA DE COLORES
            let cardStyle = "bg-white border-gray-100 shadow-sm";
            let badgeClass = "bg-blue-100 text-blue-600";
            let badgeText = "Pendiente";

            if (isCompleted) {
              if (hasRealNote) {
                cardStyle =
                  "bg-red-50 border-red-200 shadow-red-100/30 scale-[0.98]";
                badgeClass = "bg-red-600 text-white italic";
                badgeText = "Ingreso con Irregularidad ⚠️";
              } else {
                cardStyle =
                  "bg-green-50 border-green-200 shadow-green-100/30 scale-[0.98]";
                badgeClass = "bg-green-500 text-white";
                badgeText = "Recibido Conforme ✅";
              }
            }

            return (
              <div
                key={t.id}
                className={`${cardStyle} p-8 rounded-[40px] border-2 flex justify-between items-center transition-all duration-500 mb-4`}
              >
                <div className="flex gap-8 items-center">
                  <div className="text-center border-r border-gray-200 pr-8">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">
                      Vale
                    </p>
                    <p className="font-black text-gray-900 text-lg">
                      {t.transfer_number}
                    </p>
                  </div>

                  <div>
                    <span
                      className={`${badgeClass} px-3 py-1 rounded-lg text-[9px] font-black uppercase mb-2 inline-block`}
                    >
                      {badgeText}
                    </span>
                    <h2 className="text-xl font-black text-gray-800 tracking-tight leading-none">
                      {isCompleted
                        ? "Ingreso Finalizado"
                        : "Mercadería en Camino"}
                    </h2>

                    {hasRealNote && (
                      <div className="mt-3 bg-white/60 p-3 rounded-2xl border border-red-100">
                        <p className="text-[10px] text-red-600 font-black uppercase italic">
                          Observación:
                        </p>
                        <p className="text-xs text-gray-700 font-bold italic italic">
                          "{t.discrepancy_note}"
                        </p>
                      </div>
                    )}

                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-2 tracking-widest">
                      {isCompleted
                        ? `Verificado: ${new Date(t.updated_at).toLocaleDateString()}`
                        : `Enviado: ${new Date(t.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>

                <div>
                  {!isCompleted ? (
                    <button
                      onClick={() => startVerification(t)}
                      className="bg-gray-900 text-white px-10 py-5 rounded-[22px] font-black text-[11px] hover:bg-blue-600 transition-all uppercase tracking-[2px]"
                    >
                      Verificar Ingreso
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedTransfer(t)} // <--- Esto "activa" el modal
                      className="bg-white border-2 border-gray-200 text-gray-400 px-6 py-4 rounded-[22px] font-black text-[11px] uppercase tracking-wider hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
                    >
                      Ver Resumen
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- MODAL DE VERIFICACIÓN --- */}
      {verifyingTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-2xl p-10 relative shadow-2xl">
            <button
              onClick={() => setVerifyingTransfer(null)}
              className="absolute top-8 right-8 text-gray-400 hover:text-black"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-black mb-1">
              Verificando {verifyingTransfer.transfer_number}
            </h2>
            <p className="text-gray-400 font-bold text-sm mb-8 uppercase">
              Asegúrate de que las cantidades coincidan
            </p>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 mb-8">
              {verifyingTransfer.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100"
                >
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">
                      {item.variant?.sku}
                    </p>
                    <p className="font-bold text-gray-800 text-sm leading-tight">
                      {item.variant?.product?.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[9px] font-black text-gray-400 uppercase">
                        Enviado
                      </p>
                      <p className="font-black text-gray-500">
                        {item.quantity}
                      </p>
                    </div>
                    <div className="w-24">
                      <p className="text-[9px] font-black text-blue-600 uppercase mb-1">
                        Recibido
                      </p>
                      <input
                        type="number"
                        className="w-full p-2 bg-white border-2 border-blue-100 rounded-xl text-center font-black text-blue-600"
                        value={receivedQuantities[item.id]}
                        onChange={(e) =>
                          setReceivedQuantities({
                            ...receivedQuantities,
                            [item.id]: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasDiscrepancy() && (
              <div className="mb-6 animate-in slide-in-from-top duration-300">
                <div className="bg-amber-50 border-2 border-amber-100 p-4 rounded-2xl mb-4 flex gap-4 items-start text-amber-700">
                  <AlertTriangle className="shrink-0 mt-1" />
                  <div>
                    <p className="font-black text-xs uppercase italic">
                      ¡Atención! Se detectó una diferencia
                    </p>
                    <p className="text-[11px] font-bold">
                      La cantidad recibida no coincide con el envío original de
                      Willy.
                    </p>
                  </div>
                </div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">
                  Motivo de la Discrepancia (Obligatorio)
                </label>
                <textarea
                  className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 text-sm font-medium focus:border-amber-400 outline-none transition-all"
                  placeholder="Ej: Llegaron cajas abiertas, faltan 2 unidades de..."
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            )}

            <button
              onClick={handleReceive}
              className={`w-full py-5 rounded-[22px] font-black text-xs uppercase tracking-[3px] transition-all flex items-center justify-center gap-3 shadow-lg ${
                hasDiscrepancy()
                  ? "bg-amber-500 text-white shadow-amber-100 hover:bg-amber-600"
                  : "bg-green-500 text-white shadow-green-100 hover:bg-green-600"
              }`}
            >
              {hasDiscrepancy()
                ? "REPORTAR E INGRESAR"
                : "TODO CORRECTO - INGRESAR"}
              <CheckCircle2 size={18} />
            </button>
          </div>
        </div>
      )}

      {selectedTransfer && (
        <TransferDetailModal
          transfer={selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
        />
      )}
    </div>
  );
}
