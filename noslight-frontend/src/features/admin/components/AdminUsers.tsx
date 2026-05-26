// src/features/admin/components/AdminUsers.tsx
import { useState } from "react";
import {
  useAdminUsers,
  useDeleteUser,
  useCreateUser,
  useUpdateUser,
} from "../hooks/useAdminUsers";
import { useToast } from "@/components/ToastProvider";


export default function AdminUsers() {
  const { success, error: toastError } = useToast();
  const [view, setView] = useState<"list" | "form">("list");
  const [editingUser, setEditingUser] = useState<any>(null);

  const { data: users = [], isLoading, error } = useAdminUsers();
  const deleteMutation = useDeleteUser();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  // Estados del formulario
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("WAREHOUSE");

  const isEditing = !!editingUser;

  const handleCreateClick = () => {
    setEditingUser(null);
    resetForm();
    setView("form");
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setPassword("");
    setView("form");
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("WAREHOUSE");
  };

  const handleBackToList = () => {
    setView("list");
    setEditingUser(null);
    resetForm();
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`¿Seguro que quieres eliminar a ${name}?`)) return;

    deleteMutation.mutate(id, {
      onSuccess: () => success(`Usuario ${name} eliminado correctamente`),
      onError: (err: any) => toastError(`No se pudo eliminar: ${err.message || "Error desconocido"}`),
    });
  };

  const handleSubmit = () => {
    if (!name || !email) {
      toastError("Nombre y email son obligatorios");
      return;
    }

    const payload = {
      name,
      email,
      role,
      ...(password && { password, password_confirmation: password }),
    }as any;

    if (isEditing && editingUser) {
      // === EDITAR USUARIO ===
      updateMutation.mutate(
        { id: editingUser.id, ...payload },
        {
          onSuccess: () => {
            success("Usuario actualizado correctamente");
            handleBackToList();
          },
          onError: (err: any) => {
            toastError(`Error al actualizar: ${err.response?.data?.message || err.message}`);
          },
        }
      );
    } else {
      // === CREAR USUARIO ===
      createMutation.mutate(payload, {
        onSuccess: () => {
          success("Usuario creado con éxito 🎉");
          handleBackToList();
        },
        onError: (err: any) => {
          toastError(`Error al crear usuario: ${err.response?.data?.message || err.message}`);
        },
      });
    }
  };

  if (isLoading) return <div className="text-center py-10 text-gray-600">Cargando usuarios...</div>;
  if (error) return <div className="text-red-600 text-center py-10">Error: {error.message}</div>;

  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {view === "list" ? "Gestión de Usuarios" : (isEditing ? "Editar Usuario" : "Crear Nuevo Usuario")}
        </h2>

        {view === "list" ? (
          <button
            onClick={handleCreateClick}
            className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            ➕ Crear Nuevo Usuario
          </button>
        ) : (
          <button
            onClick={handleBackToList}
            className="bg-gray-500 text-white px-5 py-2 rounded-lg hover:bg-gray-600 transition"
          >
            ← Volver a la lista
          </button>
        )}
      </div>

      {/* LISTA DE USUARIOS */}
      {view === "list" && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{user.role}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEditClick(user)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FORMULARIO CREAR / EDITAR */}
      {view === "form" && (
        <div className="max-w-lg mx-auto bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-xl font-semibold mb-6 text-center text-gray-800">
            {isEditing ? "Editar Usuario" : "Crear Nuevo Usuario"}
          </h3>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej: Juan Pérez"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="ejemplo@noslight.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isEditing ? "Nueva contraseña (dejar en blanco si no quieres cambiarla)" : "Contraseña"}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="ADMIN">Administrador</option>
                <option value="WAREHOUSE">Almacén</option>
                <option value="STORE">Tienda</option>
              </select>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={handleBackToList}
                className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-medium"
              >
                {isEditing ? "Guardar Cambios" : "Crear Usuario"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}