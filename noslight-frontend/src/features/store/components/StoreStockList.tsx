import { Search, AlertCircle, Filter, Loader2, X, ArrowUpDown, CheckSquare } from "lucide-react";
import { useState, useEffect } from "react";


interface Product {
  id: number | string;
  name: string;
  brand?: string; 
  model?: string; // <-- Nuevo
  amps: string;
  poles: string | number;
  stock: number;
  minStock: number;
  sku: string;
}

export default function StoreStockList() {
  // --- 1. ESTADOS (Memoria de la interfaz) ---
  const [stockData, setStockData] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para los filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "low">("all");
  const [filterAmp, setFilterAmp] = useState("");
  const [filterPole, setFilterPole] = useState("");
  const [filterBrand, setFilterBrand] = useState("");


  
  const [filterModel, setFilterModel] = useState(""); // <-- Para el modelo
  const [filterInStock, setFilterInStock] = useState(false); // <-- Checkbox para ocultar agotados
  const [sortBy, setSortBy] = useState("name-asc"); // <-- Para ordenar la tabla
  // --- 2. CONEXIÓN A LA BASE DE DATOS ---
  useEffect(() => {
    const fetchStock = async () => {
      try {
        const token = localStorage.getItem("noslight_token");

        const response = await fetch(import.meta.env.VITE_API_URL + "/api/store/stock", {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setStockData(data);
        } else {
          console.error(
            "Error del servidor. Código de estado:",
            response.status,
          );
        }
      } catch (error) {
        console.error("Error de conexión:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStock();
  }, []);

  // --- 3. EXTRACCIÓN INTELIGENTE DE FILTROS ---
  // Extraemos todos los amperajes únicos que existen en la data (ignorando los vacíos "-")
  const uniqueAmps = Array.from(new Set(stockData.map((item) => item.amps)))
    .filter((amp) => amp !== "-")
    .sort();
 // Extraemos todos los polos únicos y limpiamos espacios invisibles
  const uniquePoles = Array.from(new Set(stockData.map((item) => String(item.poles || "").trim())))
    .filter((pole) => pole !== "" && pole !== "-" && pole !== "null" && pole !== "undefined")
    .sort();

  // Extraemos las marcas únicas, ignorando vacíos
  const uniqueBrands = Array.from(new Set(stockData.map((item) => item.brand)))
    .filter((brand) => brand && brand !== "-")
    .sort();

    // Extraemos los modelos únicos
  const uniqueModels = Array.from(new Set(stockData.map((item) => String(item.model || "").trim())))
    .filter((model) => model !== "" && model !== "-" && model !== "null" && model !== "undefined")
    .sort();

  // Función visual para los estados (colores)
  const getStockStatus = (stock: number, minStock: number) => {
    if (stock === 0)
      return { label: "Agotado", color: "bg-red-100 text-red-700" };
    if (stock <= minStock)
      return { label: "Bajo Stock", color: "bg-orange-100 text-orange-700" };
    return { label: "Óptimo", color: "bg-green-100 text-green-700" };
  };

  // --- 4. LÓGICA DE FILTRADO Y ORDENAMIENTO ---
  let processedData = stockData.filter((item) => {
    // Búsqueda y Estados
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" ? true : item.stock <= item.minStock;
    
    // El nuevo filtro: Solo con Stock
    const matchesInStock = filterInStock ? item.stock > 0 : true;

    // Desplegables
    const matchesAmp = filterAmp === "" ? true : item.amps === filterAmp;
    const matchesPole = filterPole === "" ? true : String(item.poles || "").trim() === filterPole.trim();
    const matchesBrand = filterBrand === "" ? true : item.brand === filterBrand;
    const matchesModel = filterModel === "" ? true : String(item.model || "").trim() === filterModel.trim();

    return matchesSearch && matchesStatus && matchesInStock && matchesAmp && matchesPole && matchesBrand && matchesModel;
  });

  // Aplicamos el ordenamiento
  processedData.sort((a, b) => {
    if (sortBy === "name-asc") return a.name.localeCompare(b.name);
    if (sortBy === "name-desc") return b.name.localeCompare(a.name);
    if (sortBy === "stock-desc") return b.stock - a.stock; // Mayor stock primero
    if (sortBy === "stock-asc") return a.stock - b.stock;  // Menor stock primero
    return 0;
  });

  const filteredData = processedData; // Pasamos el resultado final a la variable que usa la tabla

  // Función para limpiar todos los filtros de un clic  
  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterAmp("");
    setFilterPole("");
    setFilterBrand("");
    setFilterModel(""); 
    setFilterInStock(false); 
    setSortBy("name-asc");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-gray-900 tracking-tight">
            MI INVENTARIO
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Stock disponible para venta en vitrina
          </p>
        </div>

        {/* BARRA DE BÚSQUEDA GENERAL */}
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all shadow-sm"
            placeholder="Buscar por Nombre o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden mt-4">
        {/* BARRA DE HERRAMIENTAS Y FILTROS AVANZADOS */}
        <div className="px-6 py-4 border-b border-gray-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-gray-50/50">
          <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-gray-500">
            <Filter size={16} className="text-gray-400" />
            <span className="mr-2">Filtros:</span>

            {/* BOTONES RÁPIDOS */}
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-4 py-1.5 rounded-full transition-colors ${
                filterStatus === "all"
                  ? "bg-gray-800 text-white"
                  : "bg-white border border-gray-200 hover:bg-gray-100"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterStatus("low")}
              className={`px-4 py-1.5 rounded-full transition-colors ${
                filterStatus === "low"
                  ? "bg-orange-500 text-white"
                  : "bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100"
              }`}
            >
              Bajo Stock
            </button>
            {/* NUEVO BOTÓN: OCULTAR AGOTADOS */}
            <button
              onClick={() => setFilterInStock(!filterInStock)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-colors border ${
                filterInStock
                  ? "bg-green-50 text-green-700 border-green-200 font-bold"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <CheckSquare size={16} className={filterInStock ? "text-green-600" : "text-gray-400"} />
              Solo con stock
            </button>

            <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></div>

            {/* DESPLEGABLE AMPERAJE */}
            <select
              value={filterAmp}
              onChange={(e) => setFilterAmp(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-600"
            >
              <option value="">Cualquier Amperaje</option>
              {uniqueAmps.map((amp) => (
                <option key={amp} value={amp}>
                  {amp}
                </option>
              ))}
            </select>

            {/* DESPLEGABLE POLOS */}
            <select
              value={filterPole}
              onChange={(e) => setFilterPole(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-600"
            >
              <option value="">Cualquier Polo</option>
              {uniquePoles.map((pole) => (
                <option key={pole} value={pole}>
                  {pole} Polos
                </option>
              ))}
            </select>

            {/* DESPLEGABLE MARCA */}
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-600 font-bold"
            >
              <option value="">Cualquier Marca</option>
              {uniqueBrands.map((brand) => (
                <option key={brand} value={brand as string}>
                  {brand}
                </option>
              ))}
            </select>

            {/* DESPLEGABLE MODELO */}
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-600 font-bold"
            >
              <option value="">Cualquier Modelo</option>
              {uniqueModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>

            {/* ORDENAMIENTO (Tirado a la derecha) */}
            <div className="flex items-center gap-2 ml-auto pl-4 border-l border-gray-200">
              <ArrowUpDown size={16} className="text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="py-1.5 pl-2 pr-6 bg-transparent border-none focus:ring-0 cursor-pointer text-sm font-bold text-gray-700"
              >
                <option value="name-asc">A - Z</option>
                <option value="name-desc">Z - A</option>
                <option value="stock-desc">Mayor Stock</option>
                <option value="stock-asc">Menor Stock</option>
              </select>
            </div>
          </div>

          {/* BOTÓN LIMPIAR FILTROS (Solo aparece si hay algún filtro activo) */}
          {(searchTerm !== "" ||
            filterStatus !== "all" ||
            filterAmp !== "" ||
            filterPole !== "" ||
            filterBrand !== ""
          ) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <X size={14} />
              Limpiar filtros
            </button>
          )}
        </div>

        {/* TABLA DE RESULTADOS */}
        <div className="overflow-x-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-blue-500">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p className="font-bold text-sm text-gray-400">
                Sincronizando con almacén...
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] uppercase tracking-widest text-gray-400 font-bold bg-white">
                  <th className="px-6 py-5">Producto (SKU)</th>
                  <th className="px-6 py-5 text-center">Amp.</th>
                  <th className="px-6 py-5 text-center">Polos</th>
                  <th className="px-6 py-5 text-center">Marca</th>
                  <th className="px-6 py-5 text-center">Stock Disponible</th>
                  <th className="px-6 py-5 text-center">Estado</th>
                  <th className="px-6 py-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.length > 0 ? (
                  filteredData.map((product) => {
                    const status = getStockStatus(
                      product.stock,
                      product.minStock,
                    );

                    // AQUÍ ESTÁ EL MAQUILLAJE VISUAL QUE OCULTA LA M- EN LA TIENDA
                    const displaySku = product.sku.replace(/^M-/, "");

                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-blue-50/30 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-800">
                            {product.name}
                          </p>
                          <p className="text-xs text-gray-400 font-medium">
                            {displaySku}
                          </p>{" "}
                          {/* SE USA DISPLAY SKU */}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-gray-600">
                          {product.amps}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-gray-600">
                          {product.poles}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {product.brand ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black bg-slate-100 text-slate-700 uppercase tracking-wider border border-slate-200">
                              {product.brand}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-lg font-black text-gray-800">
                            {product.stock}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold cursor-help ${status.color}`}
                            title={`Se recomienda pedir por caja completa (${product.minStock} unds)`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {product.stock <= product.minStock && (
                            <button
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors opacity-0 group-hover:opacity-100"
                              title="Solicitar al almacén"
                            >
                              <AlertCircle size={16} />
                              <span>Solicitar</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-20 text-center text-gray-400 font-bold italic tracking-widest"
                    >
                      NO HAY PRODUCTOS QUE COINCIDAN CON ESTOS FILTROS
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
