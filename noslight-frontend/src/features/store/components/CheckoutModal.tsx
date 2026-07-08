import { useState, useEffect } from "react";
import { X, Plus, Trash2, Wallet } from "lucide-react";

import Swal from "sweetalert2";


interface PaymentLine {
  id: string;
  method: "efectivo" | "yape" | "transferencia" | "vale";
  destination: string;
  amount: string;
}

interface CheckoutModalProps {
  totalAmount: number;
  items: Array<any>; // ← Productos del carrito (necesario para el ticket)
  onClose: () => void;
  onConfirm: (saleData: any) => Promise<any>;
}

export default function CheckoutModal({
  totalAmount,
  items = [],
  onClose,
  onConfirm,
}: CheckoutModalProps) {
  const [saleType, setSaleType] = useState<"contado" | "credito">("contado");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [payments, setPayments] = useState<PaymentLine[]>([
    {
      id: "1",
      method: "efectivo",
      destination: "Caja Principal",
      amount: totalAmount.toString(),
    },
  ]);

  const [valeCode, setValeCode] = useState('');
  const [isValidatingVale, setIsValidatingVale] = useState(false);

  const [yapeAccounts, setYapeAccounts] = useState<string[]>([]);
  const [bankAccounts, setBankAccounts] = useState<string[]>([]);


  const handleApplyVale = async () => {
    if (!valeCode.trim()) return;
    setIsValidatingVale(true);

    try {
      const token = localStorage.getItem("noslight_token");
      // Esta ruta la crearemos en el backend en un momento
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/store-credits/${valeCode.trim()}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (res.ok) {
        const vale = await res.json();

        // Evitar doble escaneo
        if (payments.some((p: any) => p.destination === vale.code)) {
          alert("❌ Este vale ya fue agregado.");
          return;
        }

        // Calcular cuánto falta por pagar de la venta
        const totalPagado = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
        const faltaPagar = totalAmount - totalPagado; // Asegúrate de usar tu variable de total

        // Usa el total del vale, o solo lo necesario si el vale es mayor a la deuda
        const montoAUpsar = Math.min(parseFloat(vale.amount), faltaPagar > 0 ? faltaPagar : parseFloat(vale.amount));

        // Inyectar el vale como un nuevo método de pago en tu lista
        // Inyectar el vale como un nuevo método de pago en tu lista
        setPayments([
          ...payments,
          {
            id: Date.now().toString(), // <-- Agregamos el ID requerido
            method: "vale",
            destination: vale.code,
            amount: montoAUpsar.toFixed(2)
          },
        ]);

        setValeCode("");
        alert(`✅ ¡Vale ${vale.code} aplicado por S/ ${montoAUpsar.toFixed(2)}!`);
      } else {
        alert("❌ El código es inválido, ya fue usado o no tiene fondos.");
      }
    } catch (error) {
      alert("Error al validar el código.");
    } finally {
      setIsValidatingVale(false);
    }
  };

  // Cargar clientes (con cache: "no-store" como tenías)
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const token = localStorage.getItem("noslight_token");
        const res = await fetch(
          import.meta.env.VITE_API_URL + "/api/customers/pos?t=" + new Date().getTime(),
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store", // ← Restaurado
          },
        );
        if (res.ok) {
          const data = await res.json(); // ← Restaurado tal como lo tenías
          setCustomers(data);
        }
      } catch (error) {
        console.error("Error al cargar clientes", error);
      }
    };
    fetchCustomers();
  }, []);

  // 2. CARGAR CONFIGURACIONES DE PAGOS (El nuevo)
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem("noslight_token");
        const res = await fetch(import.meta.env.VITE_API_URL + "/api/settings", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Guardamos las listas (si no hay nada, ponemos un array vacío [])
          setYapeAccounts(data.yape_accounts || []);
          setBankAccounts(data.bank_accounts || []);
        }
      } catch (error) {
        console.error("Error al cargar configuraciones de pago:", error);
      }
    };
    fetchSettings();
  }, []);

  const totalPaid = payments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0,
  );
  const remaining = totalAmount - totalPaid;
  const vuelto = totalPaid > totalAmount ? totalPaid - totalAmount : 0;

  const addPaymentLine = () => {
    const suggestedAmount = remaining > 0 ? remaining.toString() : "0";
    setPayments([
      ...payments,
      {
        id: Math.random().toString(),
        method: "yape",
        destination: yapeAccounts[0],
        amount: suggestedAmount,
      },
    ]);
  };

  const removePaymentLine = (id: string) => {
    setPayments(payments.filter((p) => p.id !== id));
  };

  const updatePayment = (
    id: string,
    field: keyof PaymentLine,
    value: string,
  ) => {
    setPayments((prev) => {
      let updated = prev.map((p) => {
        if (p.id !== id) return p;
        const newP = { ...p, [field]: value };
        if (field === "method") {
          if (value === "efectivo") newP.destination = "Caja Principal";
          if (value === "yape") newP.destination = yapeAccounts[0];
          if (value === "transferencia") newP.destination = bankAccounts[0];
        }
        return newP;
      });

      // Lógica inteligente de auto-cuadre (se mantiene)
      if (field === "amount" && updated.length === 2) {
        const editedLine = updated.find((p) => p.id === id);
        const otherLine = updated.find((p) => p.id !== id);
        if (
          editedLine &&
          otherLine &&
          editedLine.method !== "efectivo" &&
          otherLine.method === "efectivo"
        ) {
          const editedAmount = parseFloat(value) || 0;
          if (editedAmount <= totalAmount) {
            otherLine.amount = (totalAmount - editedAmount).toFixed(2);
          }
        }
      }
      return updated;
    });
  };

  const handleConfirm = async (shouldPrint: boolean = false) => {
    console.log(
      "🚀 handleConfirm iniciado - shouldPrint:",
      shouldPrint,
      "Tipo:",
      saleType,
    );

    // ================================================================
    // 1. VALIDACIONES PREVIAS (Con Swal)
    // ================================================================
    if (saleType === "credito" && !selectedCustomerId) {
      Swal.fire({ icon: 'warning', title: 'Faltan Datos', text: 'Debe seleccionar un cliente registrado para ventas a crédito.' });
      return;
    }




    // ================================================================
    // 🛡️ CANDADO DE CRÉDITO (Inyectado aquí)
    // ================================================================
    if (saleType === "credito") {
      // Buscamos los datos completos del cliente usando su ID
      // (Asumiendo que tienes el arreglo 'customers' disponible en tu componente)
      const customer = customers.find(c => c.id === selectedCustomerId);

      if (customer) {
        // 1. BLOQUEO ABSOLUTO: Si tiene el switch de crédito apagado
        if (!customer.has_credit) {
          return alert("❌ VENTA DENEGADA: Este cliente NO tiene autorización para comprar a crédito. Por favor, cobre al contado.");
        }

        // 2. ADVERTENCIA FLEXIBLE: Si supera el límite matemático
        const currentBalance = parseFloat(customer.credit_balance || 0);
        const creditLimit = parseFloat(customer.credit_limit || 0);
        const newBalance = currentBalance + totalAmount;

        if (newBalance > creditLimit) {
          const proceed = await Swal.fire({
            title: '⚠️ Advertencia de Límite',
            html: `Esta venta superará el límite de crédito del cliente.<br><br><b>Límite permitido:</b> S/ ${creditLimit.toFixed(2)}<br><b>Nuevo saldo proyectado:</b> S/ ${newBalance.toFixed(2)}<br><br>¿Deseas autorizar y guardar esta venta de todos modos?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, autorizar venta',
            cancelButtonText: 'Cancelar'
          });

          if (!proceed.isConfirmed) return; // Se cancela la venta
        }
      }
    }
    // ================================================================

    if (saleType === "contado" && remaining > 0.01) {
      Swal.fire({ icon: 'warning', title: 'Pago Incompleto', text: 'Falta cubrir el monto total de la venta.' });
      return;
    }

    // ================================================================
    // 2. LA GRAN PREGUNTA FINAL: ¿ESTÁS SEGURO?
    // ================================================================

    // Construimos el desglose visual de los pagos para la cajera
    let paymentSummaryHtml = "";
    if (saleType === "contado") {
      // Filtramos solo los pagos mayores a 0 y armamos una lista bonita
      paymentSummaryHtml = payments
        .filter((p: any) => parseFloat(p.amount) > 0)
        .map((p: any) => {
          let icon = "💵";
          if (p.method === "yape" || p.method === "plin") icon = "📱";
          if (p.method === "transferencia") icon = "🏦";

          // 🟢 NUEVO: Si no es efectivo, mostramos la cuenta destino en color azulito/morado
          const destinoHtml = p.method !== "efectivo"
            ? ` <span style="color: #4f46e5; font-size: 0.85em;">(${p.destination})</span>`
            : '';

          return `${icon} <b>${p.method.toUpperCase()}</b>${destinoHtml}: S/ ${parseFloat(p.amount).toFixed(2)}`;
        })
        .join('<br>');
    } else {
      paymentSummaryHtml = `💳 <b>A CRÉDITO</b> (Se sumará a la cuenta del cliente)`;
    }

    const confirmSale = await Swal.fire({
      title: '¿Procesar Venta?',
      html: `
      <div style="text-align: center; font-size: 1.1rem;">
        Vas a registrar una venta por <b style="color: #059669; font-size: 1.3rem;">S/ ${totalAmount.toFixed(2)}</b>.
        <br><br>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 10px; display: inline-block; text-align: left;">
          <p style="margin: 0 0 10px 0; color: #4b5563; font-size: 0.9rem; font-weight: bold; text-transform: uppercase;">MÉTODO DE COBRO RECOLECTADO:</p>
          ${paymentSummaryHtml}
        </div>
        <br><br>
        ¿Confirmas que el método de cobro es correcto?
      </div>
    `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#6B7280',
      confirmButtonText: shouldPrint ? 'Sí, cobrar e IMPRIMIR' : 'Sí, cobrar',
      cancelButtonText: 'Revisar de nuevo',
      reverseButtons: true
    });

    // Si el usuario se arrepiente y presiona "Revisar de nuevo", abortamos
    if (!confirmSale.isConfirmed) return;

    // ================================================================
    // 3. PROCESO DE VENTA (Solo si dijo que SÍ)
    // ================================================================
    setIsSubmitting(true);

    try {
      const saleData = {
        saleType,
        customer_id: selectedCustomerId || null,
        payments: saleType === "contado" ? payments : [],
        totalAmount,
        items,
      };

      const result = await onConfirm(saleData);

      if (result) {
        console.log("✅ Venta registrada correctamente");

        // 1. Imprimir el ticket de forma invisible (Contado o Crédito)
        if (shouldPrint) {
          printTicket();
        }

        // 2. CONTROL INTELIGENTE DE GAVETA
        // Validamos si hay efectivo real involucrado en la transacción
        const hasEfectivoReal = payments.some(
          (p: any) => p.method && p.method.toLowerCase() === "efectivo" && (parseFloat(p.amount) || 0) > 0
        );

        // SI ES CONTADO Y TIENE EFECTIVO, LLAMAMOS AL ASISTENTE LOCAL
        if (saleType === "contado" && hasEfectivoReal) {
          console.log("🟢 Enviando señal de apertura al asistente local...");
          fetch("http://localhost:9090/abrir-gaveta")
            .catch(err => console.error("El asistente de gaveta no está encendido", err));
        } else {
          console.log("ℹ️ No se abre gaveta (Es venta a crédito o pago electrónico)");
        }


      }
    } catch (error) {
      console.error("❌ Error en handleConfirm:", error);
      Swal.fire({ icon: 'error', title: 'Error fatal', text: 'No se pudo procesar la venta. Revisa la consola.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== TICKET ULTRA-MEJORADO (Invisible + Autocierre) ====================
  const printTicket = () => {
    console.log("📦 Estructura completa de ITEMS:", JSON.stringify(items, null, 2));

    // 1. Creamos un iframe oculto en lugar de abrir una ventana visible
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.top = "-9999px"; // Lo mandamos fuera de la pantalla visible
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const customer = customers.find(
      (c: any) => c.id.toString() === selectedCustomerId,
    );
    const customerName = customer ? customer.name : "Público General";

    // Construir dinámicamente la sección contable de pagos
    let paymentsSectionHTML = "";

    if (saleType === "credito") {
      paymentsSectionHTML = `
        <div class="bold" style="margin-top: 6px; font-size: 13px;">
          CONDICIÓN: VENTA A CRÉDITO
        </div>
      `;
    } else {
      paymentsSectionHTML = `
        <div class="bold" style="margin-top: 6px; font-size: 11px; text-transform: uppercase;">
          Forma de Pago:
        </div>
      `;

      payments.forEach((p: any) => {
        const currentAmount = parseFloat(p.amount) || 0;
        if (currentAmount > 0) {
          paymentsSectionHTML += `
            <div class="item" style="font-size: 11px; padding-left: 6px;">
              <span>• ${p.method.toUpperCase()} (${p.destination})</span>
              <span>S/ ${currentAmount.toFixed(2)}</span>
            </div>
          `;
        }
      });

      if (vuelto > 0) {
        paymentsSectionHTML += `
          <div class="item bold" style="margin-top: 4px; font-size: 12px; border-top: 1px dotted #000; padding-top: 2px;">
            <span>SU VUELTO:</span>
            <span>S/ ${vuelto.toFixed(2)}</span>
          </div>
        `;
      }
    }

    const ticketHTML = `
      <html>
      <head>
        <title>Ticket Noslight</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { 
            font-family: monospace;
            font-size: 12px; 
            width: 300px; 
            margin: 0 auto; 
            padding: 8px 10px; 
            line-height: 1.3;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          hr { border: 1px dashed #000; margin: 6px 0; }
          .item { display: flex; justify-content: space-between; margin: 3px 0; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size:15px;">NOSLIGHT STORE</div>
        <div class="center">Ticket de Venta</div>
        <div class="center">${new Date().toLocaleDateString("es-PE", { weekday: "long" })} ${new Date().toLocaleDateString("es-PE")}</div>
        <div class="center" style="font-size:11px;">${new Date().toLocaleTimeString("es-PE")}</div>
        
        <hr>
        <div>Cliente: ${customerName}</div>
        <hr>

        ${items
        .map((item: any) => {
          const qty = item.quantity || 1;
          const unitPrice = parseFloat(
            item.unit_price || item.price || item.sale_price || 0,
          );
          const subtotal = qty * unitPrice;
          return `
            <div class="item">
              <span>${qty} × ${item.product?.name || item.name || "Producto"}</span>
            </div>
            <div class="item" style="font-size:11px;">
              <span class="right">S/ ${unitPrice.toFixed(2)}</span>
              <span class="right">S/ ${subtotal.toFixed(2)}</span>
            </div>
          `;
        })
        .join("")}

        <hr>
        <div class="item bold" style="font-size:15px;">
          <span>TOTAL</span>
          <span>S/ ${totalAmount.toFixed(2)}</span>
        </div>

        ${paymentsSectionHTML}
        
        <hr>
        <div class="center" style="margin-top:12px; font-size:12px;">¡Gracias por su compra!</div>
      </body>
      </html>
    `;

    // 2. Escribimos y disparamos la impresión desde el elemento oculto
    iframeDoc.write(ticketHTML);
    iframeDoc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // 3. Eliminamos el iframe del documento después de 1 segundo para no saturar la memoria
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };



  // 🧠 FILTRO DINÁMICO DE CLIENTES:
  // Si es crédito, solo muestra a los que tienen 'has_credit'. Si es contado, los muestra todos.
  const clientesDisponibles = saleType === "credito"
    ? customers.filter(c => c.has_credit === true || c.has_credit === 1)
    : customers;

  // ... (el resto del JSX se mantiene igual al que te di antes, compacto)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="bg-gray-900 p-5 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <Wallet className="text-blue-400" size={28} />
            <div>
              <h2 className="text-xl font-black">Procesar Pago</h2>
              <p className="text-gray-400 text-sm">
                Configura cómo pagará el cliente
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={32} />
          </button>
        </div>

        {/* El resto del JSX es el mismo que te envié en el mensaje anterior (el compacto) */}
        {/* ... (puedes copiar el JSX completo de mi respuesta anterior si quieres) */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6 bg-gray-50">
          {/* Izquierda */}
          <div className="flex-1 space-y-6">
            {/* Tipo de venta */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                Tipo de Venta
              </label>
              <div className="flex bg-gray-100 p-1 rounded-2xl">
                <button
                  onClick={() => setSaleType("contado")}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm ${saleType === "contado" ? "bg-white shadow text-blue-600" : "text-gray-500"}`}
                >
                  AL CONTADO
                </button>
                <button
                  onClick={() => {
                    setSaleType("credito");

                    // 🐛 BUGFIX: El cazador de fantasmas
                    // Si el cliente actual NO tiene crédito, lo borramos de la memoria al cambiar de pestaña
                    const customer = customers.find(c => c.id.toString() === selectedCustomerId);
                    if (customer && !customer.has_credit) {
                      setSelectedCustomerId(""); // Lo regresamos a Público General internamente
                    }
                  }}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm ${saleType === "credito" ? "bg-white shadow text-orange-600" : "text-gray-500"}`}
                >
                  A CRÉDITO
                </button>
              </div>
            </div>

            {/* Cliente */}
            {/* Cliente - Siempre visible */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                Cliente
              </label>

              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full p-4 border border-gray-300 bg-white rounded-2xl font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Público General --</option>
                {clientesDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.document_number ? `(${c.document_number})` : ""}
                  </option>
                ))}
              </select>

              {/* Advertencia de límite de crédito (solo para ventas a crédito) */}
              {saleType === "credito" &&
                selectedCustomerId &&
                (() => {
                  const customer = customers.find(
                    (c) => c.id.toString() === selectedCustomerId,
                  );
                  if (!customer) return null;

                  const currentDebt = parseFloat(customer.credit_balance) || 0;
                  const limit = parseFloat(customer.credit_limit) || 0;
                  const newTotalDebt = currentDebt + totalAmount;
                  const isOverLimit = newTotalDebt > limit;

                  return (
                    <div
                      className={`mt-3 p-4 rounded-2xl border text-sm ${isOverLimit ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}
                    >
                      <div className="flex justify-between font-bold">
                        <span>Límite autorizado: S/ {limit.toFixed(2)}</span>
                        <span>Deuda actual: S/ {currentDebt.toFixed(2)}</span>
                      </div>
                      {isOverLimit && (
                        <p className="text-red-600 font-bold mt-2">
                          ⚠️ Esta venta superaría el límite de crédito del
                          cliente.
                        </p>
                      )}
                    </div>
                  );
                })()}
            </div>

            {/* Total grande */}
            <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6 text-center">
              <p className="text-blue-600 text-xs font-bold uppercase tracking-widest">
                TOTAL A PAGAR
              </p>
              <p className="text-5xl font-black text-blue-700 mt-1">
                S/ {totalAmount.toFixed(2)}
              </p>
            </div>
          </div>


          {/* LADO DERECHO: MÉTODOS DE PAGO (solo visible en contado) */}
          <div className="flex-1 flex flex-col">
            {saleType === "contado" && (
              <>
                <div className="flex justify-between items-end mb-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    Métodos de Pago
                  </label>
                  <button
                    onClick={addPaymentLine}
                    className="text-blue-600 font-bold text-sm flex items-center gap-1 hover:text-blue-800"
                  >
                    <Plus size={16} /> Dividir pago
                  </button>
                </div>

                <div className="space-y-3 flex-1">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white p-4 rounded-2xl border flex items-center gap-3"
                    >
                      {/* 🟢 CONDICIONAL: SI ES UN VALE, DIBUJAMOS UNA ETIQUETA BLOQUEADA */}
                      {p.method === "vale" ? (
                        <>
                          <div className="flex-1 flex justify-between items-center bg-purple-50 border border-purple-200 text-purple-700 px-3 py-2.5 rounded-xl">
                            <span className="font-bold text-sm">🎁 VALE A FAVOR</span>
                            <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-purple-100">{p.destination}</span>
                          </div>
                          <div className="relative w-24">
                            <span className="absolute left-3 top-3 text-gray-400">
                              S/
                            </span>
                            <input
                              type="number"
                              readOnly
                              value={p.amount}
                              className="w-full pl-8 py-3 border-b-2 text-right font-bold text-xl text-gray-400 bg-gray-50 cursor-not-allowed outline-none"
                            />
                          </div>
                        </>
                      ) : (
                        /* 🔵 SI ES UN PAGO NORMAL (Efectivo/Yape/Transferencia), DEJAMOS TU CÓDIGO ORIGINAL */
                        <>
                          <select
                            value={p.method}
                            onChange={(e) =>
                              updatePayment(p.id, "method", e.target.value)
                            }
                            className="bg-gray-50 border rounded-xl px-3 py-2 font-medium"
                          >
                            <option value="efectivo">Efectivo</option>
                            <option value="yape">Yape / Plin</option>
                            <option value="transferencia">Transferencia</option>
                          </select>

                          {p.method !== "efectivo" && (
                            <select
                              value={p.destination}
                              onChange={(e) =>
                                updatePayment(p.id, "destination", e.target.value)
                              }
                              className="flex-1 bg-gray-50 border rounded-xl px-3 py-2 font-medium"
                            >
                              {(p.method === "yape"
                                ? yapeAccounts
                                : bankAccounts
                              ).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          )}

                          {p.method === "efectivo" && (
                            <div className="flex-1 text-center text-gray-500 font-medium">
                              Caja Principal
                            </div>
                          )}

                          <div className="relative w-24">
                            <span className="absolute left-3 top-3 text-gray-400">
                              S/
                            </span>
                            <input
                              type="number"
                              value={p.amount}
                              onChange={(e) =>
                                updatePayment(p.id, "amount", e.target.value)
                              }
                              className="w-full pl-8 py-3 border-b-2 text-right font-bold text-xl"
                            />
                          </div>
                        </>
                      )}

                      {/* BOTÓN DE ELIMINAR COMÚN PARA AMBOS */}
                      {payments.length > 1 && (
                        <button
                          onClick={() => removePaymentLine(p.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* 🟢 🟢 ¡PEGA LA CAJITA DEL VALE EXACTAMENTE AQUÍ! 🟢 🟢 */}

                <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-3 flex gap-3 items-center shadow-sm">
                  <div className="bg-purple-100 p-2 rounded-lg text-purple-700 font-bold">
                    🎁
                  </div>
                  <input
                    type="text"
                    placeholder="CÓDIGO DE VALE (Ej: VALE-X7K9)"
                    value={valeCode}
                    onChange={(e) => setValeCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-white border border-purple-300 rounded-lg px-3 py-2 text-sm font-bold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase transition-all tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={handleApplyVale}
                    disabled={isValidatingVale || !valeCode.trim()}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-all shadow focus:outline-none"
                  >
                    {isValidatingVale ? "Buscando..." : "Canjear"}
                  </button>
                </div>

                {/* Vuelto / Faltante */}
                <div className="mt-6 border-t border-gray-200 pt-6">
                  {remaining > 0.01 ? (
                    <div className="bg-red-50 p-4 rounded-2xl text-red-600 font-bold flex justify-between">
                      <span>Falta cobrar</span>
                      <span>S/ {remaining.toFixed(2)}</span>
                    </div>
                  ) : vuelto > 0 ? (
                    <div className="bg-green-50 p-4 rounded-2xl text-green-600 font-bold flex justify-between">
                      <span>Dar Vuelto</span>
                      <span>S/ {vuelto.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="bg-gray-100 p-4 rounded-2xl text-gray-500 font-bold flex justify-between">
                      <span>Pago exacto</span>
                      <span>S/ {totalPaid.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {saleType === "credito" && (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-center">
                <div>
                  <p className="text-xl">📝 Venta a Crédito</p>
                  <p className="text-sm mt-2">No se cobra nada ahora</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botonera Inferior */}
        <div className="bg-white p-6 border-t border-gray-100 flex gap-4 shrink-0">
          <button
            onClick={onClose}
            className="px-8 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>

          {saleType === "contado" ? (
            <div className="flex flex-1 gap-3">
              <button
                onClick={() => handleConfirm(false)}
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-all"
              >
                {isSubmitting ? "PROCESANDO..." : "CONFIRMAR VENTA"}
              </button>

              <button
                onClick={() => handleConfirm(true)}
                disabled={isSubmitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-all"
              >
                {isSubmitting ? "PROCESANDO..." : "CONFIRMAR VENTA + IMPRIMIR"}
              </button>
            </div>
          ) : (
            <div className="flex flex-1 gap-3">
              <button
                onClick={() => handleConfirm(false)}
                disabled={isSubmitting}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-all"
              >
                {isSubmitting ? "GUARDANDO..." : "CONFIRMAR CRÉDITO"}
              </button>

              <button
                onClick={() => handleConfirm(true)}
                disabled={isSubmitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-all"
              >
                {isSubmitting ? "GUARDANDO..." : "CONFIRMAR CRÉDITO + IMPRIMIR"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
