<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transformation;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Stock;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Models\StockMovement;


class TransformationController extends Controller
{
    public function store(Request $request)
{
    // 1. Validación estricta
    $request->validate([
        'raw_product_id' => 'required|exists:products,id',
        'finished_product_id' => 'required|exists:products,id',
        'quantity' => 'required|integer|min:1',
        'notes' => 'nullable|string|max:500',
    ]);

    $rawProduct = Product::findOrFail($request->raw_product_id);
    $finishedProduct = Product::findOrFail($request->finished_product_id);

    // 2. Único almacén necesario: PRINCIPAL (El limbo/tránsito donde se procesa la transformación)
    $principal = Warehouse::where('code', 'PRINCIPAL')->first() ?? Warehouse::first();

    return DB::transaction(function () use ($request, $rawProduct, $finishedProduct, $principal) {

        // --- A. BUSCAR Y DESCONTAR DEL RAW EN ALMACÉN PRINCIPAL ---
        $rawVariant = ProductVariant::where('product_id', $rawProduct->id)->first();

        if (!$rawVariant) {
            throw ValidationException::withMessages(['general' => 'El producto RAW seleccionado no tiene stock inicializado.']);
        }

        $rawStock = Stock::where('product_variant_id', $rawVariant->id)
            ->where('warehouse_id', $principal->id)
            ->lockForUpdate() // Evita problemas de concurrencia
            ->first();

        if (!$rawStock || $rawStock->quantity < $request->quantity) {
            throw ValidationException::withMessages(['quantity' => 'Stock RAW insuficiente en el Almacén Principal.']);
        }

        $rawStock->decrement('quantity', $request->quantity);

        // --- B. BUSCAR Y SUMAR AL TERMINADO EN EL MISMO ALMACÉN (LIMBO) ---
        $finishedVariant = ProductVariant::firstOrCreate(
            ['product_id' => $finishedProduct->id],
            [
                'sku' => $finishedProduct->base_code,
                'amperage' => 0,
                'is_finished' => true,
            ]
        );

        $finishedStock = Stock::firstOrCreate(
            [
                'product_variant_id' => $finishedVariant->id,
                'warehouse_id' => $principal->id, // Guardado estrictamente en Almacén
            ],
            ['quantity' => 0, 'is_raw' => 0]
        );

        $finishedStock->increment('quantity', $request->quantity);

        // --- C. GUARDAR EL HISTORIAL DE LA OPERACIÓN ---
        // Ejecuta la inserción directa sin declarar variables opacas
        Transformation::create([
            'product_id' => $rawProduct->id,
            'raw_amperage' => 0,
            'finished_amperage' => 0,
            'quantity' => $request->quantity,
            'user_id' => auth()->id(),
            'warehouse_id' => $principal->id,
            'notes' => $request->notes,
        ]);

        return response()->json([
            'message' => 'Transformación registrada exitosamente en el Almacén de origen.',
            'stock_raw_remaining' => $rawStock->fresh()->quantity,
        ], 201);
    });
}
    /**
     * Listar todas las transformaciones (historial)
     */
    public function index(Request $request)
    {
        $transformations = Transformation::query()
            ->with(['product:id,name,base_code,model', 'user:id,name', 'warehouse:id,name,code']) // relaciones mínimas para no sobrecargar
            ->when($request->product_id, fn($q) => $q->where('product_id', $request->product_id))
            ->when($request->date_from, fn($q) => $q->whereDate('created_at', '>=', $request->date_from))
            ->when($request->date_to, fn($q) => $q->whereDate('created_at', '<=', $request->date_to))
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->latest('created_at') // más reciente primero
            ->paginate(20); // 20 por página

        return response()->json($transformations);
    }

    /**
     * Obtener posibles transformaciones para un producto Raw específico
     * Ejemplo: GET /api/transformations/possible?raw_product_id=4&raw_amperage=60
     */
    /*public function possible(Request $request)
    {
        $request->validate([
            'raw_product_id' => 'required|exists:products,id',
            'raw_amperage'   => 'required|integer|min:1',
        ]);

        $rawProduct = Product::findOrFail($request->raw_product_id);

        // Obtener las posibles transformaciones configuradas
        $transformations = $rawProduct->possibleFinishedProducts()
            ->wherePivot('raw_amperage', $request->raw_amperage)
            ->get();

        // Formatear la respuesta para que sea fácil de usar en el frontend
        $possible = $transformations->map(function ($finishedProduct) {
            $pivot = $finishedProduct->pivot;

            return [
                'id' => $pivot->id, // <--- ✨ ESTA ES LA LÍNEA NUEVA ✨
                'finished_product_id' => $finishedProduct->id,
                'finished_product_name' => $finishedProduct->name,
                'finished_amperage' => $pivot->finished_amperage,
                'sku' => $finishedProduct->getSkuAttribute() ?? $finishedProduct->base_code,
                'conversion_rate' => (float) $pivot->conversion_rate,
                'extra_cost' => (float) $pivot->extra_cost,
                'notes' => $pivot->notes,
            ];
        });

        return response()->json([
            'raw_product' => [
                'id' => $rawProduct->id,
                'name' => $rawProduct->name,
                'base_code' => $rawProduct->base_code,
                'is_raw' => $rawProduct->is_raw,
            ],
            'raw_amperage' => (int) $request->raw_amperage,
            'possible_finished' => $possible,
            'total_possible' => $possible->count(),
        ]);
    }*/

    /**
     * Obtener posibles transformaciones para un producto Raw específico (LIBERADO)
     * Muestra el catálogo completo de productos terminados para libre configuración
     */
    public function possible(Request $request)
    {
        // 🔥 TRUCO DE AUDITORÍA: Forzamos la muerte de la API para ver si pasa por aquí
        dd("¡ALERTA! LARAVEL SÍ ESTÁ LEYENDO ESTE ARCHIVO CORRECTAMENTE");

        $request->validate([
            'raw_product_id' => 'required|exists:products,id',
            'raw_amperage'   => 'required|integer|min:1',
        ]);

        $rawProduct = Product::findOrFail($request->raw_product_id);

        // 🔥 LIBERACIÓN ABSOLUTA: Trae el 100% de productos terminados del sistema
        // No le importa el stock, ni el almacén, ni restringe por el amperaje del pivote.
        $allFinishedProducts = Product::where('is_raw', 0)
            ->orderBy('name', 'asc')
            ->get();

        // Formateamos la respuesta en espejo idéntica a lo que espera tu Frontend (React)
        // para que no rompa ninguna propiedad ni etiqueta visual de la lista
        $possible = $allFinishedProducts->map(function ($finishedProduct) {
            return [
                'id' => $finishedProduct->id, // Mapea directo al ID para el combobox
                'finished_product_id' => $finishedProduct->id,
                'finished_product_name' => $finishedProduct->name,
                'finished_amperage' => $finishedProduct->amperage ?? 0,
                'sku' => $finishedProduct->base_code,
                'conversion_rate' => 1.0, // Valores por defecto estables
                'extra_cost' => 0.0,
                'notes' => null,
            ];
        });

        return response()->json([
            'raw_product' => [
                'id' => $rawProduct->id,
                'name' => $rawProduct->name,
                'base_code' => $rawProduct->base_code,
                'is_raw' => $rawProduct->is_raw,
            ],
            'raw_amperage' => (int) $request->raw_amperage,
            'possible_finished' => $possible,
            'total_possible' => $possible->count(),
        ]);
    }
}
