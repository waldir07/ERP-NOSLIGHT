// src/features/admin/components/ImportacionDetalleModal.tsx
import { useEffect, useState } from "react";
import axios from "@/lib/axios";
import jsPDF from "jspdf";

interface Props {
  importacionId: number;
  onClose: () => void;
}

export default function ImportacionDetalleModal({
  importacionId,
  onClose,
}: Props) {
  const [importacion, setImportacion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`/api/importaciones/${importacionId}`)
      .then((res) => {
        setImportacion(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [importacionId]);

  const calcularPrecioPeru = (
    precioProveedor: number,
    factor: number,
    valorDolar: number,
  ) => {
    return precioProveedor * factor * valorDolar;
  };

  const descargarPDF = () => {
    if (!importacion) return;

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("NOSLIGHT - Importación", pageWidth / 2, y, { align: "center" });

    y += 10;
    doc.setFontSize(14);
    doc.text(`Invoice: ${importacion.invoice_code}`, pageWidth / 2, y, {
      align: "center",
    });

    y += 15;

    // Resumen
    doc.setFontSize(11);
    doc.text(
      `Fecha Descarga: ${new Date(importacion.fecha_llegada_almacen).toLocaleDateString("es-ES")}`,
      12,
      y,
    );
    y += 8;
    doc.text(`Factor: ${Number(importacion.factor).toFixed(4)}`, 12, y);
    y += 8;
    doc.text(
      `Valor Dólar: $${Number(importacion.valor_dolar).toFixed(2)}`,
      12,
      y,
    );
    y += 8;
    doc.text(`FOB Total: $${Number(importacion.fob_total).toFixed(2)}`, 12, y);
    y += 8;
    doc.text(
      `Gastos Total: $${Number(importacion.gastos_total).toFixed(2)}`,
      12,
      y,
    );

    y += 18;

    // ==================== PRODUCTOS ====================
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Productos Importados", 12, y);
    y += 10;

    // Cabecera
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Producto", 12, y);
    doc.text("Cant.", 102, y);
    doc.text("Prov. precio", 122, y);
    doc.text("llegada USD", 152, y);
    doc.text("Perú S/", 187, y);
    y += 6;
    doc.line(12, y, pageWidth - 12, y);
    y += 8;

    // Productos con zebra stripes
    let isOdd = true;
    importacion.detalles?.forEach((d: any) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const precioLanded =
        Number(d.precio_unitario_proveedor) * Number(importacion.factor);
      const precioPeru = precioLanded * Number(importacion.valor_dolar);

      // Zebra stripes
      if (isOdd) {
        doc.setFillColor(245, 245, 245);
        doc.rect(10, y - 6, pageWidth - 20, 9, "F");
      }
      isOdd = !isOdd;

      doc.setFont("helvetica", "normal");
      const name = `${d.product?.name || ""} (${d.product?.base_code || ""})`;

      doc.text(name.substring(0, 38), 12, y);
      doc.text(d.cantidad.toString(), 107, y);
      doc.text(`$${Number(d.precio_unitario_proveedor).toFixed(2)}`, 125, y);
      doc.text(`$${precioLanded.toFixed(2)}`, 155, y);
      doc.text(`S/ ${precioPeru.toFixed(2)}`, 190, y);

      y += 9;
    });

    y += 15;

    // ==================== GASTOS ====================
    if (importacion.gastos && importacion.gastos.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Gastos de Importación", 12, y);
      y += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Descripción", 12, y);
      doc.text("Monto", 110, y); // ← Reducido 15 más
      doc.text("Moneda", 175, y);
      y += 6;
      doc.line(12, y, pageWidth - 12, y);
      y += 8;

      doc.setFont("helvetica", "normal");
      importacion.gastos.forEach((g: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(g.descripcion.substring(0, 48), 12, y);
        doc.text(g.monto.toString(), 110, y);
        doc.text(g.moneda, 180, y);
        y += 8;
      });
    }

    // Footer
    y = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(9);
    doc.text(
      `Generado el ${new Date().toLocaleDateString("es-ES")}`,
      pageWidth / 2,
      y,
      { align: "center" },
    );

    doc.save(`Importacion_${importacion.invoice_code}.pdf`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        Cargando...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between">
          <div>
            <h2 className="text-2xl font-bold">Detalle de Importación</h2>
            <p className="text-gray-600">
              Invoice: <strong>{importacion?.invoice_code}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-2xl">
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-auto p-6">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-6 mb-8 bg-gray-50 p-6 rounded-xl">
            <div>
              <p className="text-sm text-gray-600">Factor</p>
              <p className="text-3xl font-bold">
                {Number(importacion?.factor || 1).toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Valor Dólar</p>
              <p className="text-3xl font-bold">${importacion?.valor_dolar}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">FOB Total</p>
              <p className="text-3xl font-bold">
                ${Number(importacion?.fob_total || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Gastos Total</p>
              <p className="text-3xl font-bold text-orange-600">
                ${Number(importacion?.gastos_total || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Tabla de Productos */}
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-4 text-left">Producto</th>
                <th className="p-4 text-right">Precio Proveedor (USD)</th>
                <th className="p-4 text-right">Cantidad</th>
                <th className="p-4 text-right">Precio Landed (USD)</th>
                <th className="p-4 text-right">Precio en Perú (S/)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {importacion?.detalles?.map((d: any) => {
                const precioLanded =
                  Number(d.precio_unitario_proveedor) *
                  Number(importacion.factor);
                const precioPeru =
                  precioLanded * Number(importacion.valor_dolar);

                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium">
                      {d.product?.name} — {d.product?.base_code}
                    </td>
                    <td className="p-4 text-right">
                      ${Number(d.precio_unitario_proveedor).toFixed(2)}
                    </td>
                    <td className="p-4 text-right">{d.cantidad}</td>
                    <td className="p-4 text-right font-medium">
                      ${precioLanded.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-bold text-green-600">
                      S/ {precioPeru.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Botones */}
        <div className="p-6 border-t flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-8 py-3 text-gray-600 hover:bg-gray-100 rounded-xl"
          >
            Cerrar
          </button>
          <button
            onClick={descargarPDF}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2"
          >
            📄 Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
