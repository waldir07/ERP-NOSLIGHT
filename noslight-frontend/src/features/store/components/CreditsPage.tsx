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
  const isAdmin = userObj?.role?.toUpperCase() === "ADMIN";

  // 2. ESTADO INICIAL
  const [activeTab, setActiveTab] = useState<"pendientes" | "cuentas">(
    isAdmin ? "pendientes" : "cuentas"
  );

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
      if (res.ok) setAccounts(await res.json());
    } catch (error) {
      console.error("Error al cargar cuentas", error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };


  // 3. EL USEEFFECT (Exactamente como me mostraste en tu última captura)
  useEffect(() => {
    if (activeTab === "pendientes" && isAdmin) fetchPendingSales();
    if (activeTab === "cuentas") fetchAccounts();
  }, [activeTab]);

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

  // Función actualizada para registrar el abono, abrir gaveta e imprimir opcionalmente
  const handleAddPayment = async (action: "print" | "no-print" = "print") => {
    const totalPaid = payments.reduce(
      (sum, p) => sum + (parseFloat(p.amount) || 0),
      0,
    );

    if (totalPaid <= 0) return alert("Ingresa al menos un monto válido.");

    if (totalPaid > parseFloat(selectedAccount.credit_balance)) {
      return alert(
        "El abono no puede ser mayor a la deuda total (S/ " +
        selectedAccount.credit_balance +
        ").",
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

    // 🟢 DETECTAMOS SI HAY EFECTIVO EN ALGUNA DE LAS LÍNEAS DE PAGO
    const hasEfectivo = validPayments.some((p) => p.method === "efectivo");

    setIsProcessingPayment(true);

    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/credits/customers/${selectedAccount.id}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ payments: validPayments }),
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

        alert("¡Abono registrado con éxito!");

        // Limpiar todo y cerrar modal
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
        setSelectedAccount((prev: any) => ({
          ...prev,
          history: fullData.history || [],
          credit_balance: fullData.current_balance || prev?.credit_balance,
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
        {/* 👇 AQUÍ ESTÁ EL CANDADO VISUAL 👇 */}
        {isAdmin && (
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
        )}
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
        {/* VISTA 1: DESPACHOS PENDIENTES */}
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
                {filteredAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="bg-white border border-gray-200 rounded-3xl p-6 hover:shadow-lg transition-shadow flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-100 text-gray-600 p-3 rounded-2xl">
                          <Users size={24} />
                        </div>
                        <div>
                          <h3
                            className="font-black text-lg text-gray-900 line-clamp-1"
                            title={account.name}
                          >
                            {account.name}
                          </h3>
                          <p className="text-xs font-bold text-gray-400 uppercase">
                            {account.document_number || "Sin DNI/RUC"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-4 flex-1">
                      <p className="text-red-800 text-xs font-bold uppercase tracking-widest mb-1">
                        Deuda Total Actual
                      </p>
                      <p className="text-3xl font-black text-red-600">
                        S/ {parseFloat(account.credit_balance).toFixed(2)}
                      </p>
                    </div>

                    <button
                      onClick={() => openAccountStatement(account)}
                      className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <History size={18} /> Ver Historial y Abonar
                    </button>
                  </div>
                ))}
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
              <button
                onClick={() => setSelectedAccount(null)}
                className="text-gray-400 hover:text-white"
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
              {/* VISTA 1: FORMULARIO DE ABONO CON VUELTO */}
              {accountTab === "abono" && (
                <div className="max-w-3xl mx-auto p-4">
                  {/* Resumen superior - más pequeño */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-2xl p-5 border border-red-100">
                      <p className="text-xs font-bold text-red-500 tracking-widest">
                        DEUDA ACTUAL
                      </p>
                      <p className="text-3xl font-black text-red-600 mt-1">
                        S/{" "}
                        {parseFloat(
                          selectedAccount.credit_balance || "0",
                        ).toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-green-100">
                      <p className="text-xs font-bold text-green-600 tracking-widest">
                        TOTAL RECIBIENDO
                      </p>
                      <p className="text-3xl font-black text-green-600 mt-1">
                        S/{" "}
                        {payments
                          .reduce(
                            (sum, p) => sum + (parseFloat(p.amount) || 0),
                            0,
                          )
                          .toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Métodos de pago - más compactos */}
                  <div className="space-y-4">
                    {payments.map((payment, index) => (
                      <div
                        key={payment.id}
                        className="bg-white border border-gray-200 rounded-2xl p-5"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-bold text-base">
                            Pago #{index + 1}
                          </h3>
                          {index > 0 && (
                            <button
                              onClick={() => removePaymentLine(payment.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <X size={22} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Método */}
                          <div className="md:col-span-4">
                            <label className="block text-xs font-bold text-gray-600 mb-1">
                              MÉTODO
                            </label>
                            <select
                              value={payment.method}
                              onChange={(e) =>
                                updatePayment(
                                  payment.id,
                                  "method",
                                  e.target.value,
                                )
                              }
                              className="w-full border border-gray-300 rounded-2xl py-3 px-4 text-base"
                            >
                              <option value="efectivo">💵 Efectivo</option>
                              <option value="yape">📱 Yape / Plin</option>
                              <option value="transferencia">
                                🏦 Transferencia
                              </option>
                            </select>
                          </div>

                          {/* Monto */}
                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-600 mb-1">
                              MONTO
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">
                                S/
                              </span>
                              <input
                                type="number"
                                step="0.10"
                                value={payment.amount}
                                onChange={(e) =>
                                  updatePayment(
                                    payment.id,
                                    "amount",
                                    e.target.value,
                                  )
                                }
                                className="w-full pl-10 py-3 border border-gray-300 rounded-2xl text-lg font-semibold"
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          {/* Campos según método */}
                          {payment.method === "yape" && (
                            <div className="md:col-span-5">
                              <label className="block text-xs font-bold text-gray-600 mb-1">
                                CUENTA YAPE
                              </label>
                              <select
                                value={payment.yape_account || ""}
                                onChange={(e) =>
                                  updatePayment(
                                    payment.id,
                                    "yape_account",
                                    e.target.value,
                                  )
                                }
                                className="w-full border border-gray-300 rounded-2xl py-3 px-4 text-base"
                              >
                                <option value="">Seleccionar cuenta...</option>
                                <option value="yape_principal">
                                  Yape Principal (+51 999 123 456)
                                </option>
                                <option value="yape_secundaria">
                                  Yape Secundaria (+51 987 654 321)
                                </option>
                              </select>
                            </div>
                          )}

                          {payment.method === "transferencia" && (
                            <div className="md:col-span-5">
                              <label className="block text-xs font-bold text-gray-600 mb-1">
                                CUENTA BANCARIA
                              </label>
                              <select
                                value={payment.bank_account || ""}
                                onChange={(e) =>
                                  updatePayment(
                                    payment.id,
                                    "bank_account",
                                    e.target.value,
                                  )
                                }
                                className="w-full border border-gray-300 rounded-2xl py-3 px-4 text-base"
                              >
                                <option value="">Seleccionar cuenta...</option>
                                <option value="bcp_principal">
                                  BCP - Principal
                                </option>
                                <option value="interbank">Interbank</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addPaymentLine}
                    className="mt-4 text-blue-600 font-medium text-sm flex items-center gap-1"
                  >
                    + Agregar otro método
                  </button>

                  {/* Botones de acción actualizados */}
                  <div className="grid grid-cols-2 gap-3 mt-8">
                    <button
                      onClick={() => handleAddPayment("print")}
                      disabled={
                        isProcessingPayment ||
                        payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) <= 0
                      }
                      className="bg-gray-900 hover:bg-black text-white font-bold text-lg py-5 rounded-3xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      🖨️ Cobrar e Imprimir
                    </button>

                    <button
                      onClick={() => handleAddPayment("no-print")}
                      disabled={
                        isProcessingPayment ||
                        payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) <= 0
                      }
                      className="bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-5 rounded-3xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      ✅ Cobrar sin Imprimir
                    </button>
                  </div>
                </div>
              )}

              {/* VISTA 2: HISTORIAL DETALLADO (EFECTO ACORDEÓN POR DÍAS) */}
              {accountTab === "historial" && (
                <div className="flex flex-col h-full">
                  {/* Cabecera y Filtros */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 px-2 gap-4">
                    <div>
                      <div className="flex gap-2">
                        {/* Cabecera y Filtros (Calendarios) */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 px-2 gap-4">
                          <div className="w-full md:w-auto">
                            <h3 className="font-black text-xl text-gray-800 mb-2">
                              Estado de Cuenta
                            </h3>

                            <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm mb-3">
                              <span className="text-xs font-bold text-gray-400 uppercase">
                                Desde
                              </span>
                              <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                  setStartDate(e.target.value);
                                  openAccountStatement(
                                    selectedAccount,
                                    e.target.value,
                                    endDate,
                                  );
                                }}
                                className="text-gray-700 text-sm font-bold bg-transparent focus:outline-none"
                              />
                              <span className="text-xs font-bold text-gray-400 uppercase ml-2">
                                Hasta
                              </span>
                              <input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                  setEndDate(e.target.value);
                                  openAccountStatement(
                                    selectedAccount,
                                    startDate,
                                    e.target.value,
                                  );
                                }}
                                className="text-gray-700 text-sm font-bold bg-transparent focus:outline-none"
                              />
                            </div>

                            {/* LOS NUEVOS BOTONES DE FILTRO RÁPIDO */}
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setMovementFilter("all")}
                                className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${movementFilter === "all"
                                  ? "bg-gray-900 text-white shadow"
                                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                  }`}
                              >
                                Todos
                              </button>
                              <button
                                onClick={() => setMovementFilter("sales")}
                                className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${movementFilter === "sales"
                                  ? "bg-red-600 text-white shadow"
                                  : "bg-white border border-red-200 text-red-600 hover:bg-red-50"
                                  }`}
                              >
                                Solo Deudas
                              </button>
                              <button
                                onClick={() => setMovementFilter("payments")}
                                className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${movementFilter === "payments"
                                  ? "bg-green-600 text-white shadow"
                                  : "bg-white border border-green-200 text-green-600 hover:bg-green-50"
                                  }`}
                              >
                                Solo Pagos
                              </button>
                              <button
                                onClick={clearAllFilters}
                                className="px-5 py-2 text-sm font-bold rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all flex items-center gap-1.5"
                              >
                                <X size={16} /> Limpiar Filtros
                              </button>
                            </div>
                          </div>

                          <div className="text-right w-full md:w-auto bg-gray-100 p-3 rounded-xl">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                              Saldo Deudor Final
                            </p>
                            <p className="text-2xl font-black text-gray-900">
                              S/{" "}
                              {parseFloat(
                                selectedAccount.credit_balance,
                              ).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 flex-1 overflow-y-auto pb-4 px-2">
                    {isLoadingStatement ? (
                      <div className="flex justify-center items-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 font-bold text-gray-500">
                          Buscando movimientos...
                        </span>
                      </div>
                    ) : getFilteredHistory().length === 0 ? (
                      <p className="text-center text-gray-500 italic mt-10">
                        No hay movimientos con el filtro seleccionado.
                      </p>
                    ) : (
                      getFilteredHistory().map((dayGroup: any) => (
                        <div
                          key={dayGroup.date}
                          className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm transition-all"
                        >
                          {/* Cabecera del Día */}
                          <div
                            onClick={() => toggleDay(dayGroup.date)}
                            className="p-4 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div>
                              <p className="font-black text-gray-900 capitalize flex items-center gap-2">
                                📅{" "}
                                {new Date(
                                  dayGroup.date + "T00:00:00",
                                ).toLocaleDateString("es-PE", {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </p>
                              <div className="flex gap-4 mt-1 text-xs font-bold">
                                {dayGroup.daily_sales > 0 && (
                                  <span className="text-red-600">
                                    Consumos: S/{" "}
                                    {dayGroup.daily_sales.toFixed(2)}
                                  </span>
                                )}
                                {dayGroup.daily_payments > 0 && (
                                  <span className="text-green-600">
                                    Abonos: S/{" "}
                                    {dayGroup.daily_payments.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div
                              className={`p-2 bg-white rounded-full shadow-sm text-gray-500 transition-transform duration-300 ${expandedDays.includes(dayGroup.date)
                                ? "rotate-180"
                                : ""
                                }`}
                            >
                              <ChevronDown size={20} />
                            </div>
                          </div>

                          {/* Movimientos filtrados */}
                          {expandedDays.includes(dayGroup.date) && (
                            <div className="divide-y divide-gray-100 border-t border-gray-200 bg-white">
                              {dayGroup.movements.map((mov: any, i: number) => (
                                <div
                                  key={i}
                                  className="p-4 flex justify-between items-start hover:bg-blue-50/30 transition-colors"
                                >
                                  <div className="flex-1 pr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                      {mov.is_payment ? (
                                        <>
                                          <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                                            💰 {mov.method || "ABONO"}
                                          </span>
                                          <span className="text-[10px] font-black uppercase text-gray-400">
                                            {mov.time}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <Clock size={10} /> {mov.time}
                                          </span>
                                          <span className="text-[10px] font-black uppercase text-red-600">
                                            {mov.type}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <p className="font-bold text-gray-900 leading-tight">
                                      {mov.description}
                                    </p>
                                    {mov.details && (
                                      <p className="text-xs text-gray-500 font-medium mt-1">
                                        {mov.details
                                          .map(
                                            (d: any) =>
                                              `${d.quantity}x ${d.product_variant?.product?.name || "Prod."}`,
                                          )
                                          .join(", ")}
                                      </p>
                                    )}
                                  </div>
                                  <div
                                    className={`font-black text-lg shrink-0 ${mov.is_payment
                                      ? "text-green-600"
                                      : "text-red-600"
                                      }`}
                                  >
                                    {mov.is_payment ? "-" : "+"} S/{" "}
                                    {parseFloat(mov.amount).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* VISTA 3: GENERAR PROFORMA PARA COBRADOR */}
              {accountTab === "cobranza" && (
                <div className="flex flex-col items-center p-8">
                  <div className="bg-white w-full max-w-md border-2 border-dashed border-gray-300 p-6 rounded-xl shadow-inner font-mono text-sm">
                    <h3 className="font-black text-lg mb-1 uppercase text-center text-gray-900">
                      Proforma de Cobro
                    </h3>
                    <p className="text-center font-bold text-gray-700">Cliente: {selectedAccount.name}</p>
                    <p className="text-center text-xs text-gray-400">Fecha consulta: {new Date().toLocaleDateString()}</p>

                    {/* 🟢 SECCIÓN DE DETALLE DE VALES Y ABONOS SIMPLIFICADOS Y LEGIBLES EN PANTALLA */}
                    <div className="border-t border-b border-black my-4 py-3">
                      <p className="font-bold text-xs mb-3 uppercase tracking-wider text-gray-500">Resumen de Movimientos:</p>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {(!selectedAccount.history || selectedAccount.history.flatMap((d: any) => d.movements).length === 0) ? (
                          <p className="text-gray-400 italic text-xs text-center">No hay detalles de movimientos.</p>
                        ) : (
                          selectedAccount.history.flatMap((day: any) =>
                            day.movements.map((mov: any) => ({ ...mov, date: day.date }))
                          ).map((mov: any, idx: number) => {
                            const dDate = new Date(mov.date + "T00:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short" });
                            return (
                              <div key={idx} className="border-b border-gray-50 pb-2 last:border-none">
                                <div className={`flex justify-between font-bold text-sm gap-4 ${mov.is_payment ? 'text-green-600' : 'text-gray-900'}`}>
                                  <span>📅 {dDate} - {mov.is_payment ? `💰 ABONO (${mov.method || 'Efec.'})` : mov.description}</span>
                                  <span className="shrink-0">{mov.is_payment ? '-' : ''} S/ {parseFloat(mov.amount).toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="pb-2">
                      <p className="flex justify-between font-black text-lg text-red-600">
                        <span>TOTAL A PAGAR:</span>
                        <span>
                          S/ {parseFloat(selectedAccount.credit_balance).toFixed(2)}
                        </span>
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-400 text-center mt-2 italic">
                      Favor de cancelar o realizar abono vía Yape/Plin o Efectivo.
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
                    <button
                      onClick={handlePrintProforma}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow transition-colors w-full"
                    >
                      🖨️ Imprimir Ticket (80mm)
                    </button>

                    <button
                      onClick={handlePrintPDFReport}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow transition-colors w-full"
                    >
                      📄 Generar PDF Detallado
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
