import React, { useState, useEffect } from 'react';
import { jsPDF } from "jspdf";

export const SalesHistoryPage = () => {
  // Estados de datos y control
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

  // Estados para la paginación
  const [page, setPage] = useState<number>(1);
  const [lastPage, setLastPage] = useState<number>(1);
  const [totalSalesCount, setTotalSalesCount] = useState(0);

  // Estados para los Filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saleType, setSaleType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 🔥 SOLUCIÓN AL RETO: Estado intermedio para el Debounce del buscador
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 🛠️ NUEVOS FILTROS AVANZADOS POR ATRIBUTOS DE PRODUCTO
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [amperage, setAmperage] = useState('');
  const [polarity, setPolarity] = useState('');


  // Resumen de totales (KPIs)
  const [totals, setTotals] = useState({ cash: 0, electronic: 0, credit: 0, grandTotal: 0 });


  // Estados para el Modal de Cambios y Devoluciones
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [saleToExchange, setSaleToExchange] = useState<any>(null);

  // Aquí guardaremos qué productos devuelve y en qué estado
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [returnCondition, setReturnCondition] = useState<'good' | 'damaged'>('good');

  // Estados para los NUEVOS productos que el cliente se lleva
  const [newItems, setNewItems] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  const [exchangePaymentMethod, setExchangePaymentMethod] = useState('efectivo');
  const [isProcessingExchange, setIsProcessingExchange] = useState(false);


  const [currentPage, setCurrentPage] = useState(1);



  // 🟢 NUEVO ESTADO PARA LA CUENTA DE DESTINO
  const [exchangePaymentDestination, setExchangePaymentDestination] = useState('Caja Principal');

  const filtrarHoy = () => {
    const hoy = new Date().toISOString().split('T')[0];
    setStartDate(hoy);
    setEndDate(hoy);
    setPage(1); // <-- Número puro, sin comillas
  };

  const filtrarAyer = () => {
    const ayerDate = new Date();
    ayerDate.setDate(ayerDate.getDate() - 1);
    const ayer = ayerDate.toISOString().split('T')[0];
    setStartDate(ayer);
    setEndDate(ayer);
    setPage(1); // <-- Número puro, sin comillas
  };

  // EFECTO DEBOUNCE: Retarda la actualización de la búsqueda real por 400 milisegundos
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer); // Limpia el temporizador si el usuario sigue escribiendo
  }, [searchQuery]);

  // Escucha todos los filtros estables para recargar la tabla desde Laravel
  useEffect(() => {
    fetchSalesData();
  }, [page, startDate, endDate, saleType, debouncedSearch, brand, model, amperage, polarity, searchQuery, currentPage]);



  const fetchSalesData = async () => {
    setLoading(true);
    try {
      // 1. Jalamos el token exacto que usa tu sistema para estar logueado
      const token = localStorage.getItem("noslight_token");

      // 2. Armamos los parámetros para el paginado y filtros
      const params = new URLSearchParams({
        page: page.toString(),
        start_date: startDate,
        end_date: endDate,
        sale_type: saleType,
        search: debouncedSearch, // Enviamos el texto limpio y pausado
        brand: brand,
        model: model,
        amperage: amperage,
        polarity: polarity
      });

      // 3. Hacemos el fetch nativo apuntando directo al puerto 8000 con los headers correctos
      const response = await fetch(// ASÍ DEBE QUEDAR EDITADO:
        `${import.meta.env.VITE_API_URL}/api/sales?${params.toString()}&page=${currentPage}`
        , {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${token}` // <-- El candado de seguridad vital
          }
        });

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.status}`);
      }

      const result = await response.json();

      // 4. Inyectamos las variables en tu hermosa interfaz
      setSales(result.sales.data || []);
      setTotalSalesCount(result.sales.total || 0);
      setLastPage(result.sales.last_page || 1);
      setTotals({
        cash: parseFloat(result.kpis.cash) || 0,
        electronic: parseFloat(result.kpis.electronic) || 0,
        credit: parseFloat(result.kpis.credit) || 0,
        grandTotal: parseFloat(result.kpis.grandTotal) || 0
      });
      console.log("caguederyza", result.sales.data);

    } catch (error) {
      console.error("❌ Error cargando el historial dinámico:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 ACCIÓN: FUNCIÓN DE LIMPIEZA TOTAL DE FILTROS (X)
  const clearAllFilters = () => {
    setStartDate('');
    setEndDate('');
    setSaleType('');
    setSearchQuery('');
    setBrand('');
    setModel('');
    setAmperage('');
    setPolarity('');
    setPage(1);
  };

  // =========================================================================
  // 🔥 ACCIÓN 1: REIMPRIMIR TICKET TÉRMICO (Invisible + Autocierre)
  // =========================================================================
  const printTicket = (sale: any) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.top = "-9999px";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const customerName = sale.customer ? sale.customer.name : "Público General";

    let paymentsSectionHTML = "";
    if (sale.saleType === "credito") {
      paymentsSectionHTML = `<div class="bold" style="margin-top: 6px; font-size: 13px;">CONDICIÓN: VENTA A CRÉDITO</div>`;
    } else {
      paymentsSectionHTML = `<div class="bold" style="margin-top: 6px; font-size: 11px;">PAGOS APLICADOS (NETO):</div>`;

      // 🟢 USAMOS EL NUEVO ARRAY INTELIGENTE
      sale.payments_net?.forEach((p: any) => {
        paymentsSectionHTML += `
          <div class="item" style="font-size: 11px; padding-left: 6px;">
            <span>• ${p.method.toUpperCase()} ${p.is_difference ? '<br><span style="font-size:9px; color:#555;">(Dif. Cambio)</span>' : ''}</span>
            <span>S/ ${p.amount.toFixed(2)}</span>
          </div>
        `;
      });

      // 🟢 Mencionamos el vuelto como una nota informativa, no como una resta activa
      if (sale.vueltoReal > 0) {
        paymentsSectionHTML += `
          <div class="center" style="font-size: 10px; margin-top: 6px; border-top: 1px dotted #ccc; padding-top: 4px;">
            Nota: Vuelto orig. entregado S/ ${sale.vueltoReal.toFixed(2)}
          </div>
        `;
      }
    }

    const ticketHTML = `
      <html>
      <head>
        <title>Ticket ${sale.receipt_number}</title>
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
        <div class="center bold" style="font-size:15px;">NOSLIGHT STORE</div>
        <div class="center">Reimpresión de Ticket</div>
        <div class="center">${new Date(sale.created_at).toLocaleDateString('es-PE')} - ${new Date(sale.created_at).toLocaleTimeString('es-PE')}</div>
        <hr>
        <div>Ticket: ${sale.receipt_number}</div>
        <div>Cliente: ${customerName}</div>
        <hr>
        ${sale.items.map((item: any) => `
          <div class="item">
            <span>${item.quantity} × ${item.name}</span>
          </div>
          <div class="item" style="font-size:11px;">
            <span class="right">S/ ${item.price.toFixed(2)}</span>
            <span class="right">S/ ${(item.quantity * item.price).toFixed(2)}</span>
          </div>
        `).join("")}
        <hr>
        <div class="item bold" style="font-size:15px;">
          <span>TOTAL</span>
          <span>S/ ${sale.totalAmount.toFixed(2)}</span>
        </div>
        ${paymentsSectionHTML}
        <hr>
        <div class="center" style="margin-top:12px; font-size:11px;">Copia de Comprobante Interno</div>
      </body>
      </html>
    `;

    iframeDoc.write(ticketHTML);
    iframeDoc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  };

  // =========================================================================
  // 📄 ACCIÓN 2: DESCARGAR COMPROBANTE PDF ADMINISTRATIVO (Formato A4)
  // =========================================================================
  const downloadPDF = (sale: any) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Encabezado Estilizado (se mantiene igual)
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("NOSLIGHT STORE", 15, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Soluciones Eléctricas e Industriales", 15, 25);
    doc.text("Reporte Operativo de Venta", 15, 30);

    // Recuadro del Número de Vale
    doc.setFillColor(255, 255, 255);
    doc.rect(140, 10, 55, 20, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("VALE DE EMISIÓN", 145, 17);
    doc.setTextColor(220, 38, 38);
    doc.text(sale.receipt_number, 145, 25);

    // Datos de la Transacción
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("DETALLES DEL CLIENTE", 15, 55);
    doc.text("INFORMACIÓN GENERAL", 120, 55);

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 57, 95, 57);
    doc.line(120, 57, 195, 57);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Cliente: ${sale.customer ? sale.customer.name : 'Público General'}`, 15, 64);
    doc.text(`ID Cliente: ${sale.customer_id || 'N/A'}`, 15, 70);

    doc.text(`Fecha/Hora: ${new Date(sale.created_at).toLocaleString('es-PE')}`, 120, 64);
    doc.text(`Condición: ${sale.saleType.toUpperCase()}`, 120, 70);

    // Tabla de Productos
    let currentY = 85;
    doc.setFillColor(240, 242, 245);
    doc.rect(15, currentY, 180, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Descripción del Producto", 17, currentY + 6);
    doc.text("Cant.", 130, currentY + 6);
    doc.text("P. Unit", 150, currentY + 6);
    doc.text("Subtotal", 175, currentY + 6);

    doc.setFont("helvetica", "normal");
    sale.items.forEach((item: any) => {
      currentY += 10;
      doc.text(item.name, 17, currentY + 5);
      doc.text(item.quantity.toString(), 132, currentY + 5);
      doc.text(`S/ ${item.price.toFixed(2)}`, 150, currentY + 5);
      doc.text(`S/ ${(item.quantity * item.price).toFixed(2)}`, 175, currentY + 5);
      doc.line(15, currentY + 8, 195, currentY + 8);
    });

    // ====================== NUEVA SECCIÓN: PAGOS CLAROS (NETO + DETALLE DE CAJA) ======================
    currentY += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("MÉTODOS DE PAGO APLICADOS A LA VENTA (MONTO NETO)", 15, currentY);
    currentY += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    sale.payments_net?.forEach((p: any) => {
      currentY += 8;
      doc.text(`• ${p.method.toUpperCase()} (${p.destination})`, 20, currentY);
      doc.text(`S/ ${p.amount.toFixed(2)}`, 170, currentY, { align: "right" });
    });

    // ====================== DETALLE OPERATIVO DE CAJA (lo que realmente entregó el cliente) ======================
    // ====================== NOTA OPERATIVA DE VUELTO ======================
    if (sale.vueltoReal > 0) {
      currentY += 12;
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text(`* Nota Contable: En la transacción original de este comprobante se entregó un vuelto de S/ ${sale.vueltoReal.toFixed(2)}.`, 15, currentY);
      doc.setTextColor(50, 50, 50);
    }

    // Total General
    currentY += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("TOTAL GENERAL:", 130, currentY);
    doc.text(`S/ ${sale.totalAmount.toFixed(2)}`, 172, currentY);

    // Guardar
    doc.save(`Vale_${sale.receipt_number}.pdf`);
  };



  const toggleRow = (id: number) => {
    setExpandedSaleId(expandedSaleId === id ? null : id);
  };

  // 3. BUSCADOR CON FILTRO EXACTO (Basado en tu Consola)
  const searchProductsForExchange = async (query: string) => {
    setProductSearch(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearchingProducts(true);
    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/products?search=${query}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        let results = Array.isArray(data) ? data : (data.data || []);

        // 🎯 FILTRO QUIRÚRGICO: Solo busca en Nombre, Código o Marca
        const lowerQuery = query.toLowerCase().trim();
        let filtered = results.filter((p: any) => {
          const prodName = (p.name || '').toLowerCase();
          const baseCode = (p.base_code || '').toLowerCase();
          const brand = (p.brand || '').toLowerCase();

          return prodName.includes(lowerQuery) ||
            baseCode.includes(lowerQuery) ||
            brand.includes(lowerQuery);
        });

        // 🟢 NUEVO: DEDUPLICADOR
        // Eliminamos repetidos basándonos en el nombre del producto
        const uniqueResults = Array.from(new Map(filtered.map((item: any) => [item.name, item])).values());

        setSearchResults(uniqueResults);
      }
    } catch (error) {
      console.error("Error buscando productos:", error);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  /// 2. FUNCIÓN PARA ENCONTRAR EL PRECIO REAL (Ahora busca tu cost_price)
  const getRealPrice = (prod: any) => {
    return parseFloat(
      prod.cost_price ||         // 🟢 ¡AQUÍ ESTÁ TU PRECIO REAL!
      prod.sale_price ||
      prod.price ||
      prod.unit_price ||
      prod.base_price ||
      prod.product?.cost_price || // Por si viene dentro de una relación
      0
    );
  };

  // 3. Función para agregar al carrito
  const addNewItemToExchange = (product: any) => {
    const exists = newItems.find(item => item.id === product.id);
    if (exists) {
      setNewItems(newItems.map(item => item.id === product.id ? { ...item, exchange_qty: item.exchange_qty + 1 } : item));
    } else {
      // Usamos el cazador de precios
      setNewItems([...newItems, { ...product, exchange_qty: 1, price: getRealPrice(product) }]);
    }
    setProductSearch('');
    setSearchResults([]);
  };

  // 🟢 4. NUEVA FUNCIÓN: Permite editar el precio manualmente
  const updateNewItemPrice = (id: number, newPrice: string) => {
    setNewItems(newItems.map(item =>
      item.id === id ? { ...item, price: parseFloat(newPrice) || 0 } : item
    ));
  };

  // 🖨️ FUNCIÓN PARA IMPRIMIR EL VALE A FAVOR
  const printStoreCreditTicket = (storeCredit: any, customerName: string) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.top = "-9999px";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const ticketHTML = `
      <html>
      <head>
        <title>Vale a Favor</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: monospace; font-size: 13px; width: 300px; margin: 0 auto; padding: 10px; line-height: 1.4; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          hr { border: 1px dashed #000; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size:16px;">MI ERP - SISTEMA</div>
        <div class="center bold" style="font-size:14px; margin-top:5px;">*** VALE A FAVOR ***</div>
        <div class="center">${new Date().toLocaleDateString("es-PE")} ${new Date().toLocaleTimeString("es-PE")}</div>
        <hr>
        <div>Cliente: ${customerName}</div>
        <hr>
        <div class="center" style="font-size:12px; margin-bottom:10px;">
            Por diferencia de cambio, se emite el siguiente saldo a favor:
        </div>
        
        <div class="center bold" style="font-size:26px; border: 2px dashed #000; padding: 12px; margin: 10px 0;">
            S/ ${parseFloat(storeCredit.amount).toFixed(2)}
        </div>
        
        <div class="center" style="font-size:12px; margin-top: 15px;">CÓDIGO DE CANJE:</div>
        <div class="center bold" style="font-size:22px; letter-spacing: 2px; margin-bottom: 10px;">
            ${storeCredit.code}
        </div>
        
        <hr>
        <div class="center" style="font-size:11px;">
            Válido para su próxima compra.<br>
            Presente este ticket en caja.
        </div>
      </body>
      </html>
    `;

    iframeDoc.write(ticketHTML);
    iframeDoc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  };


  const handleProcessExchange = async () => {
    const totalDevuelto = returnItems.reduce((sum, item) => sum + (item.return_qty * item.price), 0);
    const totalNuevo = newItems.reduce((sum, item) => sum + (item.exchange_qty * item.price), 0);
    const diferencia = totalNuevo - totalDevuelto;

    if (totalDevuelto === 0) {
      alert("Debes seleccionar al menos un producto para devolver.");
      return;
    }

    setIsProcessingExchange(true);
    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(import.meta.env.VITE_API_URL + "/api/exchanges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          sale_id: saleToExchange.id,
          return_items: returnItems,
          new_items: newItems,
          condition: returnCondition,
          payment_method: diferencia > 0 ? exchangePaymentMethod : null,
          // 🟢 ENVIAMOS EL DESTINO DINÁMICO SELECTO
          payment_destination: diferencia > 0 ? exchangePaymentDestination : null
        })
      });

      const data = await res.json();

      if (res.ok) {
        // ¿Debe pagar en efectivo? ¡Abre la gaveta!
        if (diferencia > 0 && exchangePaymentMethod === 'efectivo') {
          console.log("🟢 Abriendo gaveta por pago de diferencia...");
          fetch("http://localhost:9090/abrir-gaveta").catch(() => { });
        }



        // ¿Se generó un vale? Avisamos
        if (data.store_credit) {
          alert(`✅ Operación exitosa.\nSe generó un VALE por S/ ${data.store_credit.amount}\nCódigo: ${data.store_credit.code}`);

          // 🟢 IMPRIME EL VALE AUTOMÁTICAMENTE
          printStoreCreditTicket(
            data.store_credit,
            saleToExchange.customer?.name || 'Público General'
          );
        } else {
          alert("✅ " + data.message);
        }

        // Limpiar y refrescar
        setExchangeModalOpen(false);
        setSaleToExchange(null);
        setNewItems([]);
        fetchSalesData(); // Recargamos la tabla
      } else {
        alert("Error: " + (data.message || "No se pudo procesar la operación"));
      }
    } catch (error) {
      alert("Error de conexión al procesar el cambio.");
    } finally {
      setIsProcessingExchange(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen text-gray-800">

      {/* 🌟 ENCABEZADO */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Historial de Transacciones</h1>
        <p className="text-sm text-gray-500 mt-1">Monitorea, filtra y reimprime los comprobantes de la tienda.</p>
      </div>

      {/* 📊 TARJETAS KPI (RESUMEN RÁPIDO) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase">Ventas Efectivo</p>
            <h3 className="text-xl font-bold text-gray-700 mt-1">S/ {totals.cash.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-green-600">💸</div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase">Yape / Plin / Transf.</p>
            <h3 className="text-xl font-bold text-gray-700 mt-1">S/ {totals.electronic.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">📱</div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase">Por Cobrar (Créditos)</p>
            <h3 className="text-xl font-bold text-gray-700 mt-1">S/ {totals.credit.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600">⏳</div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 bg-gradient-to-br from-indigo-50 to-white flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-indigo-500 uppercase">Caja Total Bruta</p>
            <h3 className="text-2xl font-black text-indigo-950 mt-1">S/ {totals.grandTotal.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-indigo-600 rounded-lg text-white font-bold">S/</div>
        </div>
      </div>

      {/* 🛠️ CONTROL DE FILTROS AVANZADOS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Rango de Fechas */}
          <div className="flex items-center bg-gray-50 border rounded-lg px-2 py-1.5 text-sm">
            <span className="text-gray-400 mr-2">📅 Desde:</span>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="bg-transparent focus:outline-none text-gray-700" />
          </div>
          <div className="flex items-center bg-gray-50 border rounded-lg px-2 py-1.5 text-sm">
            <span className="text-gray-400 mr-2">📅 Hasta:</span>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="bg-transparent focus:outline-none text-gray-700" />
          </div>

          {/* Condición de Venta */}
          <select
            value={saleType}
            onChange={(e) => { setSaleType(e.target.value); setPage(1); }}
            className="bg-gray-50 border rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none"
          >
            <option value="">Todas las condiciones</option>
            <option value="contado">Al Contado</option>
            <option value="credito">A Crédito</option>
          </select>

          <button
            type="button"
            onClick={filtrarHoy}
            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-semibold hover:bg-blue-100 transition-colors border border-blue-200"
          >
            📅 Hoy
          </button>

          <button
            type="button"
            onClick={filtrarAyer}
            className="px-4 py-2 bg-gray-50 text-gray-600 rounded-md text-sm font-semibold hover:bg-gray-100 transition-colors border border-gray-200"
          >
            ⏪ Ayer
          </button>

          {/* 🛑 BOTÓN DE BORRADO DE FILTROS (X) */}
          <button
            onClick={clearAllFilters}
            title="Limpiar todos los filtros"
            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg border border-red-200 transition-all text-sm font-bold px-3 focus:outline-none"
          >
            ✕ Borrar
          </button>

          {/* ⚙️ BOTÓN DE FILTRADO AVANZADO */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-all focus:outline-none ${showAdvanced ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            ⚙️ {showAdvanced ? 'Ocultar Avanzado' : 'Filtrado Avanzado'}
          </button>

        </div>



        {/* Buscador de Criterio General (Estable con Debounce) */}
        <div className="w-full md:w-56 flex items-center bg-gray-50 border rounded-lg px-3 py-1.5 text-sm">
          <input
            type="text"
            placeholder="Buscar cliente o N° ticket..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="bg-transparent w-full focus:outline-none text-gray-700"
          />
          <span className="text-gray-400">🔍</span>
        </div>

        {/* 🗃️ PANEL DESPLEGABLE: COMPONENTES TÉCNICOS DE PRODUCTO */}
        {showAdvanced && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-dashed border-gray-200 bg-gray-50/50 p-4 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Marca del Producto</label>
              <input type="text" placeholder="Ej: Capsa, Bosch..." value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1); }} className="w-full bg-white border rounded-lg p-2 text-sm focus:outline-none text-gray-700" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Modelo / Código</label>
              <input type="text" placeholder="Ej: NS40, DIN75..." value={model} onChange={(e) => { setModel(e.target.value); setPage(1); }} className="w-full bg-white border rounded-lg p-2 text-sm focus:outline-none text-gray-700" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Amperaje (Ah)</label>
              <input type="text" placeholder="Ej: 11X, 13X, 25A..." value={amperage} onChange={(e) => { setAmperage(e.target.value); setPage(1); }} className="w-full bg-white border rounded-lg p-2 text-sm focus:outline-none text-gray-700" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Polaridad / Tipo</label>
              <input type="text" placeholder="Ej: Izquierda, Derecha..." value={polarity} onChange={(e) => { setPolarity(e.target.value); setPage(1); }} className="w-full bg-white border rounded-lg p-2 text-sm focus:outline-none text-gray-700" />
            </div>
          </div>
        )}
      </div>

      {/* 📋 TABLA INTERACTIVA CON LOS NUEVOS BOTONES SIMULTÁNEOS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="p-4 w-12"></th>
                <th className="p-4">Ticket ID</th>
                <th className="p-4">Fecha y Hora</th>
                <th className="p-4">Cliente</th>
                <th className="p-4 text-center">Condición</th>
                <th className="p-4 text-right">Monto Total</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Cargando transacciones...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">No se encontraron ventas.</td></tr>
              ) : sales.map((sale: any) => (
                <React.Fragment key={sale.id}>
                  <tr className={`hover:bg-gray-50/50 transition-colors ${expandedSaleId === sale.id ? 'bg-indigo-50/20' : ''}`}>
                    <td className="p-4 text-center">
                      <button onClick={() => toggleRow(sale.id)} className="text-gray-400 font-bold focus:outline-none">
                        {expandedSaleId === sale.id ? '▲' : '▼'}
                      </button>
                    </td>
                    <td className="p-4 font-mono font-bold text-gray-600">{sale.receipt_number}</td>
                    <td className="p-4 text-gray-500">{new Date(sale.created_at).toLocaleString('es-PE')}</td>
                    <td className="p-4 font-semibold text-gray-700">{sale.customer?.name || '👤 Público General'}</td>
                    {/* NUEVO CÓDIGO CON LOGO OFICIAL DE YAPE EN SVG */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2.5">
                        {sale.saleType === 'credito' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-yellow-100 text-yellow-800">
                            Crédito
                          </span>
                        ) : (
                          <>
                            {sale.payments_net && sale.payments_net.length > 0 ? (
                              sale.payments_net.map((p: any, idx: number) => {
                                const method = p.method ? p.method.toLowerCase() : '';

                                // 💵 CONDICIÓN PARA EFECTIVO
                                if (method.includes('efectivo')) {
                                  return (
                                    <span key={idx} title="Efectivo" className="text-xl filter drop-shadow-sm cursor-help">
                                      💵
                                    </span>
                                  );
                                }

                                // 📱 CONDICIÓN PARA YAPE / PLIN (CON LOGO OFICIAL DE YAPE)
                                if (method.includes('yape') || method.includes('plin')) {
                                  return (
                                    <div key={idx} title="Yape / Plin" className="flex items-center justify-center w-6 h-6 bg-[#9117A0] rounded-md p-1 shadow-sm cursor-help transition-transform hover:scale-110">
                                      <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
                                        {/* Icono vectorial simplificado: Burbuja de texto + S/ */}
                                        <path d="M50,5 C25.1,5 5,23.1 5,45.5 C5,56.8 10.1,67 18.3,74.1 L12,92 L32.3,84.7 C37.8,86.9 43.8,88 50,88 C74.9,88 95,69.9 95,47.5 C95,25.1 74.9,5 50,5 Z" />
                                        <text x="50" y="62" fontStyle="normal" fontWeight="900" fontSize="42" fontFamily="Arial, sans-serif" textAnchor="middle" fill="#00D2C4">S/</text>
                                      </svg>
                                    </div>
                                  );
                                }

                                // 💳 CONDICIÓN PARA TRANSFERENCIA
                                if (method.includes('transferencia') || method.includes('banco') || method.includes('bcp')) {
                                  return (
                                    <span key={idx} title="Transferencia" className="text-xl filter drop-shadow-sm cursor-help">
                                      💳
                                    </span>
                                  );
                                }

                                return (
                                  <span key={idx} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-bold capitalize">
                                    {p.method}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-green-100 text-green-800">
                                Contado
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-right font-extrabold text-gray-900 text-base">S/ {sale.totalAmount.toFixed(2)}</td>

                    {/* 🛠️ COLUMNA ACCIONES RE-DISEÑADA SIMULTÁNEA */}
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">

                        {/* 🟢 NUEVO BOTÓN DE CAMBIO / DEVOLUCIÓN */}
                        <button
                          onClick={() => {
                            setSaleToExchange(sale);
                            // Preparamos el array de devoluciones en 0
                            setReturnItems(sale.items.map((item: any) => ({ ...item, return_qty: 0 })));
                            setExchangeModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-sm transition-all focus:outline-none"
                        >
                          🔄 <span>Cambio</span>
                        </button>

                        <button
                          onClick={() => printTicket(sale)}
                          className="inline-flex items-center gap-1 bg-white hover:bg-gray-100 text-gray-700 border rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-all focus:outline-none"
                        >
                          🖨️ <span>Ticket</span>
                        </button>
                        <button
                          onClick={() => downloadPDF(sale)}
                          className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-all focus:outline-none"
                        >
                          📄 <span>PDF</span>
                        </button>
                      </div>
                    </td>

                  </tr>

                  {/* Fila Expandible Detalle Desglose */}
                  {expandedSaleId === sale.id && (
                    <tr className="bg-gray-50/75">
                      <td colSpan={7} className="p-4 pl-16 border-t border-b border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-600">
                          <div>
                            <h4 className="font-bold text-gray-500 uppercase tracking-wider mb-2">Productos:</h4>
                            <div className="bg-white rounded-lg border divide-y overflow-hidden shadow-sm">
                              {sale.items?.map((item: any, idx: number) => (
                                <div key={idx} className="p-2.5 flex justify-between items-center">
                                  <span><strong className="text-gray-800">{item.quantity}x</strong> {item.name}</span>
                                  <span className="font-semibold text-gray-700">S/ ${(item.quantity * item.price).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-500 uppercase tracking-wider mb-2">Desglose Financiero:</h4>
                            <div className="bg-white rounded-lg border p-3 shadow-sm space-y-2">
                              {sale.saleType === 'credito' ? (
                                <p className="text-yellow-700 font-medium italic">Venta guardada en cuentas por cobrar al crédito.</p>
                              ) : (
                                <>
                                  <div className="font-semibold text-gray-400 pb-1 border-b">Métodos de Pago:</div>
                                  {sale.payments_net?.map((p: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-gray-700 pl-2">
                                      <span className="capitalize">• {p.method} ({p.destination})</span>
                                      <span className="font-bold">S/ {p.amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

      </div>


      {/* BOTONES DE PAGINACIÓN AL PIE DE LA TABLA (COMPLETAMENTE NUMÉRICO Y ORDENADO) */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4 rounded-lg shadow-sm">

        {/* Vista para Celulares (Mobile) */}
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, lastPage))}
            disabled={page === lastPage}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>

        {/* Vista para Computadoras (Desktop) */}
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Mostrando registros de la página <span className="font-semibold text-blue-600">{page}</span> de <span className="font-medium text-gray-500">{lastPage}</span>
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex items-center -space-x-px rounded-md shadow-sm gap-2" aria-label="Pagination">

              {/* Botón Anterior */}
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ⏪ Anterior
              </button>

              {/* Indicador de Páginas Central */}
              <span className="relative inline-flex items-center border border-gray-300 bg-blue-50 px-4 py-2 rounded-md text-sm font-bold text-blue-600 shadow-sm">
                {page} / {lastPage}
              </span>

              {/* Botón Siguiente */}
              <button
                onClick={() => setPage((prev) => Math.min(prev + 1, lastPage))}
                disabled={page === lastPage}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente ⏩
              </button>

            </nav>
          </div>
        </div>
      </div>





      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Aquí renderizas tus filas con sales.map de forma habitual */}
        <div className="p-4 text-xs text-gray-400 font-mono">Panel Conectado y Sincronizado en Tiempo Real</div>
      </div>

      {/* ========================================================= */}
      {/* 🔄 MODAL DE CAMBIOS Y DEVOLUCIONES */}
      {/* ========================================================= */}
      {exchangeModalOpen && saleToExchange && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">

            {/* Cabecera */}
            <div className="bg-red-600 p-5 flex justify-between items-center text-white shrink-0">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2">
                  🔄 Centro de Cambios y Devoluciones
                </h2>
                <p className="text-red-100 text-sm mt-1">
                  Ticket Original: <span className="font-mono font-bold">{saleToExchange.receipt_number}</span> • Cliente: {saleToExchange.customer?.name || 'Público General'}
                </p>
              </div>
              <button onClick={() => setExchangeModalOpen(false)} className="text-red-200 hover:text-white transition-colors">
                ✕
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col md:flex-row gap-6">

              {/* Columna Izquierda: Lo que el cliente DEVUELVE */}
              <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">1. ¿Qué producto está devolviendo?</h3>

                <div className="space-y-3">
                  {returnItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="flex-1">
                        <p className="font-bold text-sm text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">Compró: {item.quantity} und. | Precio: S/ {item.price.toFixed(2)}</p>
                      </div>

                      {/* Controles de cantidad a devolver */}
                      <div className="flex items-center gap-3 bg-white border rounded-lg p-1">
                        <button
                          onClick={() => {
                            const newItems = [...returnItems];
                            if (newItems[idx].return_qty > 0) newItems[idx].return_qty--;
                            setReturnItems(newItems);
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-md font-bold text-gray-600"
                        >-</button>
                        <span className="w-4 text-center font-bold text-red-600">{item.return_qty}</span>
                        <button
                          onClick={() => {
                            const newItems = [...returnItems];
                            if (newItems[idx].return_qty < item.quantity) newItems[idx].return_qty++;
                            setReturnItems(newItems);
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-md font-bold text-gray-600"
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Motivo de Devolución */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="font-bold text-sm text-gray-700 mb-2">2. Estado de la mercadería devuelta:</h4>
                  <div className="flex gap-3">
                    <label className={`flex-1 p-3 border rounded-xl cursor-pointer transition-all ${returnCondition === 'good' ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'bg-white hover:bg-gray-50'}`}>
                      <input type="radio" name="condition" className="sr-only" checked={returnCondition === 'good'} onChange={() => setReturnCondition('good')} />
                      <p className="font-bold text-green-700 text-sm">✅ Buen Estado</p>
                      <p className="text-[10px] text-gray-500 leading-tight mt-1">Regresa al estante de ventas.</p>
                    </label>
                    <label className={`flex-1 p-3 border rounded-xl cursor-pointer transition-all ${returnCondition === 'damaged' ? 'bg-red-50 border-red-500 ring-1 ring-red-500' : 'bg-white hover:bg-gray-50'}`}>
                      <input type="radio" name="condition" className="sr-only" checked={returnCondition === 'damaged'} onChange={() => setReturnCondition('damaged')} />
                      <p className="font-bold text-red-700 text-sm">⚠️ Dañado / Garantía</p>
                      <p className="text-[10px] text-gray-500 leading-tight mt-1">Se envía al almacén de Mermas.</p>
                    </label>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Lo que el cliente SE LLEVA (NUEVO) */}
              <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">3. ¿Qué producto nuevo se lleva?</h3>

                {/* Mini Buscador */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Escribe el código o nombre..."
                    value={productSearch}
                    onChange={(e) => searchProductsForExchange(e.target.value)}
                    className="w-full bg-gray-50 border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />

                  {/* Resultados de búsqueda flotantes */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 shadow-2xl rounded-lg mt-1 max-h-48 overflow-y-auto z-10 divide-y divide-gray-100">
                      {searchResults.map((prod: any) => (
                        <div
                          key={prod.id}
                          onClick={() => addNewItemToExchange(prod)}
                          className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-bold text-gray-700 text-xs">{prod.name}</span>
                          {/* 🟢 Mostramos el precio real cazado de la BD */}
                          <span className="text-blue-600 font-bold text-xs bg-blue-50 px-2 py-1 rounded">S/ {getRealPrice(prod).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Carrito de Nuevos Productos */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {newItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <p className="text-xs text-center mt-4">No se han agregado productos nuevos.<br />(Si dejas esto vacío, se creará un Vale a favor por el total devuelto).</p>
                    </div>
                  ) : (
                    newItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-blue-50/50 p-3 rounded-lg border border-blue-200 shadow-sm">
                        <div className="flex-1 pr-2">
                          <p className="font-bold text-sm text-gray-800 leading-tight mb-2">{item.name}</p>

                          {/* 🟢 NUEVO: PRECIO EDITABLE */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-blue-600 font-bold">P. Unit: S/</span>
                            <input
                              type="number"
                              step="0.10"
                              value={item.price}
                              onChange={(e) => updateNewItemPrice(item.id, e.target.value)}
                              onFocus={(e) => e.target.select()} // Selecciona todo al hacer clic
                              className="w-20 bg-white border border-blue-300 rounded px-1.5 py-0.5 text-sm font-black text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                          </div>

                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2 bg-white border rounded-lg p-1 shadow-sm">
                            <button
                              onClick={() => {
                                if (item.exchange_qty === 1) {
                                  setNewItems(newItems.filter(i => i.id !== item.id));
                                } else {
                                  setNewItems(newItems.map(i => i.id === item.id ? { ...i, exchange_qty: i.exchange_qty - 1 } : i));
                                }
                              }}
                              className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-600 font-black"
                            >-</button>
                            <span className="w-5 text-center font-black text-blue-700">{item.exchange_qty}</span>
                            <button
                              onClick={() => setNewItems(newItems.map(i => i.id === item.id ? { ...i, exchange_qty: i.exchange_qty + 1 } : i))}
                              className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-600 font-black"
                            >+</button>
                          </div>
                          <span className="text-xs font-bold text-gray-500">Sub: S/ {(item.price * item.exchange_qty).toFixed(2)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Pie del Modal (Matemática Financiera) */}
            {/* ========================================== */}
            {(() => {
              const totalDevuelto = returnItems.reduce((sum, item) => sum + (item.return_qty * item.price), 0);
              const totalNuevo = newItems.reduce((sum, item) => sum + (item.exchange_qty * item.price), 0);
              const diferencia = totalNuevo - totalDevuelto;

              return (
                <div className="bg-white border-t p-5 shrink-0 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex flex-wrap gap-6 text-sm items-center">
                    <div>
                      <p className="text-gray-500 font-bold uppercase">Devuelve:</p>
                      <p className="text-xl font-black text-red-600">S/ {totalDevuelto.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-bold uppercase">Se lleva:</p>
                      <p className="text-xl font-black text-blue-600">S/ {totalNuevo.toFixed(2)}</p>
                    </div>
                    <div className="border-l pl-6">
                      <p className="text-gray-500 font-bold uppercase">Resultado Final:</p>
                      {diferencia === 0 ? (
                        <p className="text-xl font-black text-green-600">CAMBIO EXACTO (S/ 0.00)</p>
                      ) : diferencia > 0 ? (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          <p className="text-xl font-black text-orange-600 mr-2">PAGA: S/ {diferencia.toFixed(2)}</p>

                          {/* Selector de Método */}
                          <select
                            value={exchangePaymentMethod}
                            onChange={(e) => {
                              const method = e.target.value;
                              setExchangePaymentMethod(method);
                              // Auto-ajuste de destino por defecto para ahorrar clics
                              if (method === 'efectivo') setExchangePaymentDestination('Caja Principal');
                              if (method === 'yape') setExchangePaymentDestination('Yape General');
                              if (method === 'transferencia') setExchangePaymentDestination('BCP HERMELINDA');
                            }}
                            className="bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold rounded p-1.5 outline-none cursor-pointer"
                          >
                            <option value="efectivo">💵 Efectivo</option>
                            <option value="yape">📱 Yape/Plin</option>
                            <option value="transferencia">🏦 Transf.</option>
                          </select>

                          {/* 🟢 Selector de Cuenta Destino Dinámica según el método */}
                          <select
                            value={exchangePaymentDestination}
                            onChange={(e) => setExchangePaymentDestination(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded p-1.5 outline-none cursor-pointer"
                          >
                            {exchangePaymentMethod === 'efectivo' && (
                              <option value="Caja Principal">Caja Principal</option>
                            )}
                            {exchangePaymentMethod === 'yape' && (
                              <>
                                <option value="Yape General">Yape General</option>
                                <option value="Plin Negocio">Plin Negocio</option>
                              </>
                            )}
                            {exchangePaymentMethod === 'transferencia' && (
                              <>
                                <option value="BCP HERMELINDA">BCP HERMELINDA</option>
                                <option value="BBVA Intercambio">BBVA Intercambio</option>
                              </>
                            )}
                          </select>

                        </div>
                      ) : (
                        <p className="text-xl font-black text-purple-600">VALE A FAVOR: S/ {Math.abs(diferencia).toFixed(2)}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleProcessExchange}
                    disabled={totalDevuelto === 0 || isProcessingExchange}
                    className="bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 text-base"
                  >
                    {isProcessingExchange ? 'Procesando...' : 'Procesar Operación'}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};