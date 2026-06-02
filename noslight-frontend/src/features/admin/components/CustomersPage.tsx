import { useState, useEffect } from "react";
import { Search, Plus, Edit2, User, CreditCard, X, CheckCircle, AlertCircle, Ban, Power, ChevronLeft, ChevronRight } from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  // Estados para el Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    document_type: "DNI",
    document_number: "",
    phone: "",
    address: "",
    has_credit: false,
    credit_limit: "",
  });

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(import.meta.env.VITE_API_URL + "/api/customers", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error("Error al cargar clientes:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenModal = (customer: any = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name || "",
        document_type: customer.document_type || "DNI",
        document_number: customer.document_number || "",
        phone: customer.phone || "",
        address: customer.address || "",
        has_credit: customer.has_credit === 1 || customer.has_credit === true,
        credit_limit: customer.credit_limit || "",
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: "", document_type: "DNI", document_number: "",
        phone: "", address: "", has_credit: false, credit_limit: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return alert("El nombre es obligatorio");
    try {
      const token = localStorage.getItem("noslight_token");
      const url = editingCustomer 
        ? `${import.meta.env.VITE_API_URL}/api/customers/${editingCustomer.id}`
        : `${import.meta.env.VITE_API_URL}/api/customers`;
      
      const method = editingCustomer ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          credit_limit: formData.has_credit ? (parseFloat(formData.credit_limit) || 0) : 0
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchCustomers();
      } else {
        alert("Error al guardar el cliente");
      }
    } catch (error) {
      console.error(error);
    }
  };

  // NUEVA FUNCIÓN: Inactivar / Activar
  const handleToggleStatus = async (customer: any) => {
    const action = customer.is_active ? "DESACTIVAR" : "ACTIVAR";
    if (!window.confirm(`¿Estás seguro de ${action} a ${customer.name}?`)) return;

    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customers/${customer.id}/toggle-status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchCustomers();
      } else {
        const data = await res.json();
        alert(`❌ Operación denegada:\n${data.error}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Filtros y Paginación
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.document_number && c.document_number.includes(searchTerm))
  );

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <User className="text-blue-500 w-8 h-8" /> Directorio de Clientes
          </h1>
          <p className="text-gray-400 mt-1">Administra la información y líneas de crédito de tus clientes.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all">
          <Plus className="w-5 h-5" /> Nuevo Cliente
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input type="text" placeholder="Buscar por nombre o documento..." className="w-full bg-[#1e2330] text-white rounded-xl pl-12 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 border border-gray-800 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e2330] rounded-2xl border border-gray-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 bg-[#151923]">
              <th className="p-4 text-gray-400 font-medium text-sm">Cliente</th>
              <th className="p-4 text-gray-400 font-medium text-sm">Documento</th>
              <th className="p-4 text-gray-400 font-medium text-sm">Estado de Cuenta</th>
              <th className="p-4 text-gray-400 font-medium text-sm">Acceso al Sistema</th>
              <th className="p-4 text-gray-400 font-medium text-sm text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Cargando directorio...</td></tr>
            ) : filteredCustomers.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">No se encontraron clientes.</td></tr>
            ) : (
              currentCustomers.map(customer => (
                <tr key={customer.id} className={`hover:bg-gray-800/20 transition-colors ${!customer.is_active ? 'opacity-50' : ''}`}>
                  <td className="p-4">
                    <p className="font-bold text-white">{customer.name}</p>
                    <p className="text-xs text-gray-500">{customer.phone || 'Sin teléfono'}</p>
                  </td>
                  <td className="p-4 text-gray-300">
                    {customer.document_type}: {customer.document_number || '-'}
                  </td>
                  <td className="p-4">
                    {customer.has_credit ? (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-bold mb-1">
                          <CheckCircle className="w-3 h-3" /> CRÉDITO ACTIVO
                        </span>
                        <p className="text-xs text-gray-400">Límite: S/ {parseFloat(customer.credit_limit || 0).toFixed(2)}</p>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-500/10 text-gray-400 text-xs font-bold">
                        <AlertCircle className="w-3 h-3" /> SIN CRÉDITO
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                     {customer.is_active ? (
                        <span className="inline-flex items-center gap-1 text-blue-400 text-xs font-bold">
                           <Power className="w-4 h-4" /> PERMITIDO
                        </span>
                     ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 text-xs font-bold">
                           <Ban className="w-4 h-4" /> INACTIVO / BLOQUEADO
                        </span>
                     )}
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleOpenModal(customer)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors inline-block ml-2" title="Editar Cliente">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleToggleStatus(customer)} className={`p-2 rounded-lg transition-colors inline-block ml-2 ${customer.is_active ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`} title={customer.is_active ? 'Desactivar Cliente' : 'Activar Cliente'}>
                      {customer.is_active ? <Ban className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 bg-[#1e2330] p-4 rounded-2xl border border-gray-800">
          <p className="text-gray-400 text-sm">
            Mostrando <span className="font-bold text-white">{indexOfFirstItem + 1}</span> a <span className="font-bold text-white">{Math.min(indexOfLastItem, filteredCustomers.length)}</span> de <span className="font-bold text-white">{filteredCustomers.length}</span> clientes
          </p>
          <div className="flex gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-50 hover:bg-gray-700 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-50 hover:bg-gray-700 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN MANTENIDO IGUAL */}
      {isModalOpen && (
         /* ... El interior del modal se mantiene intacto ... */
         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151923] w-full max-w-xl rounded-2xl border border-gray-800 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#1e2330] rounded-t-2xl">
              <h2 className="text-xl font-black text-white">{editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nombre o Razón Social *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[#1e2330] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500" placeholder="Ej: Juan Pérez" />
              </div>
              <div className="flex gap-4">
                <div className="w-1/3">
                  <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                  <select value={formData.document_type} onChange={e => setFormData({...formData, document_type: e.target.value})} className="w-full bg-[#1e2330] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500">
                    <option value="DNI">DNI</option><option value="RUC">RUC</option><option value="CE">C.E.</option>
                  </select>
                </div>
                <div className="w-2/3">
                  <label className="block text-sm text-gray-400 mb-1">Número de Documento</label>
                  <input type="text" value={formData.document_number} onChange={e => setFormData({...formData, document_number: e.target.value})} className="w-full bg-[#1e2330] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500" placeholder="Ej: 71234567" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="block text-sm text-gray-400 mb-1">Teléfono</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-[#1e2330] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500" placeholder="Ej: 987654321" />
                </div>
                <div className="w-1/2">
                  <label className="block text-sm text-gray-400 mb-1">Dirección</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-[#1e2330] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500" placeholder="Ej: Av. Principal 123" />
                </div>
              </div>
              <div className="mt-6 p-5 rounded-xl border border-gray-700 bg-[#1e2330]">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <CreditCard className={formData.has_credit ? "text-green-500" : "text-gray-500"} size={24} />
                    <div>
                      <p className={`font-bold ${formData.has_credit ? 'text-green-400' : 'text-gray-400'}`}>Habilitar Línea de Crédito</p>
                      <p className="text-xs text-gray-500">Permite registrar despachos por pagar a este cliente.</p>
                    </div>
                  </div>
                  <input type="checkbox" className="w-5 h-5 accent-green-500" checked={formData.has_credit} onChange={e => setFormData({...formData, has_credit: e.target.checked})} />
                </label>
                {formData.has_credit && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <label className="block text-sm text-gray-400 mb-1">Límite de Crédito (S/)</label>
                    <input type="number" step="100" value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: e.target.value})} className="w-full bg-[#151923] border border-green-500/30 text-white rounded-xl px-4 py-3 outline-none focus:border-green-500" placeholder="Ej: 2000.00" />
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-800 bg-[#1e2330] rounded-b-2xl">
              <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all">
                Guardar Información
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}