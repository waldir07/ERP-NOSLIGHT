import React, { useState, useEffect } from 'react';

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<any[]>([]);
    const [totalEfectivo, setTotalEfectivo] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Filtros
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]); // Por defecto hoy
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]); // Por defecto hoy
    const [search, setSearch] = useState<string>('');
    const [activeQuickFilter, setActiveQuickFilter] = useState<string>('hoy');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('efectivo');
    const [category, setCategory] = useState('Logística');

    const token = localStorage.getItem("noslight_token");

    // Función infalible para obtener la fecha local (Ignora el salto de día UTC)
    const getLocalDate = (d = new Date()) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };




    // El useEffect reaccionará automáticamente cuando cambien las fechas o la búsqueda
    useEffect(() => {
        fetchExpenses();
    }, [startDate, endDate, search]);

    const fetchExpenses = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (search) params.append('search', search);

        try {
            const res = await fetch(`import.meta.env.VITE_API_URL/api/expenses?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setExpenses(data.expenses || []);
            setTotalEfectivo(parseFloat(data.total_efectivo) || 0);
        } catch (e) {
            console.error('❌ Error fetching expenses:', e);
        } finally {
            setLoading(false);
        }
    };

    const setQuickFilter = (type: string) => {
        setActiveQuickFilter(type);
        const today = getLocalDate();

        if (type === 'hoy') {
            setStartDate(today);
            setEndDate(today);
        } else if (type === 'ayer') {
            const ayer = new Date();
            ayer.setDate(ayer.getDate() - 1);
            const ayerStr = getLocalDate(ayer);
            setStartDate(ayerStr);
            setEndDate(ayerStr);
        } else if (type === 'semana') {
            const start = new Date();
            start.setDate(start.getDate() - 7);
            setStartDate(getLocalDate(start));
            setEndDate(today);
        } else if (type === 'todos') {
            setStartDate('');
            setEndDate('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim() || !amount) return alert("Por favor completa los datos obligatorios.");

        setSubmitting(true);
        try {
            await fetch("import.meta.env.VITE_API_URL/api/expenses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    description: description.trim(),
                    amount: parseFloat(amount),
                    payment_method: paymentMethod,
                    category: category
                }),
            });

            // Solo abrimos la gaveta si salió efectivo de la tienda
            if (paymentMethod === 'efectivo') {
                fetch("http://localhost:9090/abrir-gaveta").catch(() => { });
            }

            setDescription('');
            setAmount('');
            setIsModalOpen(false);
            fetchExpenses(); // Recargamos la tabla
        } catch (error) {
            alert("❌ Error al guardar el gasto");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Egresos y Gastos</h1>
                        <p className="text-sm text-gray-500 mt-1">Registra las salidas de dinero para mantener tu caja cuadrada.</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md transition-all active:scale-95"
                    >
                        + Registrar Gasto
                    </button>
                </div>

                {/* Panel de Filtros */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center">
                    <div className="flex gap-2">
                        {['hoy', 'ayer', 'semana', 'todos'].map((filtro) => (
                            <button
                                key={filtro}
                                onClick={() => setQuickFilter(filtro)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${activeQuickFilter === filtro ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {filtro}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                // Auto-ajuste: Si 'Desde' es mayor que 'Hasta', igualamos el 'Hasta'
                                if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                                setActiveQuickFilter('');
                            }}
                            className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <span className="text-gray-400">a</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                // Auto-ajuste: Si 'Hasta' es menor que 'Desde', igualamos el 'Desde'
                                if (startDate && e.target.value < startDate) setStartDate(e.target.value);
                                setActiveQuickFilter('');
                            }}
                            className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por descripción..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-64"
                    />
                </div>

                {/* Métrica Principal */}
                <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-gray-100 flex items-center gap-5">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-3xl">💵</div>
                    <div>
                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total Efectivo Retirado (Filtro Actual)</p>
                        <p className="text-4xl font-black text-gray-900">S/ {totalEfectivo.toFixed(2)}</p>
                    </div>
                </div>

                {/* Tabla de Resultados */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                            <tr>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Categoría</th>
                                <th className="p-4">Descripción</th>
                                <th className="p-4">Método</th>
                                <th className="p-4 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Cargando...</td></tr>
                            ) : expenses.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">No se encontraron gastos.</td></tr>
                            ) : (
                                expenses.map((exp: any) => (
                                    <tr key={exp.id} className="hover:bg-gray-50">
                                        <td className="p-4 text-sm text-gray-600">
                                            {new Date(exp.created_at).toLocaleDateString('es-PE')} <br />
                                            <span className="text-xs text-gray-400">{new Date(exp.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="p-4 text-sm font-medium text-gray-700">
                                            {exp.category || 'General'}
                                        </td>
                                        <td className="p-4 text-sm text-gray-900">{exp.description}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 text-xs font-bold rounded-md ${(exp.payment_method || 'efectivo') === 'efectivo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {(exp.payment_method || 'efectivo').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-bold text-red-600">- S/ {parseFloat(exp.amount).toFixed(2)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Rediseñado */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-900">Registrar Salida de Dinero</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto (S/)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-3 text-lg font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Método de Salida</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 focus:outline-none"
                                    >
                                        <option value="efectivo">Efectivo de Caja</option>
                                        <option value="transferencia">Transferencia / Yape de tienda</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 focus:outline-none"
                                >
                                    <option value="Logística">Logística / Envíos</option>
                                    <option value="Alimentación">Alimentación</option>
                                    <option value="Servicios">Servicios (Luz, Agua, Internet)</option>
                                    <option value="Proveedores">Pago a Proveedores</option>
                                    <option value="Varios">Varios / Otros</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción detallada</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-3 h-24 resize-none focus:ring-2 focus:ring-red-500 focus:outline-none"
                                    placeholder="Ej: Pago de pasaje a motorizado para envío a Miraflores..."
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 py-3 font-bold text-white rounded-lg transition-all ${submitting ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    {submitting ? 'Guardando...' : 'Confirmar Gasto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}