import React, { useState } from 'react';

// Le decimos a React qué datos necesita este componente para funcionar
interface ExcelActionsProps {
  exportUrl: string;
  importUrl: string;
  onSuccess: () => void;
}

export const ExcelActions: React.FC<ExcelActionsProps> = ({ exportUrl, importUrl, onSuccess }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleDownload = () => {
    setIsDownloading(true);
    
    setTimeout(() => {
      // 1. Creamos un enlace invisible en el código
      const link = document.createElement('a');
      link.href = exportUrl;
      
      // 2. Le decimos al navegador que esto es estrictamente una descarga
      link.setAttribute('download', 'formato_productos.xlsx'); 
      
      // 3. Lo agregamos a la pantalla, lo "cliqueamos" mágicamente y lo borramos
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsDownloading(false);
    }, 800); 
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Protección: Verificar que sea Excel
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExtension || '')) {
        alert("⚠️ Por favor, sube solo archivos de Excel (.xlsx, .xls o .csv)");
        event.target.value = '';
        return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(importUrl, { method: 'POST', body: formData });
      if (response.ok) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        onSuccess(); // Actualiza la tabla del componente padre
      } else {
        alert("Error al importar el archivo.");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3 relative">
      {/* Banner flotante automático */}
      {showSuccess && (
        <div className="absolute -top-14 left-0 w-max bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg shadow animate-fade-in-down z-50">
          ✅ Excel importado con éxito
        </div>
      )}

      {/* Botón Descargar con estado de carga */}
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className={`${isDownloading ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-3 rounded-xl flex items-center gap-2 transition font-medium`}
      >
        {isDownloading ? '⏳ Procesando...' : '⬇️ Formato'}
      </button>

      {/* Botón Subir con estado de carga */}
      <label className={`${isUploading ? 'bg-gray-500 cursor-wait' : 'bg-gray-800 hover:bg-gray-900 cursor-pointer'} text-white px-4 py-3 rounded-xl flex items-center gap-2 transition font-medium`}>
        {isUploading ? '⏳ Subiendo...' : '⬆️ Subir Excel'}
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          className="hidden"
          onChange={handleUpload}
          disabled={isUploading}
        />
      </label>
    </div>
  );
};