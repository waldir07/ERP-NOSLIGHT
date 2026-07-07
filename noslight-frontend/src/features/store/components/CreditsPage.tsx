import { useState, useEffect } from "react";
import {
  Search,
  Clock,
  Users,
  ChevronDown,
  FileText,
  CheckCircle,
  X,
  DollarSign,
  History,
  Banknote,
} from "lucide-react";

import { jsPDF } from "jspdf";




import { ValePaymentsExpress } from "./ValePaymentsExpress";



export default function CreditsPage() {

  const [searchTerm, setSearchTerm] = useState("");

  // Datos del Tab 1: Pendientes
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

  // Datos del Tab 2: Cuentas
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  // Estados para el Modal de Fijar Precios
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null); // Ahora manejamos un grupo por día
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para el Modal de Cobranzas
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // 1. EL CANDADO DEFINITIVO (Leyendo el JSON de noslight_user)
  const userStr = localStorage.getItem("noslight_user");
  const userObj = userStr ? JSON.parse(userStr) : null;
  // 1.1 BLINDAJE DE ROL (Busca en memoria, y si no está, jala del almacenamiento persistente)
  const storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");

  // 2. ESTADO INICIAL
  // 🟢 CORRECCIÓN DE TIPADO: Agregamos "abono" como una pestaña oficial y permitida
  const [activeTab, setActiveTab] = useState<"pendientes" | "cuentas" | "abono">("cuentas");

  // Estado caché para saber qué tarjeta del historial está expandida visualmente
  const [expandedLoteId, setExpandedLoteId] = useState<string | null>(null);



  // Le agregamos "cobranza" a la lista de permitidos
  const [accountTab, setAccountTab] = useState<
    "abono" | "historial" | "cobranza"
  >("abono");

  // Estado para controlar qué días están desplegados en el historial
  const [expandedDays, setExpandedDays] = useState<string[]>([]);

  // Estados para el Filtro del Historial
  // Estados para el Filtro del Historial (Calendario)
  const getFirstDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1)
      .toISOString()
      .split("T")[0];
  };
  const getToday = () => new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getToday());
  // Estados para el Filtro Rápido (Todos, Solo Deudas, Solo Pagos)
  const [movementFilter, setMovementFilter] = useState<
    "all" | "sales" | "payments"
  >("all");

  // Botón "Limpiar Todos los Filtros" (Reinicia fechas y botones)
  const clearAllFilters = () => {
    const start = getFirstDayOfMonth();
    const end = getToday();
    setStartDate(start);
    setEndDate(end);
    setMovementFilter("all");
    openAccountStatement(selectedAccount, start, end); // Vuelve a pedir el mes actual
  };


  const [isLoadingStatement, setIsLoadingStatement] = useState(false);

  const [selectedSaleIds, setSelectedSaleIds] = useState<number[]>([]);
  const [totalToPay, setTotalToPay] = useState<number>(0);

  // 🟢 ESTADOS DE CONTROL PARA LA COBRANZA QUIRÚRGICA POR DOCUMENTO
  const [selectedGroupCodes, setSelectedGroupCodes] = useState<string[]>([]);
  const [activeDetailCode, setActiveDetailCode] = useState<string | null>(null);


  const toggleDay = (date: string) => {
    setExpandedDays((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date],
    );
  };





  // NUEVO: Estados para pagos múltiples
  // Estado para pagos múltiples + vuelto
  const [payments, setPayments] = useState<
    Array<{
      id: string;
      method: "efectivo" | "yape" | "transferencia";
      amount: string;
      yape_account?: string;
      bank_account?: string;
    }>
  >([{ id: "1", method: "efectivo", amount: "" }]);
  // 1. Cargar Pendientes (El Limbo)
  const fetchPendingSales = async () => {
    setIsLoadingPending(true);
    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(import.meta.env.VITE_API_URL + "/api/credits/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPendingSales(await res.json());
    } catch (error) {
      console.error("Error al cargar pendientes", error);
    } finally {
      setIsLoadingPending(false);
    }
  };

  // 2. Cargar Cuentas con Deuda (El Directorio)
  const fetchAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(import.meta.env.VITE_API_URL + "/api/credits/accounts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        // 🟢 EXTRAEMOS EL CONTENIDO REAL EN UNA VARIABLE LIMPIA
        const data = await res.json();
        setAccounts(data);

        // Imprimimos la data general de cuentas para auditar las propiedades
        console.log("MIRA AQUÍ LAS CUENTAS CARGADAS:", data);
      }
    } catch (error) {
      console.error("Error al cargar cuentas", error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };


  // 🟢 CLONADO IDÉNTICO DE ESTADOS DE LA PASARELA DE VENTAS
  const [yapeAccounts, setYapeAccounts] = useState<string[]>([]);
  const [bankAccounts, setBankAccounts] = useState<string[]>([]);


  const [activeValePayments, setActiveValePayments] = useState<any[]>([]);




  // 🟢 EFECTO DE CARGA OFICIAL DESDE /API/SETTINGS
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem("noslight_token");
        const res = await fetch(import.meta.env.VITE_API_URL + "/api/settings", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Sincronizamos las listas vivas que tu jefa configuró en el administrador
          setYapeAccounts(data.yape_accounts || []);
          setBankAccounts(data.bank_accounts || []);
        }
      } catch (error) {
        console.error("Error al cargar configuraciones de pago en créditos:", error);
      }
    };
    fetchSettings();
  }, []);



  // 🟢 COMPORTAMIENTO CONFIGURADO CORRECTAMENTE (SIN BUCLES INFINITOS)
  useEffect(() => {
    // Eliminamos el freno de !isAdmin para que cargue con cualquier rol
    if (activeTab === "pendientes") {
      fetchPendingSales();
    } else if (activeTab === "cuentas") {
      fetchAccounts();
    }
  }, [activeTab]); // Quitamos isAdmin de las dependencias ya que no limita la carga

  // Modal de Aprobación
  // Abre el modal cargando todos los productos del día
  const openApprovalModal = (group: any) => {
    setSelectedGroup(group);

    // Extraemos todos los productos de todos los días y los ponemos en una sola lista para editarlos
    const allItems = group.days.flatMap((dayGroup: any) =>
      dayGroup.items.map((item: any) => ({
        id: item.id,
        name: item.product_variant?.product?.name || "Producto general",
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        time: item.time,
        receipt_number: item.receipt_number,
        date: dayGroup.date, // Guardamos la fecha para agrupar visualmente
      })),
    );

    setEditableItems(allItems);
  };

  const updateItemPrice = (id: number, newPrice: string) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, unit_price: parseFloat(newPrice) || 0 }
          : item,
      ),
    );
  };

  // Funciones para manejar las líneas de pago
  const updatePayment = (id: string, field: string, value: string) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  const addPaymentLine = () => {
    setPayments([
      ...payments,
      { id: Date.now().toString(), method: "yape", amount: "" },
    ]);
  };

  const removePaymentLine = (id: string) => {
    setPayments(payments.filter((p) => p.id !== id));
  };

  // Manda a aprobar todos los vales del día juntos
  const handleApproveGroup = async () => {
    if (!selectedGroup) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/credits/approve-group`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sale_ids: selectedGroup.sale_ids,
            items: editableItems,
          }),
        },
      );

      if (res.ok) {
        alert("¡Día valorizado y sumado a la cuenta del cliente!");
        setSelectedGroup(null);
        fetchPendingSales(); // Refresca pendientes
        fetchAccounts(); // Refresca el directorio por si acaso
      } else {
        alert("Error al aprobar el día.");
      }
    } catch (error) {
      alert("Error de conexión.");
    } finally {
      setIsSaving(false);
    }
  };

  // Función actualizada para registrar el abono por lotes, abrir gaveta e imprimir opcionalmente
  const handleAddPayment = async (action: "print" | "no-print" = "print") => {
    const totalPaid = payments.reduce(
      (sum, p) => sum + (parseFloat(p.amount) || 0),
      0,
    );

    if (totalPaid <= 0) return alert("Ingresa al menos un monto válido.");

    // 🟢 1. EXTRACCIÓN QUIRÚRGICA: Sacamos los IDs reales de los vales de los lotes marcados arriba
    const finalSaleIds: number[] = [];
    let aggregatedPendingDebt = 0;

    selectedAccount?.sales?.forEach((sale: any) => {
      const code = sale.notes && sale.notes.startsWith('LOTE-VALORIZADO-') ? sale.notes : `DIRECTO-${sale.id}`;
      // Si el operario tiene marcado este lote, acumulamos su saldo y guardamos sus IDs
      if (selectedGroupCodes.includes(code)) {
        finalSaleIds.push(sale.id);
        // Evitamos sumar si el backend ya lo marca como pagado
        if (sale.status !== 'paid') {
          aggregatedPendingDebt += parseFloat(sale.pending_balance);
        }
      }
    });

    if (finalSaleIds.length === 0) {
      return alert("Por favor, selecciona al menos un lote de cobro del carrusel superior.");
    }

    // 🟢 2. VALIDACIÓN FLEXIBLE: Validamos contra los papeles marcados, no contra la cuenta ciega macro
    if (totalPaid > aggregatedPendingDebt) {
      return alert(
        "El abono de S/ " + totalPaid.toFixed(2) + " supera el saldo pendiente de los lotes seleccionados (S/ " +
        aggregatedPendingDebt.toFixed(2) + ")."
      );
    }

    const validPayments = payments
      .filter((p) => (parseFloat(p.amount) || 0) > 0)
      .map((p) => ({
        amount: parseFloat(p.amount),
        method: p.method,
        yape_account: p.yape_account || null,
        bank_account: p.bank_account || null,
      }));

    // DETECTAMOS SI HAY EFECTIVO EN ALGUNA DE LAS LÍNEAS DE PAGO
    const hasEfectivo = validPayments.some((p) => p.method === "efectivo");

    setIsProcessingPayment(true);

    try {
      const token = localStorage.getItem("noslight_token");

      // 📦 3. CONSTRUCCIÓN DEL PAQUETE UNIFICADO PARA TU ENDPOINT
      const payload = {
        sale_ids: finalSaleIds, // Envia los vales que componen las tarjetas marcadas en el slider
        payments: validPayments
      };

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/credits/customers/${selectedAccount.id}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          // 🔥 AQUÍ CONECTAMOS EL PAYLOAD COMPLETO QUE LA API EXIGE
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        // 1. SI HAY EFECTIVO (Total o mixto), ABRIMOS LA GAVETA
        if (hasEfectivo) {
          console.log("🟢 Abono con efectivo detectado. Abriendo gaveta...");
          fetch("http://localhost:9090/abrir-gaveta").catch((err) =>
            console.error("El asistente de gaveta no está encendido", err),
          );
        } else {
          console.log("ℹ️ Abono 100% digital. No se abre gaveta.");
        }

        // 2. IMPRIMIR EL VOUCHER SI SE SOLICITÓ
        if (action === "print") {
          printAbonoTicket(validPayments, totalPaid);
        }

        alert("¡Abono registrado con éxito en los lotes seleccionados!");

        // Limpiar todo, reiniciar estados del carrusel y cerrar modal lateral
        setSelectedGroupCodes([]);
        setActiveDetailCode(null);
        setSelectedAccount(null);
        setPayments([{ id: "1", method: "efectivo", amount: "" }]);
        fetchAccounts();
      } else {
        const errData = await res.json();
        alert("Error al registrar: " + (errData.message || "Verifica los datos"));
      }
    } catch (error) {
      alert("Error de conexión.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Función que filtra los movimientos según el filtro activo
  const getFilteredHistory = () => {
    if (!selectedAccount?.history) return [];

    return selectedAccount.history
      .map((dayGroup: any) => {
        const filteredMovements = dayGroup.movements.filter((mov: any) => {
          if (movementFilter === "sales") return !mov.is_payment; // Solo deudas
          if (movementFilter === "payments") return mov.is_payment; // Solo pagos
          return true; // Todos
        });

        return {
          ...dayGroup,
          movements: filteredMovements,
          // Recalcular totales del día según filtro
          daily_sales: filteredMovements
            .filter((m: any) => !m.is_payment)
            .reduce(
              (sum: number, m: any) => sum + parseFloat(m.amount || 0),
              0,
            ),
          daily_payments: filteredMovements
            .filter((m: any) => m.is_payment)
            .reduce(
              (sum: number, m: any) => sum + parseFloat(m.amount || 0),
              0,
            ),
        };
      })
      .filter((dayGroup: any) => dayGroup.movements.length > 0); // Ocultar días sin movimientos después del filtro
  };

  // NUEVA FUNCIÓN: Va a Laravel, trae el historial fusionado y abre el modal
  // NUEVA FUNCIÓN: Carga historial + aplica filtro inmediatamente
  const openAccountStatement = async (
    account: any,
    start = startDate,
    end = endDate,
  ) => {

    // 🔒 CANDADO DE RED: Si el modal ya está abierto gestionando a este mismo cliente 
    // y el historial ya tiene datos cargados, bloqueamos las peticiones repetitivas de red
    if (selectedAccount?.id === account.id && selectedAccount?.history?.length > 0 && start === startDate && end === endDate) {
      return;
    }

    setSelectedAccount(account);
    if (!selectedAccount || selectedAccount.id !== account.id) {
      setAccountTab("abono");
    }

    setIsLoadingStatement(true);
    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/credits/customers/${account.id}/statement?start_date=${start}&end_date=${end}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const fullData = await res.json();

        // 🟢 CANDADO ANTI-CRUCE DE CLIENTES (Solución al Bug 3):
        // Si el servidor responde una petición rezagada de un cliente diferente al que el usuario
        // tiene actualmente seleccionado en su pantalla, abortamos la actualización para evitar saltos locos.
        if (fullData.customer?.id !== account.id) {
          console.warn(" Petición rezagada detectada y bloqueada de forma segura.");
          return;
        }

        setSelectedAccount((prev: any) => ({
          ...prev,
          // 🟢 Hidratamos el objeto completo que viene del servidor incluyendo sus ventas reales
          ...(fullData.customer || {}),
          paid_lotes: fullData.paid_lotes || [],
          metrics: fullData.metrics || null,
          history: fullData.history || [],
          credit_balance: fullData.current_balance !== undefined ? fullData.current_balance : prev?.credit_balance,
          // 🔥 Aseguramos que jale las ventas unificadas para el carrusel superior
          sales: fullData.customer?.sales || prev?.sales || []
        }));
      }
    } catch (error) {
      console.error("Error al cargar el historial detallado", error);
    } finally {
      setIsLoadingStatement(false);
    }
  };

  // 1. FUNCIÓN PARA EL TICKET TÉRMICO (Usando tu diseño monospace e iframe)
  const handlePrintProforma = () => {
    if (!selectedAccount) return;

    // 1. Creamos el iframe oculto como en tu checkout
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.top = "-9999px";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const allMovements = selectedAccount.history
      ? selectedAccount.history.flatMap((day: any) =>
        day.movements.map((mov: any) => ({ ...mov, date: day.date }))
      )
      : [];

    let itemsHtml = "";
    if (allMovements.length === 0) {
      itemsHtml = `<div class="center" style="font-style: italic;">Sin movimientos registrados</div>`;
    } else {
      allMovements.forEach((mov: any) => {
        // Fecha corta (Ej: 21/05) para ahorrar espacio en la línea
        const formattedDate = new Date(mov.date + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });

        if (mov.is_payment) {
          itemsHtml += `
            <div class="item">
              <span>${formattedDate} PAGO ${mov.method ? mov.method.substring(0, 4).toUpperCase() : 'EFEC'}</span>
              <span>-S/ ${parseFloat(mov.amount).toFixed(2)}</span>
            </div>`;
        } else {
          itemsHtml += `
            <div class="item">
              <span>${formattedDate} ${mov.description}</span>
              <span>S/ ${parseFloat(mov.amount).toFixed(2)}</span>
            </div>`;
        }
      });
    }

    // Usamos EXACTAMENTE tus estilos del checkout
    const ticketHTML = `
      <html>
      <head>
        <title>Proforma Noslight</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 8px 10px; line-height: 1.3; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          hr { border: 1px dashed #000; margin: 6px 0; }
          .item { display: flex; justify-content: space-between; margin: 3px 0; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size:15px;">MI ERP - SISTEMA</div>
        <div class="center">*** PROFORMA DE COBRO ***</div>
        <div class="center">${new Date().toLocaleDateString("es-PE", { weekday: "long" })} ${new Date().toLocaleDateString("es-PE")}</div>
        <div class="center" style="font-size:11px;">${new Date().toLocaleTimeString("es-PE")}</div>
        
        <hr>
        <div>Cliente: ${selectedAccount.name}</div>
        
        <hr>
        <div class="bold" style="margin-bottom: 4px;">MOVIMIENTOS:</div>
        ${itemsHtml}
        
        <hr>
        <div class="item bold" style="font-size:15px;">
          <span>TOTAL DEUDA</span>
          <span>S/ ${parseFloat(selectedAccount.credit_balance).toFixed(2)}</span>
        </div>
        
        <hr>
        <div class="center" style="margin-top:12px; font-size:12px;">Favor de cancelar a la brevedad.</div>
      </body>
      </html>
    `;

    // 2. Disparamos la impresión
    iframeDoc.write(ticketHTML);
    iframeDoc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // 3. Limpiamos la memoria
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  // FUNCIÓN PARA IMPRIMIR EL VOUCHER DE ABONO (TICKET TÉRMICO)
  const printAbonoTicket = (paymentsList: any[], totalPaid: number) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.top = "-9999px";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    let methodsHtml = "";
    paymentsList.forEach((p: any) => {
      methodsHtml += `
      <div class="item">
          <span>• ${p.method.toUpperCase()}</span>
          <span>S/ ${parseFloat(p.amount).toFixed(2)}</span>
      </div>`;
    });

    // Calculamos cuánto le queda de deuda después de este pago
    const remainingBalance = (parseFloat(selectedAccount.credit_balance) - totalPaid).toFixed(2);

    const ticketHTML = `
      <html>
      <head>
        <title>Voucher Abono</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 8px 10px; line-height: 1.3; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          hr { border: 1px dashed #000; margin: 6px 0; }
          .item { display: flex; justify-content: space-between; margin: 3px 0; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size:15px;">MI ERP - SISTEMA</div>
        <div class="center">*** VOUCHER DE ABONO ***</div>
        <div class="center">${new Date().toLocaleDateString("es-PE")} ${new Date().toLocaleTimeString("es-PE")}</div>
        <hr>
        <div>Cliente: ${selectedAccount.name}</div>
        <hr>
        <div class="bold" style="margin-bottom: 4px;">PAGO RECIBIDO EN:</div>
        ${methodsHtml}
        <hr>
        <div class="item bold" style="font-size:15px;">
          <span>TOTAL ABONADO</span>
          <span>S/ ${totalPaid.toFixed(2)}</span>
        </div>
        <div class="item" style="font-size:11px; margin-top: 5px;">
          <span>Deuda Restante:</span>
          <span>S/ ${remainingBalance}</span>
        </div>
        <hr>
        <div class="center" style="font-size:11px;">¡Gracias por su pago!</div>
      </body>
      </html>
    `;

    iframeDoc.write(ticketHTML);
    iframeDoc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };

  /*const handlePrintPDFReport = () => {
    if (!selectedAccount) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor, permite las ventanas emergentes para exportar el PDF.");
      return;
    }

    const allMovements = selectedAccount.history
      ? selectedAccount.history.flatMap((day: any) =>
          day.movements.map((mov: any) => ({ ...mov, date: day.date }))
        )
      : [];

    let tableRows = "";
    if (allMovements.length === 0) {
      tableRows = `<tr><td colspan="3" style="text-align:center; padding:20px; color:#aaa; font-style:italic;">No hay movimientos registrados.</td></tr>`;
    } else {
      allMovements.forEach((mov: any) => {
        
        // 🛡️ BLINDAJE DE FECHA Y HORA CORREGIDO: 
        // Tu backend de Laravel envía la fecha exacta dentro de 'full_date' o la hora en 'time'
        let dateString = mov.date + "T00:00:00"; // Valor por defecto
        if (mov.full_date) {
            dateString = mov.full_date;
        } else if (mov.time) {
            dateString = mov.date + "T" + mov.time + ":00";
        }
        const dateObj = new Date(dateString);
        
        // Formato: 1 de junio de 2026
        const formattedDate = dateObj.toLocaleDateString("es-PE", {
          day: "numeric", month: "long", year: "numeric"
        });

        // Formato: 02:30 PM (Si no hay hora exacta, mostrará 12:00 AM temporalmente)
        const formattedTime = dateObj.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });

        if (mov.is_payment) {
          tableRows += `
            <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f0fdf4;">
                <td style="padding: 14px; font-weight: bold; color: #166534; vertical-align: top;">
                    ${formattedDate}<br>
                    <span style="font-size: 11px; color: #15803d; font-weight: normal;">🕒 ${formattedTime}</span>
                </td>
                <td style="padding: 14px; text-align: left; color: #166534; vertical-align: top;">
                    <strong>💰 ABONO / PAGO REGISTRADO (${mov.method || 'Efectivo'})</strong>
                </td>
                <td style="padding: 14px; text-align: right; font-weight: bold; color: #166534; font-size: 14px; vertical-align: top;">
                    - S/ ${parseFloat(mov.amount || 0).toFixed(2)}
                </td>
            </tr>`;
        } else {
          // ==========================================
          // 🚀 MEJORA: DIBUJAR PRECIOS Y SUBTOTALES
          // ==========================================
          let productsList = `<strong style="color:#1e293b; font-size: 14px;">${mov.description || 'Despacho'}</strong>`;
          
          if (mov.details && mov.details.length > 0) {
            productsList += `<ul style="margin: 8px 0 0 0; padding-left: 20px; color: #475569; font-size: 13px; list-style-type: square;">`;
            
            mov.details.forEach((d: any) => {
              const productName = d.product_variant?.product?.name || "Producto general";
              const unitPrice = parseFloat(d.unit_price || 0).toFixed(2);
              const subTotalItem = parseFloat(d.subtotal || (d.quantity * parseFloat(d.unit_price || 0))).toFixed(2);
              
              productsList += `<li style="margin-bottom: 6px;">
                <strong>${d.quantity} und.</strong> x ${productName} 
                <span style="color:#64748b; font-size:11px; margin-left:4px;">(S/ ${unitPrice} c/u)</span>
                <span style="float:right; font-weight:bold; color:#334155; margin-right: 15px;">S/ ${subTotalItem}</span>
              </li>`;
            });
            
            productsList += `</ul>`;
          }

          tableRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 14px; font-weight: 500; color: #334155; vertical-align: top;">
                    ${formattedDate}<br>
                    <span style="font-size: 11px; color: #64748b;">🕒 ${formattedTime}</span>
                </td>
                <td style="padding: 14px; text-align: left; vertical-align: top;">${productsList}</td>
                <td style="padding: 14px; text-align: right; font-weight: bold; color: #0f172a; font-size: 14px; vertical-align: top;">
                    S/ ${parseFloat(mov.amount || 0).toFixed(2)}
                </td>
            </tr>`;
        }
      });
    }

    const pdfHtml = `
    <html>
    <head>
        <title>Estado de Cuenta - ${selectedAccount.name || 'Cliente'}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 45px; color: #333; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #1e3a8a; padding-bottom: 25px; margin-bottom: 5px; }
            .company-title { font-size: 28px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px; }
            .report-title { font-size: 15px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right; }
            .info-box { margin: 35px 0; font-size: 15px; color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th { background-color: #f8fafc; color: #1e293b; font-weight: 700; padding: 14px; text-align: left; font-size: 14px; border-bottom: 2px solid #cbd5e1; }
            td { font-size: 14px; vertical-align: top; }
            .total-box { display: flex; justify-content: flex-end; margin-top: 35px; }
            .total-card { background-color: #fafafa; border: 2px dashed #cbd5e1; padding: 18px 35px; text-align: right; border-radius: 12px; }
            .footer-note { text-align: center; margin-top: 60px; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 25px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <span class="company-title">NOSLIGHT</span><br>
                <span style="font-size: 13px; color: #64748b;">RUC: 10XXXXXXXXX • Reporte Oficial</span>
            </div>
            <div class="report-title">
                ESTADO DE CUENTA DETALLADO<br>
                <span style="font-size: 13px; font-weight: 500; color: #64748b;">Consultado el: ${new Date().toLocaleDateString('es-PE')}</span>
            </div>
        </div>

        <div class="info-box">
            <table style="width:60%; margin:0; border:none;">
                <tr><td style="padding:4px 0; width:30%;"><strong>CLIENTE:</strong></td><td style="padding:4px 0; color:#334155;">${selectedAccount.name || ''}</td></tr>
                ${selectedAccount.document_number ? `<tr><td style="padding:4px 0;"><strong>DNI/RUC:</strong></td><td style="padding:4px 0; color:#334155;">${selectedAccount.document_number}</td></tr>` : ''}
                <tr><td style="padding:4px 0;"><strong>ESTADO:</strong></td><td style="padding:4px 0; color:#b91c1c; font-weight:bold;">SALDO DEUDOR ACTIVO</td></tr>
            </table>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 25%;">FECHA</th>
                    <th style="width: 55%; text-align: left;">DESCRIPCIÓN / PRODUCTOS</th>
                    <th style="width: 20%; text-align: right;">IMPORTE (S/)</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>

        <div class="total-box">
            <div class="total-card">
                <span style="font-size: 14px; font-weight: bold; color: #475569;">TOTAL PENDIENTE DE PAGO:</span>
                <div style="font-size: 32px; font-weight: 900; color: #b91c1c; margin-top: 5px;">S/ ${parseFloat(selectedAccount.credit_balance || 0).toFixed(2)}</div>
            </div>
        </div>

        <div class="footer-note">
            Este documento representa un extracto fidedigno de los despachos y abonos en nuestra base de datos.<br>
            <strong>¡Muchas gracias por su preferencia!</strong>
        </div>
    </body>
    </html>`;

    printWindow.document.write(pdfHtml);
    printWindow.document.close();

    
  };*/

  // =========================================================================
  // 📄 ACCIÓN: GENERAR COMPROBANTE PDF ADMINISTRATIVO EN ESPEJO
  // =========================================================================
  const handlePrintPDFReport = () => {
    if (!selectedAccount) return;

    // 1. Inicializamos jsPDF de forma nativa y segura
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // 2. Encabezado Estilizado Corporativo
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("NOSLIGHT STORE", 15, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Soluciones Eléctricas e Industriales", 15, 25);
    doc.text("Reporte Operativo de Créditos", 15, 30);

    // Recuadro del Estado de Cuenta
    doc.setFillColor(255, 255, 255);
    doc.rect(130, 10, 65, 20, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("ESTADO DE CUENTA", 135, 17);
    doc.setTextColor(220, 38, 38);
    doc.text("SALDO PENDIENTE", 135, 25);

    // Datos del Expediente del Cliente
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("INFORMACIÓN DEL DEUDOR", 15, 55);
    doc.text("DETALLES DEL REPORTE", 120, 55);

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 57, 95, 57);
    doc.line(120, 57, 195, 57);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Cliente: ${selectedAccount.name || 'N/A'}`, 15, 64);
    doc.text(`DNI/RUC: ${selectedAccount.document_number || 'N/A'}`, 15, 70);

    doc.text(`Fecha Consulta: ${new Date().toLocaleDateString('es-PE')}`, 120, 64);
    doc.text(`Estado Legal: CRÉDITO ACTIVO`, 120, 70);

    // Tabla de Movimientos (Historial de Despachos y Abonos)
    let currentY = 85;
    doc.setFillColor(240, 242, 245);
    doc.rect(15, currentY, 180, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Fecha Operación", 17, currentY + 6);
    doc.text("Descripción / Detalle de Productos", 55, currentY + 6);
    doc.text("Importe (S/)", 190, currentY + 6, { align: "right" });

    // Aire para evitar el encabalgamiento inicial
    currentY = 96;

    const allMovements = selectedAccount.history
      ? selectedAccount.history.flatMap((day: any) =>
        day.movements.map((mov: any) => ({ ...mov, date: day.date }))
      )
      : [];

    doc.setFont("helvetica", "normal");

    if (allMovements.length === 0) {
      doc.text("No se registran movimientos en este periodo.", 17, currentY + 5);
      doc.line(15, currentY + 8, 195, currentY + 8);
    } else {
      allMovements.forEach((mov: any) => {
        if (currentY > 260) {
          doc.addPage();
          currentY = 20;

          doc.setFillColor(240, 242, 245);
          doc.rect(15, currentY, 180, 8, "F");
          doc.setFont("helvetica", "bold");
          doc.text("Fecha Operación", 17, currentY + 6);
          doc.text("Descripción / Detalle de Productos", 55, currentY + 6);
          doc.text("Importe (S/)", 190, currentY + 6, { align: "right" });
          doc.setFont("helvetica", "normal");
          currentY += 12;
        }

        let dateString = mov.date + "T00:00:00";
        if (mov.full_date) {
          dateString = mov.full_date;
        } else if (mov.time) {
          dateString = mov.date + "T" + mov.time + ":00";
        }

        const dateObj = new Date(dateString);
        const formattedDate = dateObj.toLocaleDateString("es-PE", { day: "numeric", month: "short" });

        const formattedTime = dateObj.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        }).toLowerCase().replace("am", "a. m.").replace("pm", "p. m.");

        if (mov.is_payment) {
          doc.setFont("helvetica", "bold");
          doc.text(formattedDate, 17, currentY + 5);

          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(` ${formattedTime}`, 17, currentY + 9);
          doc.setFontSize(10);

          doc.setFont("helvetica", "bold");
          doc.text(`ABONO REGISTRADO (${mov.method?.toUpperCase() || 'EFECTIVO'})`, 55, currentY + 5);
          doc.text(`-S/ ${parseFloat(mov.amount).toFixed(2)}`, 190, currentY + 5, { align: "right" });
          currentY += 14;
        } else {
          doc.setFont("helvetica", "normal");
          doc.text(formattedDate, 17, currentY + 5);

          doc.setFontSize(8);
          doc.text(` ${formattedTime}`, 17, currentY + 9);
          doc.setFontSize(10);

          doc.text(mov.description || 'Despacho de Mercadería', 55, currentY + 5);
          doc.text(`S/ ${parseFloat(mov.amount).toFixed(2)}`, 190, currentY + 5, { align: "right" });
          currentY += 12;

          if (mov.details && mov.details.length > 0) {
            mov.details.forEach((d: any) => {
              if (currentY > 270) {
                doc.addPage();
                currentY = 20;
              }
              const prodName = d.product_variant?.product?.name || "Producto general";
              doc.setFontSize(9);
              doc.setTextColor(110, 110, 110);
              doc.text(`  • ${d.quantity} und. x ${prodName} (S/ ${parseFloat(d.unit_price).toFixed(2)} c/u)`, 55, currentY + 1);
              doc.setTextColor(50, 50, 50);
              doc.setFontSize(10);
              currentY += 6;
            });
            currentY += 4;
          }
        }

        doc.setDrawColor(226, 232, 240);
        doc.line(15, currentY, 195, currentY);
        currentY += 6;
      });
    }

    // Total General Alineado Correctamente
    currentY += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    doc.text("TOTAL PENDIENTE DE PAGO:", 15, currentY);

    doc.setFontSize(16);
    doc.setTextColor(185, 28, 28);
    doc.text(`S/ ${parseFloat(selectedAccount.credit_balance || 0).toFixed(2)}`, 195, currentY, { align: "right" });

    // Pie de página
    currentY += 15;
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Este extracto representa un balance oficial de despachos y aportes financieros del cliente.", 15, currentY);

    // Descarga Directa
    const clienteLimpio = selectedAccount.name.replace(/\s+/g, '_');
    doc.save(`Estado_de_Cuenta_${clienteLimpio}.pdf`);
  };



  // Filtros de búsqueda inteligentes
  const filteredPending = pendingSales.filter((group) => {
    const searchLower = searchTerm.toLowerCase();
    const customerName = group.customer_name || "";
    return customerName.toLowerCase().includes(searchLower);
  });

  const filteredAccounts = accounts.filter((account) =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );


  // 🟢 ACORDEÓN CONSOLIDADO CON DESGLOSE COMPLETO DE FECHAS Y HORAS
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

  const renderCollectionDocuments = (account: any) => {
    const groups: Record<string, any[]> = {};

    // Agrupamos en vivo los tickets que comparten el mismo código de cobro en las notas
    account?.sales?.forEach((sale: any) => {
      const code = sale.notes && sale.notes.startsWith('DOC-COBRO-') ? sale.notes : `INDIVIDUAL-${sale.id}`;
      if (!groups[code]) groups[code] = [];
      groups[code].push(sale);
    });

    const groupKeys = Object.keys(groups);

    if (groupKeys.length === 0) {
      return (
        <p className="text-xs text-gray-400 font-medium text-center py-2">
          Sin documentos de cobro activos en este expediente.
        </p>
      );
    }

    const isExpanded = expandedAccounts[account.id] || false;

    return (
      <div className="mt-2 bg-gray-50 border border-gray-200 rounded-2xl p-3">
        {/* Botón conmutador para desplegar u ocultar el desglose y ahorrar pantalla */}
        <button
          type="button"
          onClick={() => setExpandedAccounts(prev => ({ ...prev, [account.id]: !isExpanded }))}
          className="w-full flex items-center justify-between text-left text-xs font-black text-gray-600 uppercase tracking-wider hover:text-gray-900 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            🧾 {groupKeys.length} {groupKeys.length === 1 ? 'Documento' : 'Documentos'} de Cobro Cerrados
          </span>
          <span className="text-xs font-bold text-blue-600 font-mono">
            {isExpanded ? "▲ Ocultar" : "▼ Ver Desglose"}
          </span>
        </button>

        {/* CONTENEDOR DESPLEGABLE */}
        {isExpanded && (
          <div className="mt-3 space-y-3 max-h-60 overflow-y-auto pt-2 border-t border-dashed border-gray-200">
            {groupKeys.map((groupCode) => {
              const salesInGroup = groups[groupCode];

              // Sumamos los montos de todo el lote valorizado junto
              const totalAmount = salesInGroup.reduce((acc, s) => acc + parseFloat(s.total_amount), 0);
              const pendingBalance = salesInGroup.reduce((acc, s) => acc + parseFloat(s.pending_balance), 0);
              const isPaid = pendingBalance <= 0;

              return (
                <div
                  key={groupCode}
                  className="p-3 rounded-xl border flex flex-col gap-2.5 bg-white shadow-sm border-gray-100"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-black text-gray-900 text-xs block tracking-wide">
                        {groupCode.startsWith('INDIVIDUAL-') ? 'Comprobante Directo' : groupCode}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">
                        🗂️ Consolidado de {salesInGroup.length} vales aprobados juntos
                      </span>
                    </div>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${isPaid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                      }`}>
                      {isPaid ? "Cancelado" : "Pendiente"}
                    </span>
                  </div>

                  {/* 🟢 EL DESGLOSE DE PRODUCTOS CON HORA Y FECHA EXACTA */}
                  <div className="bg-gray-50/50 rounded-xl p-2.5 border border-gray-100 space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                      Productos Incluidos en este Documento:
                    </p>
                    {salesInGroup.map((sale: any) => {
                      const saleDate = new Date(sale.created_at);
                      const formattedTime = saleDate.toLocaleTimeString("es-PE", { hour: '2-digit', minute: '2-digit', hour12: false });
                      const formattedDate = saleDate.toLocaleDateString("es-PE", { day: 'numeric', month: 'short' });

                      return (
                        <div key={sale.id} className="pl-2 border-l-2 border-blue-400 space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-400 uppercase block">
                            🕒 Retirado el {formattedDate} a las {formattedTime} hrs (Vale: {sale.receipt_number})
                          </span>
                          {sale.items?.map((it: any) => (
                            <p key={it.id} className="text-[11px] text-gray-600 font-medium pl-1">
                              • {it.quantity} und. x {it.product_variant?.product?.name || "Artículo"} — <span className="font-semibold text-gray-700">S/ {parseFloat(it.unit_price).toFixed(2)}</span>
                            </p>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* Balance de Saldos del Lote */}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 mt-0.5">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                        {isPaid ? "Total Liquidado" : "Saldo Pendiente de este Lote"}
                      </p>
                      <p className={`text-sm font-black ${isPaid ? "text-green-600" : "text-red-600"}`}>
                        S/ {isPaid ? totalAmount.toFixed(2) : pendingBalance.toFixed(2)}
                      </p>
                    </div>

                    {isPaid ? (
                      <span className="text-[10px] font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-xl border border-green-200">
                        Liquidado Conforme
                      </span>
                    ) : (
                      <button
                        type="button"
                        // 🟢 CONEXIÓN NATIVA COMPATIBLE:
                        // Abre la pestaña oficial de cobranza inyectándole el cliente actual.
                        // El cajero podrá usar tus métodos mixtos y bancos dinámicos sin restricciones.
                        onClick={() => openAccountStatement(account)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-sm transition-colors"
                      >
                        Abonar Lote
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };


  // 🟢 EXTRACCIÓN QUIRÚRGICA: Mapeamos los códigos del slider para sacar los IDs reales de los vales
  const finalSaleIds: number[] = [];
  selectedAccount?.sales?.forEach((sale: any) => {
    // Usamos exactamente la misma lógica de agrupación que tiene tu slider visual
    const code = sale.notes && sale.notes.startsWith('LOTE-VALORIZADO-') ? sale.notes : `DIRECTO-${sale.id}`;

    // Si el operario tiene seleccionada esta tarjeta, inyectamos el vale a la cascada de pago
    if (selectedGroupCodes.includes(code)) {
      finalSaleIds.push(sale.id);
    }
  });

  // 📦 CONSTRUCCIÓN DEL PAQUETE DE DATOS OFICIAL
  const payload = {
    sale_ids: finalSaleIds, // <-- Aquí viaja la lista de vales llena y corregida
    payments: payments.map(p => ({
      amount: parseFloat(p.amount),
      method: p.method,
      yape_account: p.yape_account,
      bank_account: p.bank_account
    }))
  };


  // 🟢 MOTOR DE IMPRESIÓN DOCUMENTAL (Descarga Directa de PDF A4 y Ticket 80mm en Caliente)
  const generateDocumentReport = (lote: any, format: "pdf" | "ticket") => {
    const companyName = "Sistema junsu/kyf/noslight/jp.";
    const clientName = selectedAccount?.name || "Cliente General";
    const loteCode = lote.notes.replace('LOTE-VALORIZADO-', 'LOTE #');
    const dateString = new Date(lote.created_at).toLocaleDateString("es-PE");
    const cleanItems = lote.items?.filter((it: any) => it.quantity > 0) || [];
    const paymentsList = lote.payments || [];

    // 📄 CASO A: DESCARGA AUTOMÁTICA DE PDF PURO EN UN SOLO CLIC (Para Mandar por WhatsApp)
    if (format === "pdf") {
      try {
        // Inicializamos la librería nativa jsPDF que ya tiene tu archivo
        // 🟢 LLAMADO DIRECTO: Usa la instancia importada arriba de forma nativa
        const doc = new jsPDF();

        // Diseñamos el encabezado corporativo elegante
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(20);
        doc.text(companyName, 20, 20);

        doc.setFontSize(10);
        doc.setFont("Helvetica", "normal");
        doc.text("Control Interno de Créditos y Cobranzas", 20, 26);

        // Caja de Estado del Lote
        const isPaid = lote.pending_balance <= 0;
        doc.setFillColor(isPaid ? 209 : 254, isPaid ? 250 : 226, isPaid ? 229 : 226);
        doc.rect(140, 13, 50, 14, "F");
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.text(isPaid ? "TOTALMENTE PAGADO" : "CUENTA PENDIENTE", 143, 21);

        // Tabla de Datos del Cliente
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.rect(20, 35, 170, 18, "FD");

        doc.setFont("Helvetica", "bold");
        doc.text("CLIENTE:", 25, 42); doc.setFont("Helvetica", "normal"); doc.text(clientName.toUpperCase(), 45, 42);
        doc.setFont("Helvetica", "bold");
        doc.text("DOCUMENTO:", 25, 48); doc.setFont("Helvetica", "normal"); doc.text(loteCode, 52, 48);
        doc.setFont("Helvetica", "bold");
        doc.text("FECHA:", 130, 42); doc.setFont("Helvetica", "normal"); doc.text(dateString, 150, 42);

        // 📦 TITULO: MERCADERÍA DESPACHADA
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.text("DESGLOSE DE MERCADERÍA DESPACHADA A CRÉDITO", 20, 63);

        let currentY = 70;
        doc.setFillColor(243, 244, 246);
        doc.rect(20, currentY, 170, 8, "F");
        doc.setFontSize(9);
        doc.text("Cant.", 23, currentY + 6);
        doc.text("Descripción del Producto", 45, currentY + 6);
        doc.text("P. Unit.", 135, currentY + 6);
        doc.text("Subtotal", 170, currentY + 6);
        currentY += 8;


        // 🟢 FORMATEO INDESTRUCIBLE: Soporte multi-línea automático para descripciones ultra-largas
        cleanItems.forEach((it: any) => {
          const fDespacho = it.fecha_despacho || dateString;
          const pName = it.product_variant?.product?.name || "Artículo";
          const total = (it.quantity * parseFloat(it.unit_price)).toFixed(2);

          // Cantidad (Cant.) en su lugar fijo
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(9);
          doc.text(`${it.quantity}`, 23, currentY + 6);

          // 🛡️ ESCUDO ANTI-DESBORDES: Corta el texto automáticamente si supera los 95mm de ancho
          doc.setFont("Helvetica", "bold");
          const splitName = doc.splitTextToSize(pName, 95);
          doc.text(splitName, 32, currentY + 6);

          // Calculamos cuántas líneas ocupó el nombre largo para empujar la fecha de despacho de forma dinámica
          const linesOccupied = splitName.length;
          const dateYOffset = 6 + (linesOccupied * 4.5); // Da un salto proporcional limpio hacia abajo

          // Pintamos la fecha y hora calculando el desfase vertical dinámico
          doc.setFont("Helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139); // Gris contable
          doc.text(`Despachado el: ${fDespacho} hrs`, 32, currentY + dateYOffset);

          // Pintamos los montos de la derecha en sus coordenadas seguras fijas
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(51, 51, 51);
          doc.text(`S/ ${parseFloat(it.unit_price).toFixed(2)}`, 135, currentY + 6);
          doc.text(`S/ ${total}`, 170, currentY + 6);

          // Incrementamos el eje Y sumando el espacio dinámico que ocuparon las líneas del texto largo
          currentY += dateYOffset + 6;
        });



        // 💰 TITULO: HISTORIAL DE COBRANZA
        currentY += 10;
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.text("HISTORIAL CRONOLÓGICO DE RECAUDACIÓN EN CAJA", 20, currentY);
        currentY += 6;

        if (paymentsList.length > 0) {
          paymentsList.forEach((p: any) => {
            const pDate = new Date(p.full_date || p.created_at).toLocaleDateString("es-PE");
            doc.setFillColor(249, 250, 251);
            doc.rect(20, currentY, 170, 8, "F");
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(9);

            // 🟢 INYECCIÓN DEL MÉTODO DE PAGO: Jalamos la propiedad p.method de forma limpia
            const paymentMethodText = p.method ? `[${p.method}]` : '';
            doc.text(`Abono realizado el ${pDate} a las ${p.time || 'hrs'} hrs mediante ${paymentMethodText} — `,  23, currentY + 6);

            doc.setFont("Helvetica", "bold");
            doc.text(`+ S/ ${parseFloat(p.amount).toFixed(2)}`, 170, currentY + 6);
            currentY += 8;
          });
        } else {

          doc.setFont("Helvetica", "italic");
          doc.text("No se registran abonos parciales realizados a este lote.", 25, currentY + 6);
          currentY += 8;
        }

        // Bloque de Totales Finales Cuadrados abajo a la derecha
        currentY += 10;
        doc.setFillColor(249, 250, 251);
        doc.rect(120, currentY, 70, 24, "F");
        doc.setFont("Helvetica", "normal");
        doc.text("TOTAL VALORIZADO:", 123, currentY + 6); doc.text(`S/ ${parseFloat(lote.total_amount).toFixed(2)}`, 170, currentY + 6);
        doc.text("TOTAL AMORTIZADO:", 123, currentY + 12); doc.text(`S/ ${parseFloat(lote.paid_amount).toFixed(2)}`, 170, currentY + 12);
        doc.setDrawColor(200, 200, 200);
        doc.line(123, currentY + 15, 187, currentY + 15);
        doc.setFont("Helvetica", "bold");
        doc.text("SALDO DEUDA:", 123, currentY + 21); doc.text(`S/ ${parseFloat(lote.pending_balance).toFixed(2)}`, 170, currentY + 21);

        // 🔥 LA MAGIA DE LA DESCARGA INSTANTÁNEA:
        // El navegador descarga el archivo de forma directa sin abrir pestañas feas
        const cleanFileName = `ESTADO_CUENTA_${clientName.replace(/\s+/g, '_')}_${lote.notes}.pdf`;
        doc.save(cleanFileName);

      } catch (error) {
        console.error("Error generando el PDF directo", error);
        alert("Ocurrió un inconveniente técnico al armar el PDF. Por favor verifica las importaciones.");
      }
      return;
    }

    // 🖨️ CASO B: IMPRESIÓN DE TICKET TÉRMICO DE 80MM (Mantiene tu canal directo a la ticketera)
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let itemsRows = "";
    cleanItems.forEach((it: any) => {
      const pName = it.product_variant?.product?.name || "Artículo";
      itemsRows += `<tr><td>${it.quantity}x ${pName.substring(0, 18)}</td><td class="text-right">S/ ${(it.quantity * parseFloat(it.unit_price)).toFixed(2)}</td></tr>`;
    });

    let paymentsRows = "";
    paymentsList.forEach((p: any) => {
      paymentsRows += `<div>• ${new Date(p.full_date || p.created_at).toLocaleDateString("es-PE")} - ${p.method}: S/ ${parseFloat(p.amount).toFixed(2)}</div>`;
    });

    const htmlContent = `
      <html>
      <head>
        <style>
          body { font-family: 'Courier New', Courier, monospace; width: 76mm; padding: 3mm; color: #000; font-size: 11px; line-height: 1.3; }
          .text-center { text-align: center; } .bold { font-weight: bold; }
          .border-dashed { border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; } .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="text-center bold">${companyName}</div>
        <div class="text-center">${loteCode}</div>
        <div class="border-dashed"></div>
        <div><span class="bold">Cliente:</span> ${clientName}</div>
        <div><span class="bold">Fecha:</span> ${dateString}</div>
        <div class="border-dashed"></div>
        <div class="bold">📦 ARTÍCULOS:</div>
        <table><tbody>${itemsRows}</tbody></table>
        <div class="border-dashed"></div>
        <div class="bold">💰 HISTORIAL ABONOS:</div>
        ${paymentsRows || "<div>No registra abonos.</div>"}
        <div class="border-dashed"></div>
        <table class="bold">
          <tr><td>TOTAL LOTE:</td><td class="text-right">S/ ${parseFloat(lote.total_amount).toFixed(2)}</td></tr>
          <tr><td>AMORTIZADO:</td><td class="text-right">S/ ${parseFloat(lote.paid_amount).toFixed(2)}</td></tr>
          <tr><td>SALDO DEUDA:</td><td class="text-right">S/ ${parseFloat(lote.pending_balance).toFixed(2)}</td></tr>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };





  return (
    <div className="p-8 h-full flex flex-col bg-gray-50/50 relative">
      {/* CABECERA Y PESTAÑAS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <FileText className="text-blue-600" size={32} />
            Créditos y Cobranzas
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Gestiona los despachos, fija precios y controla las deudas.
          </p>
        </div>

        <div className="flex bg-gray-200 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab("pendientes")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === "pendientes" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Clock size={18} /> Por Valorizar{" "}
            {pendingSales.length > 0 && (
              <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                {pendingSales.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("cuentas")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === "cuentas" ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Users size={18} /> Cuentas de Clientes
          </button>
        </div>

      </div>


      {/* BUSCADOR */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder={
            activeTab === "pendientes"
              ? "Buscar por cliente o N° de Vale..."
              : "Buscar cliente deudor..."
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 bg-white border border-gray-200 rounded-4xl overflow-hidden shadow-sm flex flex-col">

        {/* ========================================================= */}
        {/* VISTA 1: DESPACHOS PENDIENTES DE VALORIZAR                 */}
        {/* ========================================================= */}
        {activeTab === "pendientes" && (
          <div className="flex-1 overflow-auto p-2">
            {isLoadingPending ? (
              <div className="p-8 text-center text-gray-400 font-bold">
                Cargando despachos...
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <CheckCircle className="text-green-400 mb-4" size={48} />
                <h3 className="text-xl font-black text-gray-800">
                  ¡Todo al día!
                </h3>
                <p className="text-gray-500 font-medium">
                  No hay despachos pendientes de valorizar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredPending.map((group) => (
                  <div
                    key={group.group_id}
                    onClick={() => openApprovalModal(group)}
                    className="bg-white border border-gray-200 p-6 hover:border-orange-400 hover:shadow-lg transition-all rounded-3xl cursor-pointer group flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-orange-100 text-orange-600 p-3 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-colors">
                          <Clock size={24} />
                        </div>
                        <div>
                          <h3
                            className="font-black text-lg text-gray-900 line-clamp-1"
                            title={group.customer_name}
                          >
                            {group.customer_name}
                          </h3>
                          <p className="text-sm font-bold text-gray-500">
                            {group.sale_ids.length} Vales pendientes
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 mt-auto">
                      <p className="text-orange-800 text-xs font-bold uppercase tracking-widest mb-1">
                        Monto de Referencia
                      </p>
                      <p className="text-3xl font-black text-orange-600">
                        S/ {parseFloat(group.estimated_total).toFixed(2)}
                      </p>
                      <div className="mt-3 pt-3 border-t border-orange-200/60 flex flex-wrap gap-1">
                        {group.days.map((d: any, idx: number) => (
                          <span
                            key={idx}
                            className="text-[10px] font-black bg-white text-orange-600 px-2 py-1 rounded-md border border-orange-100"
                          >
                            📅{" "}
                            {new Date(d.date + "T00:00:00").toLocaleDateString(
                              "es-PE",
                              { day: "numeric", month: "short" },
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}






        {/* ========================================================= */}
        {/* VISTA 2: DIRECTORIO DE CUENTAS POR COBRAR */}
        {/* ========================================================= */}
        {activeTab === "cuentas" && (
          <div className="flex-1 overflow-auto p-2">
            {isLoadingAccounts ? (
              <div className="p-8 text-center text-gray-400 font-bold">
                Cargando cuentas...
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <CheckCircle className="text-green-400 mb-4" size={48} />
                <h3 className="text-xl font-black text-gray-800">
                  Cero Deudas
                </h3>
                <p className="text-gray-500 font-medium">
                  Actualmente ningún cliente le debe dinero a la tienda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredAccounts.map((account) => {
                  // Evaluamos en vivo si el cliente está al día o tiene deuda activa
                  const isAlDia = parseFloat(account.credit_balance) <= 0;

                  return (
                    <div
                      key={account.id}
                      className={`bg-white border rounded-3xl p-6 hover:shadow-lg transition-shadow flex flex-col ${isAlDia ? "border-gray-200" : "border-red-200"
                        }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-2xl ${isAlDia ? "bg-gray-100 text-gray-500" : "bg-red-50 text-red-600"
                            }`}>
                            <Users size={24} />
                          </div>
                          <div>
                            <h3 className="font-black text-lg text-gray-900 line-clamp-1" title={account.name}>
                              {account.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs font-bold text-gray-400 uppercase">
                                {account.document_number || "Sin DNI/RUC"}
                              </p>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${isAlDia ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}>
                                {isAlDia ? "✓ Al día" : "⚠️ Deudor"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CASILLERO DE SALDOS BRUTOS MACRO */}
                      <div className={`rounded-2xl p-4 mb-4 flex-1 border ${isAlDia ? "bg-gray-50 border-gray-100" : "bg-red-50 border-red-100"
                        }`}>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isAlDia ? "text-gray-500" : "text-red-800"}`}>
                          Deuda Total Actual
                        </p>
                        <p className={`text-3xl font-black ${isAlDia ? "text-gray-400" : "text-red-600"}`}>
                          S/ {parseFloat(account.credit_balance).toFixed(2)}
                        </p>
                      </div>

                      {/* 💼 EL BOTÓN DE ACCIÓN COMERCIAL LIMPIO QUE PLANIFICAMOS */}
                      <button
                        onClick={() => openAccountStatement(account)}
                        className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-white ${isAlDia
                          ? "bg-gray-700 hover:bg-gray-800"
                          : "bg-gray-900 hover:bg-black"
                          }`}
                      >
                        <History size={18} /> 💼 Ejecutar Crédito / Gestionar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


      </div>

      {/* ========================================================= */}
      {/* MODAL DE APROBACIÓN DE PRECIOS (NO SE TOCA) */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* MODAL DE APROBACIÓN AGRUPADA POR DÍA */}
      {/* ========================================================= */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-4xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-gray-900 p-6 flex justify-between items-center text-white shrink-0">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2">
                  Fijar Precios del Día
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Cliente: <span className="text-white font-bold">{selectedGroup.customer_name}</span> • {selectedGroup.sale_ids.length} vale(s) pendiente(s)
                </p>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={28} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="space-y-6">
                {/* Obtenemos las fechas únicas que tiene este grupo */}
                {Array.from(new Set(editableItems.map((i) => i.date))).map(
                  (dateDate) => (
                    <div
                      key={dateDate}
                      className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
                    >
                      {/* Cabecera del Día */}
                      <div className="bg-gray-100 p-3 px-5 border-b border-gray-200">
                        <h4 className="font-black text-gray-800 capitalize flex items-center gap-2">
                          📅{" "}
                          {new Date(dateDate + "T00:00:00").toLocaleDateString(
                            "es-PE",
                            { weekday: "long", day: "numeric", month: "long" },
                          )}
                        </h4>
                      </div>
                      {/* Lista de productos de ESE día */}
                      <div className="divide-y divide-gray-100 p-2">
                        {editableItems
                          .filter((item) => item.date === dateDate)
                          .map((item) => (
                            <div
                              key={item.id}
                              className="p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors rounded-xl"
                            >
                              <div className="flex-1">
                                <div className="flex gap-2 items-center mb-1">
                                  <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Clock size={10} /> {item.time}
                                  </span>
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    {item.receipt_number}
                                  </span>
                                </div>
                                <p className="font-bold text-gray-900 line-clamp-1">
                                  {item.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Cant:{" "}
                                  <span className="font-black text-gray-800">
                                    {item.quantity} und
                                  </span>
                                </p>
                              </div>
                              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 w-full md:w-auto">
                                <DollarSign
                                  size={16}
                                  className="text-gray-400"
                                />
                                <input
                                  type="number"
                                  step="0.10"
                                  value={item.unit_price}
                                  onChange={(e) =>
                                    updateItemPrice(item.id, e.target.value)
                                  }
                                  onFocus={(e) => e.target.select()}
                                  className="w-24 text-right font-black text-xl text-blue-600 bg-transparent focus:outline-none"
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="bg-white p-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
              <div className="text-left w-full md:w-auto bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">
                  Nueva Deuda por este día
                </p>
                <p className="text-3xl font-black text-blue-700">
                  S/{" "}
                  {editableItems
                    .reduce(
                      (acc, item) => acc + item.quantity * item.unit_price,
                      0,
                    )
                    .toFixed(2)}
                </p>
              </div>
              <button
                onClick={handleApproveGroup}
                disabled={isSaving}
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-lg transition-all"
              >
                {isSaving ? "GUARDANDO..." : "APROBAR TODO EL DÍA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SÚPER MODAL DE EXPEDIENTE Y COBRANZAS */}
      {/* ========================================================= */}
      {selectedAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-4xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
            {/* Cabecera Negra */}
            <div className="bg-gray-900 p-6 flex justify-between items-center text-white shrink-0">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2">
                  <History /> Expediente del Cliente
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {selectedAccount.name}
                </p>
              </div>
              {/* 🔍 BUSCA EL BOTÓN DE LA X EN LA CABECERA NEGRA Y DÉJALO ASÍ: */}
              <button
                onClick={() => {
                  // 1. Cerramos el modal limpiando el cliente seleccionado
                  setSelectedAccount(null);
                  // 2. 🛡️ LIMPIEZA ABSOLUTA DE RESIDUOS:
                  // Apagamos los checks del carrusel y borramos el rastro del lote anterior
                  setSelectedGroupCodes([]);
                  setActiveDetailCode(null);
                  if (typeof setActiveValePayments === "function") {
                    setActiveValePayments([]);
                  }
                  // 3. Reiniciamos la pestaña por defecto
                  setAccountTab("abono");
                }}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800"
                title="Cerrar Expediente"
              >
                <X size={28} />
              </button>
            </div>

            {/* Pestañas del Modal */}
            <div className="flex bg-gray-100 p-2 shrink-0 border-b border-gray-200">
              <button
                onClick={() => setAccountTab("abono")}
                className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${accountTab === "abono" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Banknote className="inline mr-2" size={16} /> Registrar Nuevo
                Abono
              </button>
              <button
                onClick={() => setAccountTab("historial")}
                className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${accountTab === "historial" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <FileText className="inline mr-2" size={16} /> Historial
                Detallado
              </button>

              <button
                onClick={() => setAccountTab("cobranza")}
                className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${accountTab === "cobranza" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <FileText className="inline mr-2" size={16} /> Proforma de Cobro
              </button>
            </div>



            {/* Cuerpo Escrolleable */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">


              {accountTab === "abono" && (
                <div className="space-y-5 p-2">

                  {/* 🗂️ A. CARRUSEL HORIZONTAL DE LOTES DE COBRO ABIERTOS */}
                  <div className="bg-gray-50 border border-gray-200 rounded-3xl p-4">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      🗂️ Selecciona los Lotes de Cobro a Pagar:
                    </p>
                    {(() => {
                      const groups: Record<string, any[]> = {};

                      selectedAccount?.sales?.forEach((sale: any) => {
                        // 🔒 COMPATIBILIDAD INTEGRAL: Lee 'pending_balance' (nuevo) o calcula el saldo del vale (antiguo)
                        const balance = sale.pending_balance !== undefined
                          ? parseFloat(sale.pending_balance)
                          : (parseFloat(sale.total_amount) - parseFloat(sale.paid_amount || 0));

                        if (sale.status !== 'paid' && balance > 0) {
                          // Detecta si es un documento unificado nuevo o un vale antiguo
                          const code = sale.notes && (sale.notes.startsWith('LOTE-VALORIZADO-') || sale.notes.startsWith('DOC-COBRO-'))
                            ? sale.notes
                            : `DIRECTO-${sale.id}`;

                          if (!groups[code]) groups[code] = [];

                          // Guardamos el saldo normalizado para que el resto del carrusel no se rompa
                          groups[code].push({
                            ...sale,
                            pending_balance: balance
                          });
                        }
                      });

                      const groupKeys = Object.keys(groups);

                      if (groupKeys.length === 0) {
                        return (
                          <p className="text-xs text-gray-400 font-medium text-center py-4">
                            ✓ Este cliente no registra documentos con saldos pendientes actualmente.
                          </p>
                        );
                      }

                      return (
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin snap-x">
                          {groupKeys.map((code) => {
                            const sales = groups[code];
                            const totalAmount = sales.reduce((acc, s) => acc + parseFloat(s.total_amount), 0);
                            const pendingBalance = sales.reduce((acc, s) => acc + parseFloat(s.pending_balance), 0);
                            const paidAmount = totalAmount - pendingBalance;
                            const progressPercent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

                            const isSelected = selectedGroupCodes.includes(code);

                            // Extraemos la fecha del código del lote (LOTE-VALORIZADO-20260623-XXXXXX) para una lectura veloz
                            let displayDate = "";
                            if (code.startsWith('LOTE-VALORIZADO-')) {
                              const rawDate = code.split('-')[2]; // '20260623'
                              if (rawDate && rawDate.length === 8) {
                                const day = rawDate.substring(6, 8);
                                const monthNum = rawDate.substring(4, 6);
                                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                displayDate = ` 📅 ${day} de ${months[parseInt(monthNum) - 1] || 'Mes'}`;
                              }
                            }

                            // Título comercial e imponente para el operario
                            const displayTitle = code.startsWith('DIRECTO-') ? '📄 Documento Único' : '🧾 LOTE DE COBRO';

                            return (
                              <div
                                key={code}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedGroupCodes(prev => prev.filter(c => c !== code));
                                    if (activeDetailCode === code) setActiveDetailCode(null);
                                  } else {
                                    setSelectedGroupCodes(prev => [...prev, code]);
                                    setActiveDetailCode(code);
                                  }
                                }}
                                // 🎨 UX PREMIUM: Cambio drástico de fondo, bordes y escala táctil al seleccionar
                                className={`snap-start min-w-[230px] p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between select-none ${isSelected
                                  ? "bg-white border-blue-600 shadow-lg ring-1 ring-blue-600/20 transform scale-[1.03]"
                                  : "bg-gray-50/70 border-gray-200/80 hover:border-gray-300 hover:bg-gray-50"
                                  }`}
                              >
                                <div>
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <span className={`font-black text-xs tracking-wider uppercase block ${isSelected ? "text-blue-600" : "text-gray-700"
                                        }`}>
                                        {displayTitle}
                                      </span>
                                      <span className="text-[10px] text-gray-400 font-bold mt-0.5 block">
                                        {displayDate || `📌 ID: ${code.replace('DIRECTO-', '')}`}
                                      </span>
                                    </div>

                                    {/* ☑️ CHECKBOX ULTRA DIRECTO Y GRANDE PARA EL OPERARIO */}
                                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] transition-all ${isSelected
                                      ? "bg-blue-600 border-blue-600 text-white font-black shadow-sm"
                                      : "border-gray-300 bg-white"
                                      }`}>
                                      {isSelected ? "✓" : ""}
                                    </span>
                                  </div>

                                  <p className="text-[11px] font-bold text-gray-500 bg-gray-100/60 inline-block px-2 py-0.5 rounded-lg border border-gray-200/40">
                                    💼 {sales.length} {sales.length === 1 ? 'vale agrupado' : 'vales consolidados'}
                                  </p>
                                </div>

                                {/* 📊 SECCIÓN FINANCIERA INTERNA (SALDOS Y PROGRESO) */}
                                <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                                  <div className="flex justify-between items-baseline mb-1.5">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Saldo Restante</span>
                                    <span className={`font-mono text-base font-black ${isSelected ? "text-blue-700" : "text-gray-900"
                                      }`}>
                                      S/ {pendingBalance.toFixed(2)}
                                    </span>
                                  </div>

                                  {/* Riel estilizado con indicador esmeralda para amortizaciones */}
                                  <div className="w-full bg-gray-200/70 rounded-full h-1.5 mb-1 overflow-hidden">
                                    <div
                                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                                      style={{ width: `${progressPercent}%` }}
                                    ></div>
                                  </div>

                                  <div className="flex justify-between text-[9px] font-extrabold text-gray-400 tracking-wide">
                                    <span>Total: S/ {totalAmount.toFixed(2)}</span>
                                    <span className="text-emerald-600 font-black">{progressPercent.toFixed(0)}% pagado</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                        </div>
                      );
                    })()}



                  </div>
                  {/* 🟢 SECCIÓN INTERACTIVA TRAS SELECCIONAR TARJETAS EN EL SLIDER */}
                  {selectedGroupCodes.length > 0 ? (
                    <>
                      {/* Bloques de Monto Acumulado en Caliente (CORREGIDO ANTI-BUGS) */}
                      {(() => {
                        let aggregatedPending = 0;
                        selectedAccount?.sales?.forEach((sale: any) => {
                          // 🟢 DETECCIÓN FLEXIBLE: Si la nota empieza con LOTE o DOC-COBRO, asumimos el string real de la nota
                          const code = sale.notes && (
                            sale.notes.startsWith('LOTE-VALORIZADO-') ||
                            sale.notes.startsWith('LOTE-') ||
                            sale.notes.startsWith('DOC-COBRO-')
                          ) ? sale.notes : `DIRECTO-${sale.id}`;

                          if (selectedGroupCodes.includes(code)) {
                            aggregatedPending += parseFloat(sale.pending_balance || 0);
                          }
                        });

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-red-50 border border-red-100 rounded-3xl p-5 border-l-4 border-l-red-500 shadow-sm">
                              <p className="text-red-800 text-xs font-black uppercase tracking-widest mb-1">
                                Monto Seleccionado a Pagar
                              </p>
                              <p className="text-3xl font-black text-red-600">
                                S/ {aggregatedPending.toFixed(2)}
                              </p>
                              <p className="text-[10px] text-red-400 font-medium mt-1">
                                Suma combinada de los {selectedGroupCodes.length} lotes marcados arriba.
                              </p>
                            </div>

                            <div className="bg-green-50 border border-green-100 rounded-3xl p-5 border-l-4 border-l-green-500 shadow-sm">
                              <p className="text-green-800 text-xs font-black uppercase tracking-widest mb-1">
                                Total Recibiendo en Caja
                              </p>
                              <p className="text-3xl font-black text-green-600">
                                S/ {payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 📑 B. DESGLOSE EXPRESS INFERIOR CON PRODUCTOS */}
                      {/* 📑 B. DESGLOSE EXPRESS INFERIOR CON PRODUCTOS (VERSIÓN LIMPIA) */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                          🔍 Vista Rápida de Productos de los Lotes Seleccionados:
                        </p>

                        {/* 🟢 SE REMOVIÓ EL CONTENEDOR DE BOTONES REDUNDANTES QUE ABARROTABA LA PANTALLA */}

                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs max-h-56 overflow-y-auto space-y-4">
                          {(() => {
                            // 🟢 SI NO HAY NINGUNA TARJETA MARCADA CON EL CHECK AZUL, MOSTRAMOS EL TEXTO GUÍA
                            if (!selectedGroupCodes || selectedGroupCodes.length === 0) {
                              return <p className="text-gray-400 font-medium text-center py-2">Selecciona al menos un lote de cobro del carrusel superior para auditar sus detalles y abonos.</p>;
                            }

                            // 🟢 MOTOR DE RENDERIZADO INDEPENDIENTE AUTOMÁTICO:
                            return selectedGroupCodes.map((currentCode) => {
                              // Filtramos las ventas del cliente que coincidan exactamente con este código marcado
                              const targetSales = selectedAccount?.sales?.filter((sale: any) => {
                                const code = sale.notes && (sale.notes.startsWith('LOTE-VALORIZADO-') || sale.notes.startsWith('DOC-COBRO-'))
                                  ? sale.notes
                                  : `DIRECTO-${sale.id}`;
                                return code === currentCode;
                              });

                              if (!targetSales || targetSales.length === 0) return null;

                              return (
                                <div key={currentCode} className="bg-white p-3 rounded-xl border border-gray-200/70 shadow-sm space-y-2">
                                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded inline-block">
                                    📦 DETALLE COMPROBANTE: {currentCode.replace('LOTE-VALORIZADO-', 'LOTE-').replace('DOC-COBRO-', 'LOTE-')}
                                  </p>

                                  {targetSales.map((sale: any) => {
                                    // Limpiamos el ID de texto para pasárselo de forma segura al componente satélite
                                    const cleanNumericId = parseInt(String(sale.id).replace('lote_', ''), 10);

                                    return (
                                      <div key={sale.id} className="border-l-2 border-gray-300 pl-2 space-y-1.5">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">
                                          Vale original: {sale.receipt_number || 'N/A'} — Retirado: {sale.created_at ? new Date(sale.created_at).toLocaleDateString("es-PE") : 'Hoy'}
                                        </p>

                                        {sale.items?.map((it: any) => {
                                          // 🟢 Si es el encabezado del vale (unidades en 0), lo pintamos destacado
                                          if (it.quantity === 0) {
                                            return (
                                              <p key={it.id} className="text-blue-600 font-black text-[10px] bg-blue-50/60 px-1.5 py-0.5 rounded inline-block mt-2 uppercase tracking-wide w-full">
                                                {it.product_variant?.product?.name}
                                              </p>
                                            );
                                          }
                                          // Si es un producto real, lo dejamos exactamente con el formato nativo original
                                          return (
                                            <p key={it.id} className="text-gray-600 font-medium mt-0.5 pl-2">
                                              • {it.quantity} und. x {it.product_variant?.product?.name || "Artículo"} (S/ {parseFloat(it.unit_price).toFixed(2)})
                                            </p>
                                          );
                                        })}


                                        {/* 🔒 COMPONENTE AISLADO EN SU PROPIO ARCHIVO: */}
                                        <ValePaymentsExpress saleId={cleanNumericId} />
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>


                      {/* 💵 C. PASARELA MIXTA DINÁMICA DE COBRO */}
                      <div className="space-y-4">
                        {payments.map((payment, index) => (
                          <div key={payment.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="font-bold text-sm text-gray-700">Línea de Pago #{index + 1}</h3>
                              {index > 0 && (
                                <button type="button" onClick={() => removePaymentLine(payment.id)} className="text-red-500 hover:text-red-600 text-xs font-bold">
                                  ❌ Quitar
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                              <div className="md:col-span-4">
                                <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">Método</label>
                                <select
                                  value={payment.method}
                                  onChange={(e) => updatePayment(payment.id, "method", e.target.value)}
                                  className="w-full border border-gray-300 rounded-xl py-2.5 px-3 text-sm bg-white"
                                >
                                  <option value="efectivo">💵 Efectivo</option>
                                  <option value="yape">📱 Yape / Plin</option>
                                  <option value="transferencia">🏦 Transferencia</option>
                                </select>
                              </div>
                              <div className="md:col-span-3">
                                <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">Monto Soles</label>
                                <input
                                  type="number"
                                  step="0.10"
                                  value={payment.amount}
                                  onChange={(e) => updatePayment(payment.id, "amount", e.target.value)}
                                  className="w-full py-2 px-3 border border-gray-300 rounded-xl font-bold text-sm text-right"
                                  placeholder="0.00"
                                />
                              </div>
                              {payment.method === "yape" && (
                                <div className="md:col-span-5">
                                  <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">Cuenta Destino</label>
                                  <select
                                    value={payment.yape_account || ""}
                                    onChange={(e) => updatePayment(payment.id, "yape_account", e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl py-2.5 px-3 text-sm bg-white"
                                  >
                                    <option value="">Seleccionar cuenta...</option>
                                    {yapeAccounts.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                </div>
                              )}
                              {payment.method === "transferencia" && (
                                <div className="md:col-span-5">
                                  <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">Banco Destino</label>
                                  <select
                                    value={payment.bank_account || ""}
                                    onChange={(e) => updatePayment(payment.id, "bank_account", e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl py-2.5 px-3 text-sm bg-white"
                                  >
                                    <option value="">Seleccionar cuenta...</option>
                                    {bankAccounts.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={addPaymentLine} className="text-xs font-black text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2.5 rounded-xl border border-blue-100">
                          ➕ Agregar otro método mixto
                        </button>
                      </div>

                      {/* 🔘 BOTONES DE ACCIÓN PRINCIPALES DE COBRO */}
                      <div className="grid grid-cols-2 gap-3 mt-6">
                        <button
                          type="button"
                          onClick={() => handleAddPayment("print")}
                          disabled={isProcessingPayment}
                          className="bg-gray-900 hover:bg-black text-white font-black py-4 rounded-2xl text-base transition-all disabled:opacity-50"
                        >
                          🖨️ Cobrar e Imprimir
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddPayment("no-print")}
                          disabled={isProcessingPayment}
                          className="bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl text-base transition-all disabled:opacity-50"
                        >
                          ✅ Cobrar sin Imprimir
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-12 border border-dashed rounded-3xl text-center text-gray-400 font-bold bg-gray-50/50 text-sm">
                      👉 Selecciona al menos un lote de cobro del carrusel superior para activar la pasarela de pagos.
                    </div>
                  )}
                </div>
              )}




              {accountTab === "historial" && (
                <div className="space-y-6 p-2">

                  {/* 📊 INDICADORES DE AUDITORÍA COMERCIAL (Métricas en Caliente) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50/60 border border-blue-100 rounded-3xl p-4 flex items-center gap-3">
                      <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-sm"><History size={20} /></div>
                      <div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Días de Pago Promedio</p>
                        <p className="text-xl font-black text-blue-700">{selectedAccount?.metrics?.avg_days_to_pay || 0} Días</p>
                      </div>
                    </div>
                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-3xl p-4 flex items-center gap-3">
                      <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-sm"><CheckCircle size={20} /></div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Documentos Archivados</p>
                        <p className="text-xl font-black text-emerald-700">{selectedAccount?.paid_lotes?.length || 0} Lotes</p>
                      </div>
                    </div>
                    <div className="bg-purple-50/60 border border-purple-100 rounded-3xl p-4 flex items-center gap-3">
                      <div className="p-3 bg-purple-500 text-white rounded-2xl shadow-sm"><FileText size={20} /></div>
                      <div>
                        <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider">Récord Comercial</p>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-lg inline-block mt-1 ${selectedAccount?.metrics?.general_punctuality === "EXCELENTE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-orange-700"
                          }`}>
                          {selectedAccount?.metrics?.general_punctuality || "SIN REGISTROS"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 🔍 PANEL DE FILTRADO EN CALIENTE */}
                  <div className="bg-white border border-gray-200/80 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest shrink-0">
                      🕵️‍♂️ Buscador de Lotes Archivados:
                    </p>
                    <div className="w-full md:w-72">
                      <input
                        type="text"
                        placeholder="Buscar por código de lote (Ej: 2026)..."
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase();
                          const cards = document.querySelectorAll(".paid-lote-card");
                          cards.forEach((card: any) => {
                            const code = card.getAttribute("data-code")?.toLowerCase() || "";
                            card.style.display = code.includes(val) ? "block" : "none";
                          });
                        }}
                        className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-2xl py-2.5 px-3 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* 📜 LISTADO DE TARJETAS HISTÓRICAS PAGADAS COMPACTAS */}
                  <div className="space-y-3">
                    {!selectedAccount?.paid_lotes || selectedAccount.paid_lotes.length === 0 ? (
                      <div className="text-center py-10 bg-white border border-gray-200 rounded-3xl">
                        <p className="text-gray-400 text-sm font-medium">Este cliente no registra lotes cancelados en el historial actualmente.</p>
                      </div>
                    ) : (
                      selectedAccount.paid_lotes.map((lote: any) => {
                        const isExpanded = expandedLoteId === lote.id;
                        return (
                          <div
                            key={lote.id}
                            data-code={lote.notes}
                            className="paid-lote-card bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:border-gray-300 transition-all"
                          >
                            {/* Barra Superior del Acordeón (Gatillo de Clic) */}
                            <div
                              onClick={() => setExpandedLoteId(isExpanded ? null : lote.id)}
                              className="p-4 flex justify-between items-center bg-gray-50/40 cursor-pointer select-none border-b border-gray-100 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400 font-bold text-xs">{isExpanded ? "🔽" : "▶️"}</span>
                                <div>
                                  <p className="text-xs font-black text-gray-800 font-mono flex items-center gap-1.5">
                                    📄 {lote.notes.replace('LOTE-VALORIZADO-', 'LOTE #')}
                                  </p>
                                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                                    Concluido tras <strong className="text-blue-600 font-black">{lote.days_to_pay} {lote.days_to_pay === 1 ? 'día' : 'días'}</strong> de financiamiento.
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${lote.punctuality === "EXCELENTE" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                                  }`}>
                                  ✨ {lote.punctuality}
                                </span>
                                <span className="bg-emerald-600 text-white font-black text-[9px] px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                  S/ {parseFloat(lote.total_amount).toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Cuerpo Interno Desplegable: Solo se renderiza en pantalla si el cajero le da clic */}
                            {isExpanded && (
                              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-white animation-fade-in animate-duration-200">

                                {/* Columna Izquierda: Mercadería */}
                                <div className="bg-gray-50/60 border border-gray-200/50 rounded-xl p-3 space-y-2">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200/60 pb-1">
                                    📦 Resumen de Mercadería Despachada:
                                  </p>
                                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                    {lote.items?.map((it: any) => {
                                      if (it.quantity === 0) {
                                        return (
                                          <p key={it.id} className="text-blue-600 font-black text-[9px] bg-blue-50/80 px-1.5 py-0.5 rounded inline-block mt-1.5 uppercase tracking-wide w-full">
                                            {it.product_variant?.product?.name}
                                          </p>
                                        );
                                      }
                                      return (
                                        <p key={it.id} className="text-gray-600 font-medium pl-2 text-[11px]">
                                          • {it.quantity} und. x {it.product_variant?.product?.name || "Artículo"} (S/ {parseFloat(it.unit_price).toFixed(2)})
                                        </p>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Columna Derecha: Recaudación */}
                                <div className="bg-emerald-50/10 border border-emerald-100 rounded-xl p-3 space-y-2">
                                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest border-b border-emerald-100/60 pb-1">
                                    💰 Línea de Tiempo de Recaudación en Caja:
                                  </p>
                                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                    {lote.payments && lote.payments.length > 0 ? (
                                      lote.payments.map((p: any) => (
                                        <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded-xl border border-emerald-100 text-[10px] shadow-sm">
                                          <div>
                                            <p className="font-bold text-gray-700">{p.description}</p>
                                            <p className="text-[8px] text-gray-400 font-semibold mt-0.5">
                                              📅 {p.date} a las {p.time} hrs — <span className="px-1 bg-gray-100 text-gray-600 rounded font-mono uppercase text-[7px]">{p.method}</span>
                                            </p>
                                          </div>
                                          <span className="font-black text-emerald-600 shrink-0 ml-2">+ S/ {parseFloat(p.amount).toFixed(2)}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-gray-400 text-center py-4 font-medium italic">No se registran transacciones individuales de cobro.</p>
                                    )}
                                  </div>
                                </div>

                              </div>
                            )}
                          </div>
                        );
                      })



                    )}
                  </div>

                  {/* 🔘 BOTÓN DE CONTINGENCIA: CARGAR MÁS LOTES ANTIGUOS */}
                  {selectedAccount?.has_more && (
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem("noslight_token");
                            // Calculamos la siguiente página de deudas antiguas (ej: página 2)
                            const nextPage = Math.floor((selectedAccount.paid_lotes?.length || 0) / 10) + 1;

                            const res = await fetch(
                              `${import.meta.env.VITE_API_URL}/api/credits/customers/${selectedAccount.id}/statement?page=${nextPage}`,
                              { headers: { Authorization: `Bearer ${token}` } }
                            );

                            if (res.ok) {
                              const freshData = await res.json();
                              setSelectedAccount((prev: any) => ({
                                ...prev,
                                has_more: freshData.has_more,
                                // 🟢 CONCATENACIÓN LIMPIA: Fusionamos los 10 nuevos viejos abajo de la lista actual
                                paid_lotes: [...(prev.paid_lotes || []), ...(freshData.paid_lotes || [])]
                              }));
                            }
                          } catch (e) {
                            console.error("Error al paginar historial antiguo", e);
                          }
                        }}
                        className="w-full sm:w-auto text-xs font-black text-gray-600 hover:text-gray-900 bg-white border border-gray-300 shadow-sm px-6 py-3 rounded-2xl transition-all hover:bg-gray-50 flex items-center justify-center gap-1.5 mx-auto"
                      >
                        🔄 Cargar Lotes Más Antiguos
                      </button>
                    </div>
                  )}

                </div>
              )}


              {/* ========================================================= */}
              {/* 🟢 PESTAÑA: CENTRO DE EMISIÓN DE PROFORMAS Y COMPROBANTES  */}
              {/* ========================================================= */}
              {accountTab === "cobranza" && (
                <div className="space-y-6 p-2 text-xs">

                  <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 border-l-4 border-l-amber-500 shadow-sm">
                    <h3 className="text-amber-900 font-black text-sm uppercase tracking-wider">Centro de Despacho Documental</h3>
                    <p className="text-gray-600 font-medium mt-1">
                      Selecciona un documento para generar su reporte detallado en PDF o imprimir su ticket de control.
                    </p>
                  </div>

                  {/* 🔴 SECCIÓN 1: DOCUMENTOS VIGENTES (DEUDAS ACTIVAS) */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest border-b border-gray-200 pb-1">
                      📌 Lotes de Cobro Activos (Cuentas Pendientes):
                    </p>
                    {!selectedAccount?.sales || selectedAccount.sales.filter((l: any) => l.pending_balance > 0).length === 0 ? (
                      <p className="text-gray-400 italic pl-2">No registra deudas pendientes de pago.</p>
                    ) : (
                      selectedAccount.sales.filter((l: any) => l.pending_balance > 0).map((lote: any) => (
                        <div key={lote.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <p className="font-black text-gray-800 font-mono text-xs">{lote.notes.replace('LOTE-VALORIZADO-', 'LOTE #')}</p>
                            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Saldo pendiente: <strong className="text-red-600">S/ {parseFloat(lote.pending_balance).toFixed(2)}</strong> / Total original: S/ {parseFloat(lote.total_amount).toFixed(2)}</p>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => generateDocumentReport(lote, "pdf")}
                              className="flex-1 sm:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1"
                            >
                              📄 Descargar PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => generateDocumentReport(lote, "ticket")}
                              className="flex-1 sm:flex-none bg-gray-900 hover:bg-black text-white font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1"
                            >
                              🖨️ Imprimir Ticket
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 🟢 SECCIÓN 2: DOCUMENTOS ARCHIVADOS (YA PAGADOS) */}
                  <div className="space-y-3 pt-2">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b border-gray-200 pb-1">
                      ✅ Historial de Lotes Cancelados (S/ 0.00):
                    </p>
                    {!selectedAccount?.paid_lotes || selectedAccount.paid_lotes.length === 0 ? (
                      <p className="text-gray-400 italic pl-2">No registra documentos cancelados en el histórico.</p>
                    ) : (
                      selectedAccount.paid_lotes.map((lote: any) => (
                        <div key={lote.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <p className="font-black text-gray-700 font-mono text-xs">{lote.notes.replace('LOTE-VALORIZADO-', 'LOTE #')}</p>
                            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Total Liquidado: <strong className="text-emerald-600">S/ {parseFloat(lote.total_amount).toFixed(2)}</strong> — Concluido en {lote.days_to_pay} días.</p>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => generateDocumentReport(lote, "pdf")}
                              className="flex-1 sm:flex-none bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1"
                            >
                              📄 Descargar PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => generateDocumentReport(lote, "ticket")}
                              className="flex-1 sm:flex-none bg-gray-900 hover:bg-black text-white font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1"
                            >
                              🖨️ Re-Imprimir Ticket
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                </div>
              )}







            </div >
          </div >
        </div >
      )}
    </div >
  );
}
