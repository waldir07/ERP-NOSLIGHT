import { useState, useEffect } from "react";
import { Building, CreditCard, Receipt, Save, Plus, Trash2, CheckCircle, Megaphone } from "lucide-react";
import Swal from 'sweetalert2';


export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("company");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estado principal de las configuraciones
  const [settings, setSettings] = useState({
    company_name: "",
    company_ruc: "",
    company_address: "",
    company_phone: "",
    yape_accounts: [] as string[],
    bank_accounts: [] as string[],
    ticket_message: "",
    igv_percentage: "18",
    admin_announcements: [] as { id: string; text: string; priority: 'info' | 'warning' | 'urgent' }[],

  });

  // Cargar configuraciones al abrir la página
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(import.meta.env.VITE_API_URL + "/api/settings", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({
          ...prev,
          ...data,
          yape_accounts: data.yape_accounts || [],
          bank_accounts: data.bank_accounts || [],
          admin_announcements: Array.isArray(data.admin_announcements)
            ? data.admin_announcements
            : (typeof data.admin_announcements === 'string'
              ? JSON.parse(data.admin_announcements)
              : []),
        }));
      }
    } catch (error) {
      console.error("Error al cargar configuraciones:", error);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(import.meta.env.VITE_API_URL + "/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000); // Ocultar mensaje de éxito tras 3s
      } else {
        alert("Error al guardar las configuraciones");
      }
    } catch (error) {
      console.error(error);
    }
    setIsSaving(false);
  };

  // --- Funciones auxiliares para arrays (Yape/Bancos) ---
  const handleAddArrayItem = (field: "yape_accounts" | "bank_accounts") => {
    const value = prompt(`Ingrese la nueva cuenta para ${field === 'yape_accounts' ? 'Yape/Plin' : 'Bancos'}:`);
    if (value && value.trim() !== "") {
      setSettings(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
    }
  };

  const handleRemoveArrayItem = (field: "yape_accounts" | "bank_accounts", index: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta cuenta?")) return;
    setSettings(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // --- Funciones auxiliares para la lista de Anuncios ---
  const handleAddAnnouncement = async () => {
    const { value: formValues } = await Swal.fire({
      title: '<span style="color: #fff; font-family: sans-serif; font-weight: 800;">NUEVO ANUNCIO</span>',
      background: '#151923',
      // 🔥 CORREGIDO: Eliminamos la propiedad border de la raíz y estilizamos el contenedor directamente aquí abajo
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px; text-align: left; font-family: sans-serif; padding: 10px; border: 1px solid #374151; border-radius: 16px;">
          <label style="color: #9ca3af; font-size: 12px; font-weight: 600; display: block; margin-bottom: 5px;">Texto del Anuncio / Alerta</label>
          <input id="swal-input-text" class="swal2-input" placeholder="Ej: Mantenimiento programado..." style="width: 100%; margin: 0 0 15px 0; background: #1f2937; color: #fff; border: 1px solid #4b5563; border-radius: 12px; padding: 10px; font-size: 14px; box-sizing: border-box;">
          
          <label style="color: #9ca3af; font-size: 12px; font-weight: 600; display: block; margin-bottom: 5px;">Nivel de Prioridad Visual</label>
          <select id="swal-input-priority" class="swal2-select" style="width: 100%; margin: 0; background: #1f2937; color: #fff; border: 1px solid #4b5563; border-radius: 12px; padding: 10px; font-size: 14px; font-weight: 700; box-sizing: border-box;">
            <option value="info">INFORMATIVO (Azul)</option>
            <option value="warning">ADVERTENCIA (Amarillo)</option>
            <option value="urgent">CRÍTICO / URGENTE (Rojo)</option>
          </select>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const text = (document.getElementById('swal-input-text') as HTMLInputElement).value;
        const priority = (document.getElementById('swal-input-priority') as HTMLSelectElement).value;

        if (!text || text.trim() === "") {
          Swal.showValidationMessage('Por favor, escribe el texto del anuncio');
          return false;
        }

        return { text: text.trim(), priority };
      }
    });

    if (formValues) {
      setSettings(prev => ({
        ...prev,
        admin_announcements: [
          ...(prev.admin_announcements || []),
          {
            id: `msg-${Date.now()}`,
            text: formValues.text,
            priority: formValues.priority as 'info' | 'warning' | 'urgent'
          }
        ]
      }));
    }
  };



  const handleRemoveAnnouncement = (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este anuncio del sistema?")) return;
    setSettings(prev => ({
      ...prev,
      admin_announcements: prev.admin_announcements.filter(item => item.id !== id)
    }));
  };


  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* CABECERA */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-black flex items-center gap-3">
            <Building className="text-blue-500 w-8 h-8" />
            Configuración General
          </h1>
          <p className="text-gray-400 mt-1">Administra los datos de tu empresa, cuentas bancarias y preferencias.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
        >
          {isSaving ? "Guardando..." : <><Save className="w-5 h-5" /> Guardar Cambios</>}
        </button>
      </div>

      {saveSuccess && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400 font-bold">
          <CheckCircle className="w-5 h-5" /> Configuración guardada correctamente.
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-400 py-10">Cargando configuraciones...</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">

          {/* MENÚ LATERAL (PESTAÑAS) */}
          <div className="w-full md:w-64 flex md:flex-col gap-2">
            <button
              onClick={() => setActiveTab("company")}
              className={`p-4 rounded-xl text-left font-bold flex items-center gap-3 transition-all ${activeTab === "company" ? "bg-blue-600 text-white" : "bg-[#1e2330] text-gray-400 hover:bg-gray-800"}`}
            >
              <Building className="w-5 h-5" /> Perfil de Empresa
            </button>
            <button
              onClick={() => setActiveTab("finance")}
              className={`p-4 rounded-xl text-left font-bold flex items-center gap-3 transition-all ${activeTab === "finance" ? "bg-blue-600 text-white" : "bg-[#1e2330] text-gray-400 hover:bg-gray-800"}`}
            >
              <CreditCard className="w-5 h-5" /> Cuentas y Finanzas
            </button>
            <button
              onClick={() => setActiveTab("pos")}
              className={`p-4 rounded-xl text-left font-bold flex items-center gap-3 transition-all ${activeTab === "pos" ? "bg-blue-600 text-white" : "bg-[#1e2330] text-gray-400 hover:bg-gray-800"}`}
            >
              <Receipt className="w-5 h-5" /> Configuración POS
            </button>
            <button
              onClick={() => setActiveTab("announcements")}
              className={`p-4 rounded-xl text-left font-bold flex items-center gap-3 transition-all ${activeTab === "announcements" ? "bg-blue-600 text-white" : "bg-[#1e2330] text-gray-400 hover:bg-gray-800"}`}
            >
              <Megaphone className="w-5 h-5" /> Anuncios del Sistema
            </button>
          </div>

          {/* ÁREA DE CONTENIDO */}
          <div className="flex-1 bg-[#1e2330] rounded-2xl border border-gray-800 p-6 overflow-y-auto custom-scrollbar">

            {/* PESTAÑA: EMPRESA */}
            {activeTab === "company" && (
              <div className="space-y-6 max-w-2xl">
                <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-800 pb-2">Datos Fiscales</h2>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Razón Social / Nombre del Negocio</label>
                  <input type="text" value={settings.company_name} onChange={e => setSettings({ ...settings, company_name: e.target.value })} className="w-full bg-[#151923] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500" placeholder="Ej: Noslight S.A.C." />
                </div>

                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-sm text-gray-400 mb-1">RUC</label>
                    <input type="text" value={settings.company_ruc} onChange={e => setSettings({ ...settings, company_ruc: e.target.value })} className="w-full bg-[#151923] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500" placeholder="Ej: 20123456789" />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-sm text-gray-400 mb-1">Teléfono Principal</label>
                    <input type="text" value={settings.company_phone} onChange={e => setSettings({ ...settings, company_phone: e.target.value })} className="w-full bg-[#151923] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500" placeholder="Ej: 999 888 777" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Dirección Fiscal</label>
                  <input type="text" value={settings.company_address} onChange={e => setSettings({ ...settings, company_address: e.target.value })} className="w-full bg-[#151923] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500" placeholder="Ej: Av. Las Malvinas 123, Lima" />
                </div>
              </div>
            )}

            {/* PESTAÑA: FINANZAS (YAPES Y BANCOS) */}
            {activeTab === "finance" && (
              <div className="space-y-8 max-w-2xl">

                {/* SECCIÓN YAPE / PLIN */}
                <div>
                  <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                    <h2 className="text-xl font-bold text-white">Cuentas Yape / Plin</h2>
                    <button onClick={() => handleAddArrayItem("yape_accounts")} className="text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                      <Plus className="w-4 h-4" /> Agregar Cuenta
                    </button>
                  </div>
                  {settings.yape_accounts.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No hay cuentas de Yape registradas.</p>
                  ) : (
                    <div className="space-y-2">
                      {settings.yape_accounts.map((acc, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[#151923] p-3 rounded-xl border border-gray-800">
                          <span className="text-white font-medium">{acc}</span>
                          <button onClick={() => handleRemoveArrayItem("yape_accounts", idx)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECCIÓN BANCOS */}
                <div>
                  <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                    <h2 className="text-xl font-bold text-white">Cuentas Bancarias</h2>
                    <button onClick={() => handleAddArrayItem("bank_accounts")} className="text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                      <Plus className="w-4 h-4" /> Agregar Banco
                    </button>
                  </div>
                  {settings.bank_accounts.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No hay cuentas bancarias registradas.</p>
                  ) : (
                    <div className="space-y-2">
                      {settings.bank_accounts.map((acc, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[#151923] p-3 rounded-xl border border-gray-800">
                          <span className="text-white font-medium">{acc}</span>
                          <button onClick={() => handleRemoveArrayItem("bank_accounts", idx)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* PESTAÑA: POS / TICKET */}
            {activeTab === "pos" && (
              <div className="space-y-6 max-w-2xl">
                <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-800 pb-2">Configuración de Caja y Ticket</h2>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Porcentaje de IGV (%)</label>
                  <input type="number" value={settings.igv_percentage} onChange={e => setSettings({ ...settings, igv_percentage: e.target.value })} className="w-32 bg-[#151923] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500" placeholder="18" />
                  <p className="text-xs text-gray-500 mt-1">Este valor se usará para cálculos fiscales si decides emitir boletas/facturas.</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Mensaje al final del Ticket</label>
                  <textarea
                    rows={4}
                    value={settings.ticket_message}
                    onChange={e => setSettings({ ...settings, ticket_message: e.target.value })}
                    className="w-full bg-[#151923] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 resize-none"
                    placeholder="Ej: ¡Gracias por su preferencia! No se aceptan devoluciones después de 7 días."
                  />
                </div>
              </div>
            )}
            {/* NUEVA PESTAÑA AUTOMATIZADA CON BOTÓN DE ELIMINAR Y AGREGAR */}
            {activeTab === "announcements" && (
              <div className="space-y-8 max-w-2xl">
                <div>
                  <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                    <h2 className="text-xl font-bold text-white">Anuncios y Alertas Activas</h2>
                    <button
                      onClick={handleAddAnnouncement}
                      className="text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Agregar Anuncio
                    </button>
                  </div>

                  {settings.admin_announcements.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No hay anuncios manuales publicados en las tiendas. La barra solo mostrará envíos automáticos.</p>
                  ) : (
                    <div className="space-y-2">
                      {settings.admin_announcements.map((announcement) => {
                        // Color visual sutil para la lista según la prioridad elegida
                        const badgeColor = announcement.priority === 'urgent' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                          announcement.priority === 'warning' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                            'text-blue-400 bg-blue-500/10 border-blue-500/20';
                        return (
                          <div key={announcement.id} className="flex justify-between items-center bg-[#151923] p-4 rounded-xl border border-gray-800 gap-4">
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <span className="text-white font-medium text-sm break-words">{announcement.text}</span>
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border w-max ${badgeColor}`}>
                                {announcement.priority}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveAnnouncement(announcement.id)}
                              className="text-red-400 hover:text-red-300 p-2 shrink-0 transition-colors"
                              title="Eliminar anuncio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 italic">Nota: Al agregar o eliminar elementos, recuerda presionar el botón "Guardar Cambios" en la esquina superior derecha para aplicar las actualizaciones en las tiendas.</p>
              </div>
            )}


          </div>
        </div>
      )}
    </div>
  );
}