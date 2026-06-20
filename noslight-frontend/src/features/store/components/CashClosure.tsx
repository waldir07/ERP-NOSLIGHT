import { FormEvent, useEffect, useMemo, useState } from "react";


interface CashClosureSummary {
    is_closed: boolean;
    date: string;
    opening_balance?: number;
    cash_sales?: number;
    yape_sales?: number;
    transfer_sales?: number;
    cash_expenses?: number;
    expected_cash?: number;
    credit_payments?: Array<{ id: number; customer: string; amount: number; method: string; time: string; }>;   
    closure_details?: {
        opening_balance: number | string;
        cash_sales: number | string;
        yape_sales: number | string;
        transfer_sales: number | string;
        cash_expenses: number | string;
        expected_cash: number | string;
        actual_cash: string | number;
        cash_withdrawn: string | number;
        next_day_float: string | number;
        discrepancy: string | number;
        observations?: string;
    };
}

interface StoreCashClosureResponse {
    message: string;
    closure?: unknown;
}

interface ErrorResponse {
    message?: string;
}

interface SummaryCardProps {
    title: string;
    value: string;
}

export default function CashClosure() {
    const [summary, setSummary] = useState<CashClosureSummary | null>(null);
    const [actualCash, setActualCash] = useState<string>("");
    const [cashWithdrawn, setCashWithdrawn] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [message, setMessage] = useState<string>("");
    const [error, setError] = useState<string>("");

    // 🟢 NUEVO ESTADO PARA AUTO-IMPRESIÓN
    const [shouldAutoPrint, setShouldAutoPrint] = useState<boolean>(false);

    const [observations, setObservations] = useState<string>(""); // <-- Nuevo estado

    const formatMoney = (value: number | string): string => {
        const number = Number(value || 0);

        return new Intl.NumberFormat("es-PE", {
            style: "currency",
            currency: "PEN",
        }).format(number);
    };

    const getAuthHeaders = (): HeadersInit => {
        const token = localStorage.getItem("noslight_token");

        return {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const discrepancy = useMemo((): number => {
        if (!summary || actualCash === "") return 0;

        // Le agregamos || 0 aquí abajo:
        return Number(actualCash) - Number(summary.expected_cash || 0);
    }, [summary, actualCash]);

    const nextDayFloat = useMemo((): number => {
        if (actualCash === "") return 0;

        return Number(actualCash || 0) - Number(cashWithdrawn || 0);
    }, [actualCash, cashWithdrawn]);

    const loadSummary = async (): Promise<void> => {
        try {
            setLoading(true);
            setError("");
            setMessage("");

            const response = await fetch(
                import.meta.env.VITE_API_URL + "/api/cash-closures/daily-summary",
                {
                    method: "GET",
                    headers: getAuthHeaders(),
                    cache: "no-store",
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("No estás autenticado. Vuelve a iniciar sesión.");
                }

                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data: CashClosureSummary = await response.json();

            console.log("Resumen de cierre de caja:", data);

            setSummary(data);
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "No se pudo cargar el resumen del día.";

            console.error("Error cargando resumen de caja:", err);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        if (!summary) return;

        if (actualCash === "") {
            setError("Debes ingresar el efectivo contado en caja.");
            return;
        }

        if (cashWithdrawn === "") {
            setError("Debes ingresar cuánto efectivo vas a retirar.");
            return;
        }

        if (Number(cashWithdrawn) > Number(actualCash)) {
            setError("No puedes retirar más efectivo del que realmente hay en caja.");
            return;
        }



        // =================================================================
        // 🟢 NUEVA VALIDACIÓN: Obligar observación si hay descuadre
        // =================================================================
        const currentDiscrepancy = Number(actualCash) - Number(summary.expected_cash);
        if (currentDiscrepancy !== 0 && observations.trim() === "") {
            setError("Hay una diferencia de dinero. Es obligatorio ingresar el motivo en las observaciones.");
            return;
        }
        // =================================================================

        try {
            setSaving(true);
            setError("");
            setMessage("");

            // Dentro del payload que se envía a la API:
            const payload = {
                opening_balance: summary.opening_balance || 0,
                cash_sales: summary.cash_sales || 0,
                yape_sales: summary.yape_sales || 0,
                transfer_sales: summary.transfer_sales || 0,
                cash_expenses: summary.cash_expenses || 0,
                expected_cash: summary.expected_cash || 0,
                actual_cash: Number(actualCash),
                cash_withdrawn: Number(cashWithdrawn),
                observations: observations, // (Asegúrate de que la variable coincida con tu estado)
            };

            const response = await fetch(
                import.meta.env.VITE_API_URL + "/api/cash-closures",
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    cache: "no-store",
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data?.message || `No se pudo guardar el cierre. Error ${response.status}`
                );
            }

            // ======================================================================
            // 🟢 NUEVO: Enviando señal de apertura al asistente local al cerrar caja
            // ======================================================================
            console.log("🟢 Enviando señal de apertura al asistente local desde Cierre de Caja...");
            fetch("http://localhost:9090/abrir-gaveta")
                .catch(err => console.error("El asistente de gaveta no está encendido", err));
            // ======================================================================

            // ... (después de que la respuesta sea exitosa) [cite: 63]
            setMessage(data?.message || "Cierre de caja guardado correctamente.");
            setActualCash("");
            setCashWithdrawn("");
            setObservations(""); // <-- Limpiamos el cuadro de texto

            // 🟢 ACTIVAMOS LA BANDERA DE AUTO-IMPRESIÓN
            setShouldAutoPrint(true);

            await loadSummary();
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "No se pudo guardar el cierre de caja.";

            console.error("Error guardando cierre de caja:", err);
            setError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        loadSummary();
    }, []);

    // 🟢 NUEVO EFECTO: Si se activó la bandera y la caja ya sale cerrada, imprime solo!
    useEffect(() => {
        if (shouldAutoPrint && summary?.is_closed && summary?.closure_details) {
            handlePrintTicket(); // Llamamos a tu función de imprimir
            setShouldAutoPrint(false); // Apagamos la bandera para que no imprima en bucle
        }
    }, [summary, shouldAutoPrint]);

    if (loading) {
        return (
            <div className="p-6">
                <p className="text-gray-600">Cargando resumen de caja...</p>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="p-6">
                <p className="text-red-600">
                    No se encontró información para el cierre de caja.
                </p>
            </div>
        );
    }

    const handlePrintTicket = () => {
        if (!summary || !summary.closure_details) return;
        const details = summary.closure_details;

        // Abrimos una ventana temporal pequeña simulando el ancho de un ticket
        const printWindow = window.open("", "_blank", "width=300,height=600");
        if (!printWindow) {
            alert("Por favor, permite las ventanas emergentes para poder imprimir el ticket.");
            return;
        }

        // Construimos el HTML del ticket con estilos CSS limpios para impresoras térmicas
        const ticketHtml = `
        <html>
        <head>
            <title>Ticket de Cierre</title>
            <style>
                @page { margin: 0; }
                body {
                    font-family: 'Courier New', Courier, monospace;
                    width: 72mm; /* Ancho ideal imprimible para ticketeras de 80mm */
                    margin: 0 auto;
                    padding: 8px;
                    font-size: 12px;
                    line-height: 1.3;
                    color: #000;
                }
                .text-center { text-align: center; }
                .bold { font-weight: bold; }
                .divider { border-top: 1px dashed #000; margin: 8px 0; }
                .row-item { display: flex; justify-content: space-between; margin-bottom: 3px; }
                .header-title { font-size: 15px; font-weight: bold; }
                .alert-box { text-align: center; font-weight: bold; font-size: 11px; margin-top: 2px; }
            </style>
        </head>
        <body>
            <div class="text-center">
                <span class="header-title">MI ERP - SISTEMA</span><br>
                <span class="bold">*** REPORTE DE CIERRE ***</span><br>
                <span>Fecha: ${summary.date}</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="bold text-center">RESUMEN DE MOVIMIENTOS</div>
            <div class="row-item">
                <span>Fondo Inicial (Gaveta):</span>
                <span class="bold">${formatMoney(details.opening_balance)}</span>
            </div>
            <div class="row-item">
                <span>(+) Ventas Efectivo:</span>
                <span>${formatMoney(details.cash_sales)}</span>
            </div>
            <div class="row-item">
                <span>(-) Gastos Efectivo:</span>
                <span>${formatMoney(details.cash_expenses)}</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="row-item bold">
                <span>Efectivo Esperado:</span>
                <span>${formatMoney(details.expected_cash)}</span>
            </div>
            <div class="row-item bold">
                <span>Efectivo Contado:</span>
                <span>${formatMoney(details.actual_cash)}</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="row-item bold">
                <span>Diferencia (Descuadre):</span>
                <span>${formatMoney(details.discrepancy)}</span>
            </div>
            <div class="alert-box">
                ${Number(details.discrepancy) < 0
                ? '⚠️ FALTANTE DE EFECTIVO'
                : Number(details.discrepancy) > 0
                    ? '⭐ SOBRANTE DE EFECTIVO'
                    : '✅ CAJA COMPLETAMENTE CUADRADA'}
            </div>

            <div class="divider"></div>
            <div class="bold text-center">INGRESOS DIGITALES</div>
            <div class="row-item">
                <span>Ventas Yape:</span>
                <span>${formatMoney(details.yape_sales)}</span>
            </div>
            <div class="row-item">
                <span>Ventas Transferencia:</span>
                <span>${formatMoney(details.transfer_sales)}</span>
            </div>
            
            <div class="divider"></div>
            <div class="bold text-center">ENTREGA DE DINERO</div>
            <div class="row-item bold" style="font-size: 13px;">
                <span>EFECTIVO RETIRADO:</span>
                <span>${formatMoney(details.cash_withdrawn)}</span>
            </div>
            <div class="row-item bold" style="font-size: 13px;">
                <span>QUEDA EN CAJA (MAÑANA):</span>
                <span>${formatMoney(details.next_day_float)}</span>
            </div>
            
            ${details.observations ? `
                <div class="divider"></div>
                <div class="bold">Observaciones:</div>
                <div style="font-size: 11px; font-style: italic;">${details.observations}</div>
            ` : ''}
            
            <div class="divider"></div>
            <br><br><br>
            <div class="text-center">
                <div style="border-top: 1px solid #000; width: 140px; margin: 0 auto;"></div>
                <span style="font-size: 11px;">Firma Responsable</span>
            </div>
            <br>
            <div class="text-center" style="font-size: 9px; color: #555;">
                Impreso el: ${new Date().toLocaleString('es-PE')}
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 300);
                };
            </script>
        </body>
        </html>
        `;

        printWindow.document.write(ticketHtml);
        printWindow.document.close();
    };


    // SI LA CAJA YA FUE CERRADA, MOSTRAMOS ESTA PANTALLA
    if (summary.is_closed && summary.closure_details) {
        return (
            <div className="max-w-5xl mx-auto p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Cierre de Caja</h1>
                    <p className="text-gray-500">Fecha: {summary.date}</p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center shadow-sm">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                        <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-green-800 mb-2">¡Caja cerrada por hoy!</h2>
                    <p className="text-green-700 mb-8">El resumen del día ha sido guardado exitosamente. Ya no se pueden realizar más operaciones de caja hoy.</p>
                    {/* 👇 AQUÍ VA EL NUEVO BOTÓN DE IMPRESIÓN 👇 */}
                    <div className="mb-8 flex justify-center">
                        <button
                            onClick={handlePrintTicket}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium shadow hover:bg-blue-700 transition"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 2 0 002-2v-4a2 2 2 0 00-2-2H5a2 2 2 0 00-2 2v4a2 2 2 0 002 2h2m2 4h6a2 2 2 0 002-2v-4a2 2 2 0 00-2-2H9a2 2 2 0 00-2 2v4a2 2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Imprimir Ticket de Cierre
                        </button>
                    </div>
                    <h3 className="text-left text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Resumen Final</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                            <p className="text-sm text-gray-500">Efectivo contado</p>
                            <p className="text-xl font-bold text-gray-900">{formatMoney(summary.closure_details.actual_cash)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                            <p className="text-sm text-gray-500">Efectivo retirado</p>
                            <p className="text-xl font-bold text-gray-900">{formatMoney(summary.closure_details.cash_withdrawn)}</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
                            <p className="text-sm text-blue-700 font-medium">Fondo para mañana</p>
                            <p className="text-2xl font-bold text-blue-800">{formatMoney(summary.closure_details.next_day_float)}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                    Cierre de Caja
                </h1>
                <p className="text-gray-500">Fecha: {summary.date}</p>
            </div>

            {message && (
                <div className="mb-4 rounded-lg bg-green-100 p-4 text-green-800">
                    {message}
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-lg bg-red-100 p-4 text-red-800">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <SummaryCard
                    title="Fondo inicial"
                    value={formatMoney(summary.opening_balance || 0)}
                />
                <SummaryCard
                    title="Ventas efectivo"
                    value={formatMoney(summary.cash_sales || 0)}
                />
                <SummaryCard
                    title="Gastos efectivo"
                    value={formatMoney(summary.cash_expenses || 0)}
                />
                <SummaryCard
                    title="Ventas Yape"
                    value={formatMoney(summary.yape_sales || 0)}
                />
                <SummaryCard
                    title="Ventas Transferencia"
                    value={formatMoney(summary.transfer_sales || 0)}
                />
            </div>

            <div className="bg-white rounded-xl shadow border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Resumen del sistema
                </h2>

                <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-gray-600">
                        Efectivo esperado en caja
                    </span>
                    <span className="text-xl font-bold text-gray-900">
                        {formatMoney(summary.expected_cash || 0)}
                    </span>
                </div>

                <p className="text-sm text-gray-500 mt-3">
                    Fórmula: fondo inicial + ventas en efectivo - gastos en efectivo.
                </p>

                {/* 🧾 PANEL DE AUDITORÍA VISUAL: INGRESOS POR COBRANZA DE CRÉDITOS */}
                {summary?.credit_payments && summary.credit_payments.length > 0 && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 pb-2 mb-2 border-b border-green-200">
                            <span className="text-base">💰</span>
                            <h3 className="text-xs font-bold text-green-950 uppercase tracking-wider">
                                Cobranzas de Créditos (Hoy)
                            </h3>
                        </div>
                        <div className="divide-y divide-green-100 max-h-40 overflow-y-auto">
                            {summary.credit_payments.map((payment: any) => (
                                <div key={payment.id} className="flex items-center justify-between py-2 text-xs">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-gray-800">{payment.customer}</span>
                                        <span className="text-[10px] text-gray-400">🕒 {payment.time} hrs — <span className="uppercase">{payment.method}</span></span>
                                    </div>
                                    <span className="font-bold text-green-700">+ {formatMoney(payment.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <form
                onSubmit={handleSubmit}
                className="bg-white rounded-xl shadow border border-gray-200 p-6"
            >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Conteo físico y retiro
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Efectivo contado físicamente
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={actualCash}
                            onChange={(e) => setActualCash(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ejemplo: 350.00"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Efectivo a retirar
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cashWithdrawn}
                            onChange={(e) => setCashWithdrawn(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ejemplo: 200.00"
                        />
                    </div>

                    {/* ... Dentro del <form>, justo después del div que contiene los inputs de actualCash y cashWithdrawn (Línea 89) ... */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Observaciones / Justificación de descuadres
                        </label>
                        <textarea
                            value={observations}
                            onChange={(e) => setObservations(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Escribe aquí si hubo algún contratiempo, billetes falsos, o el motivo de un sobrante/faltante..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div
                        className={`rounded-lg p-4 border ${discrepancy < 0
                            ? "bg-red-50 border-red-200"
                            : discrepancy > 0
                                ? "bg-yellow-50 border-yellow-200"
                                : "bg-green-50 border-green-200"
                            }`}
                    >
                        <p className="text-sm text-gray-600">
                            Diferencia / descuadre
                        </p>

                        <p
                            className={`text-xl font-bold ${discrepancy < 0
                                ? "text-red-700"
                                : discrepancy > 0
                                    ? "text-yellow-700"
                                    : "text-green-700"
                                }`}
                        >
                            {formatMoney(discrepancy)}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                            {discrepancy < 0
                                ? "Falta efectivo en caja."
                                : discrepancy > 0
                                    ? "Hay sobrante en caja."
                                    : "La caja está cuadrada."}
                        </p>
                    </div>

                    <div className="rounded-lg p-4 border bg-blue-50 border-blue-200">
                        <p className="text-sm text-gray-600">
                            Fondo para el día siguiente
                        </p>

                        <p className="text-xl font-bold text-blue-700">
                            {formatMoney(nextDayFloat)}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                            Efectivo contado - efectivo retirado.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving || nextDayFloat < 0}
                        className="rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {saving ? "Guardando..." : "Guardar cierre de caja"}
                    </button>
                </div>
            </form>
        </div>
    );
}

function SummaryCard({ title, value }: SummaryCardProps) {
    return (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    );
}