// src/features/admin/components/AdminDashboardContent.tsx
export default function AdminDashboardContent() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">
        Bienvenido al Panel de Administración
      </h1>
      <p className="text-lg text-gray-700 mb-8">
        Aquí puedes gestionar usuarios, productos, reportes y más.
      </p>

      {/* Tarjetas rápidas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h3 className="text-xl font-semibold mb-2 text-blue-700">Usuarios</h3>
          <p className="text-gray-600">Gestiona cuentas y permisos</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h3 className="text-xl font-semibold mb-2 text-green-700">Productos</h3>
          <p className="text-gray-600">Administra catálogo y stock</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h3 className="text-xl font-semibold mb-2 text-purple-700">Reportes</h3>
          <p className="text-gray-600">Estadísticas y movimientos</p>
        </div>
      </div>
    </div>
  );
}