import { useState, useEffect } from "react";
import { Search, ShoppingCart, Plus, Minus, Trash2, Tag } from "lucide-react";
import CheckoutModal from "./CheckoutModal"; // O ajusta la ruta si lo guardaste en otra carpeta

// Tipos de datos blindados
interface Product {
  id: number | string;
  name: string;
  sku: string;
  stock: number;
  cost_price?: number;
  brand?: string;
  amps?: string;
  poles?: string | number; // Agregamos polos
  sale_price?: number; // Para mostrar el precio de venta si existe
  base_price?: number; // Para mostrar el precio base si no hay precio de venta
}

interface CartItem extends Product {
  cartId: string;
  quantity: number;
  unit_price: number; // Precio unitario editable
}

export default function NewSalePage() {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Estados para los 3 filtros
  const [activeBrand, setActiveBrand] = useState("Todos");
  const [activeAmp, setActiveAmp] = useState("Todos");
  const [activePole, setActivePole] = useState("Todos");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Función para el color de la tarjeta según la marca
  const getBrandColor = (brand?: string) => {
    if (!brand) return "border-t-gray-200";
    const b = brand.toLowerCase();
    if (b.includes("schneider"))
      return "border-t-green-500 hover:border-green-500 hover:shadow-green-100";
    if (b.includes("abb"))
      return "border-t-red-500 hover:border-red-500 hover:shadow-red-100";
    if (b.includes("bticino"))
      return "border-t-blue-500 hover:border-blue-500 hover:shadow-blue-100";
    if (b.includes("siemens"))
      return "border-t-orange-500 hover:border-orange-500 hover:shadow-orange-100";
    if (b.includes("general"))
      return "border-t-yellow-500 hover:border-yellow-500 hover:shadow-yellow-100";
    return "border-t-purple-500 hover:border-purple-500 hover:shadow-purple-100";
  };

  // Extraemos la función para poder llamarla cuando queramos
  const fetchStock = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("noslight_token");
      const response = await fetch("import.meta.env.VITE_API_URL/api/store/stock", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();

        // 👇 ESTE ES EL CHISMOSO: Imprimirá TODO lo que trae el primer producto
        console.log("🔎 REVISIÓN DE PRECIOS:", data[0]);

        setProducts(data.filter((p: any) => p.stock > 0));
      }
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Se ejecuta al entrar a la página
  useEffect(() => {
    fetchStock();
  }, []);

  // Extracción tipada para que TypeScript no se queje (solución a los errores rojos)
  const uniqueBrands = Array.from(new Set(products.map((p) => p.brand)))
    .filter((b) => b && b !== "-")
    .sort() as string[];
  const uniqueAmps = Array.from(new Set(products.map((p) => p.amps)))
    .filter((a) => a && a !== "-")
    .sort() as string[];
  const uniquePoles = Array.from(new Set(products.map((p) => String(p.poles))))
    .filter((p) => p !== "undefined" && p !== "-" && p !== "null")
    .sort() as string[];

  // Lógica del filtro (Busca y aplica los 3 botones)
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand =
      activeBrand === "Todos" ? true : p.brand === activeBrand;
    const matchesAmp = activeAmp === "Todos" ? true : p.amps === activeAmp;
    const matchesPole =
      activePole === "Todos" ? true : String(p.poles) === activePole;

    return matchesSearch && matchesBrand && matchesAmp && matchesPole;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existingItem = prev.find((item) => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity < product.stock) {
          return prev.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }
        return prev;
      }

      const defaultPrice = product.sale_price || product.base_price || 0;

      return [
        ...prev,
        {
          ...product,
          cartId: Math.random().toString(),
          quantity: 1,
          unit_price: defaultPrice, // <-- Estandarizado
        },
      ];
    });
  };

  const updateQuantity = (id: string | number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQuantity = item.quantity + delta;
          if (newQuantity > 0 && newQuantity <= item.stock)
            return { ...item, quantity: newQuantity };
        }
        return item;
      }),
    );
  };

  const setItemQuantity = (id: string | number, newQuantity: number) => {
    if (isNaN(newQuantity) || newQuantity < 1) return;
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const validQuantity = Math.min(newQuantity, item.stock);
          return { ...item, quantity: validQuantity };
        }
        return item;
      }),
    );
  };

  const updatePrice = (id: string | number, newPrice: string) => {
    const price = parseFloat(newPrice) || 0;
    setCart(
      (prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, unit_price: price } : item,
        ), // <-- Estandarizado
    );
  };

  const removeFromCart = (id: string | number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0,
  ); // <-- Estandarizado

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-6">
      {/* PANEL IZQUIERDO: CATÁLOGO */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* CABECERA Y FILTROS */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-black italic text-gray-900 tracking-tight">
              NUEVA VENTA
            </h2>
            <button
              onClick={() => {
                setActiveBrand("Todos");
                setActiveAmp("Todos");
                setActivePole("Todos");
                setSearchTerm("");
              }}
              className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              Limpiar Todo
            </button>
          </div>

          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-3 border border-gray-200 rounded-2xl bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium"
              placeholder="Escribe el código o nombre del producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* LAS 3 FILAS DE PÍLDORAS */}
          <div className="space-y-3">
            {/* 1. Marcas */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-12 shrink-0">Marca</span>
              <button
                onClick={() => setActiveBrand("Todos")}
                className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors ${activeBrand === "Todos" ? "bg-gray-800 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-100"}`}
              >
                Todos
              </button>
              {uniqueBrands.map((b) => (
                <button
                  key={`brand-${b}`}
                  onClick={() => setActiveBrand(b)}
                  className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors ${activeBrand === b ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-white text-gray-500 border border-gray-200 hover:bg-blue-50"}`}
                >
                  {b}
                </button>
              ))}
            </div>

            {/* 2. Amperajes */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-12 shrink-0">Amp.</span>
              <button
                onClick={() => setActiveAmp("Todos")}
                className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors ${activeAmp === "Todos" ? "bg-gray-800 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-100"}`}
              >
                Todos
              </button>
              {uniqueAmps.map((a) => (
                <button
                  key={`amp-${a}`}
                  onClick={() => setActiveAmp(a)}
                  className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors ${activeAmp === a ? "bg-purple-600 text-white shadow-md shadow-purple-200" : "bg-white text-gray-500 border border-gray-200 hover:bg-purple-50"}`}
                >
                  {a}
                </button>
              ))}
            </div>

            {/* 3. Polos */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-12 shrink-0">Polos</span>
              <button
                onClick={() => setActivePole("Todos")}
                className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors ${activePole === "Todos" ? "bg-gray-800 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-100"}`}
              >
                Todos
              </button>
              {uniquePoles.map((p) => (
                <button
                  key={`pole-${p}`}
                  onClick={() => setActivePole(p)}
                  className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors ${activePole === p ? "bg-orange-500 text-white shadow-md shadow-orange-200" : "bg-white text-gray-500 border border-gray-200 hover:bg-orange-50"}`}
                >
                  {p} Polos
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* GRILLA DE PRODUCTOS */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          {isLoading ? (
            <p className="text-center text-gray-400 font-bold mt-10">Cargando inventario...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-center text-gray-400 font-bold mt-10">No hay productos con esos filtros.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => {
                const displaySku = product.sku.replace(/^M-/, "");
                const colorBorder = getBrandColor(product.brand);

                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`flex flex-col text-left bg-white p-4 rounded-2xl border-x border-b border-t-4 border-x-gray-100 border-b-gray-100 shadow-sm transition-all group ${colorBorder}`}
                  >
                    <div className="flex justify-between items-start w-full mb-1">
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider">{displaySku}</span>
                      {product.brand && product.brand !== "-" && (
                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-widest border border-slate-200">{product.brand}</span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm mb-3 leading-tight flex-1 mt-1">{product.name}</h3>
                    <div className="flex justify-between items-end w-full mt-auto pt-3 border-t border-gray-50">
                      <span className="text-xs font-bold text-gray-400">Stock: {product.stock}</span>
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-black group-hover:bg-blue-600 group-hover:text-white transition-colors">+ Agregar</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* PANEL DERECHO: EL CARRITO */}
      <div className="w-[400px] xl:w-[450px] flex flex-col bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden shrink-0 relative">
        <div className="p-6 bg-gray-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <ShoppingCart className="text-blue-400" />
            <h2 className="text-xl font-black">Ticket de Venta</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <ShoppingCart size={48} className="opacity-20" />
              <p className="font-bold text-sm">El carrito está vacío</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.cartId} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="pr-4">
                    <p className="text-xs font-black text-blue-600">{item.sku.replace(/^M-/, "")}</p>
                    <p className="text-sm font-bold text-gray-800 leading-tight">{item.name}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-300 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 p-1">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-gray-500 hover:text-black">
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={item.stock}
                      className="w-12 text-center font-black text-sm bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={item.quantity}
                      onChange={(e) => setItemQuantity(item.id, parseInt(e.target.value))}
                      onFocus={(e) => e.target.select()}
                    />
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-gray-500 hover:text-black disabled:opacity-30">
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className={`font-bold transition-colors ${item.unit_price === 0 ? "text-red-400" : "text-gray-400"}`}>S/</span>
                    <input
                      type="number"
                      min="0"
                      step="0.10"
                      className={`w-20 text-right font-black text-lg border-b-2 focus:outline-none bg-transparent transition-colors ${
                        item.unit_price === 0
                          ? "text-red-500 border-red-300 focus:border-red-500 placeholder-red-300"
                          : "text-gray-800 border-gray-200 focus:border-blue-500"
                      }`}
                      value={item.unit_price === 0 ? "" : item.unit_price}
                      onChange={(e) => updatePrice(item.id, e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-white border-t border-gray-100 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-10">
          <div className="flex justify-between items-end mb-6">
            <span className="text-gray-500 font-bold text-sm">Total a cobrar ({totalItems} items)</span>
            <span className="text-4xl font-black text-blue-600 tracking-tight">S/ {totalAmount.toFixed(2)}</span>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-lg shadow-blue-200 disabled:shadow-none flex items-center justify-center gap-2"
          >
            <Tag size={20} />
            PROCEDER AL COBRO
          </button>
        </div>
      </div>

      {/* RENDERIZAMOS EL MODAL AQUÍ */}
      {isCheckoutOpen && (
        <CheckoutModal
          totalAmount={totalAmount}
          items={cart}
          onClose={() => setIsCheckoutOpen(false)}
          onConfirm={async (saleData) => {
            const payload = {
              saleType: saleData.saleType,
              customer_id: saleData.customer_id,
              customerName: saleData.customerName,
              items: cart, // Envía el arreglo completo de CartItem conteniendo la llave unit_price
              payments: saleData.payments,
            };
            try {
              const token = localStorage.getItem("noslight_token");
              const res = await fetch("import.meta.env.VITE_API_URL/api/sales", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
              });
              if (res.ok) {
                alert("¡Venta registrada con éxito!");
                setCart([]);
                setIsCheckoutOpen(false);
                fetchStock();
                return true;
              } else {
                const error = await res.json();
                alert("Error al cobrar: " + (error.message || "Revisa el stock"));
                return false;
              }
            } catch (err) {
              alert("Error de conexión al servidor.");
              return false;
            }
          }}
        />
      )}
      
    </div>
  );
}
