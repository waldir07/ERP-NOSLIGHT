// src/features/admin/components/AdminProductForm.tsx
import { useState, useEffect } from "react";
import { Product } from "../hooks/useAdminProducts";

interface Props {
  initialData?: Product | null;
  onSave: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function AdminProductForm({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
}: Props) {
  const [form, setForm] = useState({
    name: "",
    base_code: "",
    model: "",
    brand: "", // <-- NUEVO ESTADO PARA MARCA
    package_size: 1,
    is_raw: true,
    is_direct_sale: false,
    cost_price: 0,
    supplier: "",
    notes: "",
    amperage: "",
    poles: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        base_code: initialData.base_code,
        model: initialData.model || "",
        brand: initialData.brand || "", // <-- CARGAR MARCA EXISTENTE
        package_size: initialData.package_size,
        is_raw: !!initialData.is_raw,
        is_direct_sale: !!initialData.is_direct_sale,
        cost_price: initialData.cost_price,
        supplier: initialData.supplier || "",
        notes: initialData.notes || "",
        amperage: initialData.amperage ? initialData.amperage.toString() : "",
        poles: initialData.poles ? initialData.poles.toString() : "",
      });
    }
  }, [initialData]);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
            ? Number(value)
            : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      base_code: form.base_code,
      model: form.model,
      brand: form.brand, // <-- ENVIAR MARCA AL BACKEND
      package_size: form.package_size,
      is_raw: form.is_raw ? 1 : 0,
      is_direct_sale: form.is_direct_sale ? 1 : 0,
      cost_price: form.cost_price,
      supplier: form.supplier,
      notes: form.notes,
      amperage: form.amperage ? String(form.amperage) : null,
      poles: form.poles ? String(form.poles) : null,
    };

    onSave(payload);
  };

  const skuPreview = form.is_raw
    ? `M-${form.base_code || ""}`
    : form.base_code || "—";

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
      <h3 className="text-2xl font-bold mb-8 text-center text-gray-800">
        {initialData ? "Editar Producto" : "Crear Nuevo Producto"}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del Producto
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ej: Interruptor Monofásico 20A"
            required
          />
        </div>

        {/* Código base y Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código Base (SKU)
            </label>
            <input
              name="base_code"
              value={form.base_code}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
              placeholder="Ej: ITM25"
              required
            />
          </div>
          <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-center border border-gray-200">
            <span className="text-xs text-gray-500 uppercase font-bold">
              Preview SKU:
            </span>
            <span className="text-lg font-mono font-bold text-blue-600">
              {skuPreview}
            </span>
          </div>
        </div>

        {/* --- ATRIBUTOS PARA REPORTES (AHORA 4 COLUMNAS) --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Amperaje
            </label>
            <input
              name="amperage"
              type="number"
              value={form.amperage}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej: 20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Polos
            </label>
            <input
              name="poles"
              type="number"
              value={form.poles}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="1 o 3"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Modelo
            </label>
            <input
              name="model"
              value={form.model}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="IC / EZ"
            />
          </div>
          {/* NUEVO CAMPO MARCA */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Marca
            </label>
            <input
              name="brand"
              value={form.brand}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej: Schneider"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unidades por paquete
            </label>
            <input
              name="package_size"
              type="number"
              value={form.package_size}
              onChange={handleChange}
              min={1}
              className="w-full border border-gray-300 rounded-xl px-4 py-3"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio base (S/)
            </label>
            <input
              name="cost_price"
              type="number"
              step="0.01"
              value={form.cost_price}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-xl px-4 py-3"
              required
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              name="is_raw"
              type="checkbox"
              checked={form.is_raw}
              onChange={handleChange}
              className="h-5 w-5 text-blue-600 border-gray-300 rounded cursor-pointer"
            />
            <label className="text-sm font-bold text-gray-700 cursor-pointer">
              Es producto base / raw (agrega prefijo M-)
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              name="is_direct_sale"
              type="checkbox"
              checked={form.is_direct_sale}
              onChange={handleChange}
              className="h-5 w-5 text-green-600 border-gray-300 rounded cursor-pointer"
            />
            <label className="text-sm font-bold text-gray-700 cursor-pointer">
              Disponible para venta directa (importados finales)
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proveedor
          </label>
          <input
            name="supplier"
            value={form.supplier}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-xl px-4 py-3"
            placeholder="Nombre del proveedor"
          />
        </div>

        <div className="flex gap-4 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg"
          >
            {isLoading
              ? "Guardando..."
              : initialData
                ? "Actualizar"
                : "Crear Producto"}
          </button>
        </div>
      </form>
    </div>
  );
}