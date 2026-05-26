<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Importacion;
use App\Models\ImportacionDetalle;
use App\Models\ImportacionGasto;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ImportacionController extends Controller
{
    public function index()
    {
        $importaciones = Importacion::with(['user:id,name', 'detalles.product:id,name,base_code'])
            ->latest()
            ->paginate(15);

        return response()->json($importaciones);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'invoice_code'          => 'required|string|unique:importaciones',
            'bl_awb'                => 'nullable|string',
            'fecha_aviso'           => 'nullable|date',
            'fecha_llegada_almacen' => 'required|date',
            'proveedor_id'          => 'nullable|integer',
            'empresa_importadora_id' => 'nullable|integer',
            'valor_dolar'           => 'required|numeric|min:0',
            'fob_total'             => 'required|numeric|min:0',
            'notes'                 => 'nullable|string',

            // Detalles de productos
            'detalles' => 'required|array|min:1',
            'detalles.*.product_id' => 'required|exists:products,id',
            'detalles.*.precio_unitario_proveedor' => 'required|numeric|min:0',
            'detalles.*.cantidad'   => 'required|integer|min:1',
            'detalles.*.costo_declarado' => 'nullable|numeric|min:0',

            // Gastos (por si en el futuro los mandas desde el frontend)
            'gastos' => 'nullable|array',
            'gastos.*.descripcion'  => 'required|string',
            'gastos.*.monto'        => 'required|numeric|min:0',
            'gastos.*.moneda'       => 'required|in:USD,PEN',
        ]);

        return DB::transaction(function () use ($validated) {
            // Crear la importación siempre como BORRADOR
            $importacion = Importacion::create([
                'invoice_code'          => $validated['invoice_code'],
                'bl_awb'                => $validated['bl_awb'] ?? null,
                'fecha_aviso'           => $validated['fecha_aviso'] ?? null,
                'fecha_llegada_almacen' => $validated['fecha_llegada_almacen'],
                'proveedor_id'          => $validated['proveedor_id'] ?? null,
                'empresa_importadora_id' => $validated['empresa_importadora_id'] ?? null,
                'valor_dolar'           => $validated['valor_dolar'],
                'fob_total'             => $validated['fob_total'],
                'gastos_total'          => 0,
                'factor'                => 1.0000,
                'notes'                 => $validated['notes'] ?? null,
                'user_id'               => auth()->id(),
                'estado'                => 'borrador',        // ← Siempre empieza como borrador
            ]);

            $gastosTotal = 0;

            // 1. Buscamos el Almacén Principal dinámicamente (no fijamos ID 1)
            $warehouse = DB::table('warehouses')->where('code', 'PRINCIPAL')->first()
                         ?? DB::table('warehouses')->first();

            if (!$warehouse) {
                return response()->json(['message' => 'Error: No existe un almacén configurado en el sistema.'], 500);
            }

            // === Guardar Detalles (Productos RAW) ===
            foreach ($validated['detalles'] as $detalle) {
                $fobReal = $detalle['precio_unitario_proveedor'] * $detalle['cantidad'];
                $costoLanded = $fobReal * $importacion->factor;

                // Guardar el detalle de la importación
                ImportacionDetalle::create([
                    'importacion_id' => $importacion->id,
                    'product_id'     => $detalle['product_id'],
                    'precio_unitario_proveedor' => $detalle['precio_unitario_proveedor'],
                    'cantidad'       => $detalle['cantidad'],
                    'costo_declarado' => $detalle['costo_declarado'] ?? null,
                    'fob_real'       => $fobReal,
                    'costo_landed_unitario' => $costoLanded / $detalle['cantidad'],
                ]);

                // 2. BUSCAR O CREAR LA VARIANTE
                $variant = DB::table('product_variants')
                    ->where('product_id', $detalle['product_id'])
                    ->first();

                if (!$variant) {
                    $productData = DB::table('products')->where('id', $detalle['product_id'])->first();
                    $variantId = DB::table('product_variants')->insertGetId([
                        'product_id'  => $detalle['product_id'],
                        'sku'         => 'M-' . $productData->base_code,
                        'amperage'    => 60,
                        'is_finished' => 0,
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ]);
                    $variant = DB::table('product_variants')->where('id', $variantId)->first();
                }

                // 3. INYECTAR STOCK AL ALMACÉN (Usando el ID real que encontramos)
                $stockRecord = DB::table('stocks')
                    ->where('product_variant_id', $variant->id)
                    ->where('warehouse_id', $warehouse->id)
                    ->first();

                if ($stockRecord) {
                    DB::table('stocks')
                        ->where('id', $stockRecord->id)
                        ->increment('quantity', $detalle['cantidad']);
                } else {
                    DB::table('stocks')->insert([
                        'product_variant_id' => $variant->id,
                        'warehouse_id'       => $warehouse->id,
                        'quantity'           => $detalle['cantidad'],
                        'is_raw'             => 1,
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);
                }
            }


            // === Guardar Gastos (si vienen) ===
            if (!empty($validated['gastos'])) {
                foreach ($validated['gastos'] as $gasto) {
                    $montoConvertido = $gasto['moneda'] === 'USD'
                        ? $gasto['monto'] * $importacion->valor_dolar
                        : $gasto['monto'];

                    ImportacionGasto::create([
                        'importacion_id'   => $importacion->id,
                        'descripcion'      => $gasto['descripcion'],
                        'monto'            => $gasto['monto'],
                        'moneda'           => $gasto['moneda'],
                        'monto_convertido' => $montoConvertido,
                    ]);

                    $gastosTotal += $montoConvertido;
                }

                // Actualizar totales si hay gastos
                $importacion->update([
                    'gastos_total' => $gastosTotal,
                    'factor'       => $importacion->fob_total > 0
                        ? ($importacion->fob_total + $gastosTotal) / $importacion->fob_total
                        : 1,
                    'estado'       => 'completada'   // Solo cambia a completada si hay gastos
                ]);
            }

            return response()->json([
                'message' => 'Importación registrada correctamente',
                'importacion' => $importacion->load('detalles', 'gastos')
            ], 201);
        });
    }

    public function agregarGastos(Request $request, Importacion $importacion)
    {
        $validated = $request->validate([
            'gastos' => 'required|array|min:1',
            'gastos.*.descripcion' => 'required|string|max:255',
            'gastos.*.monto'       => 'required|numeric|min:0',
            'gastos.*.moneda'      => 'required|in:USD,PEN',
        ]);

        return DB::transaction(function () use ($validated, $importacion) {
            $gastosTotalUsd = 0;

            foreach ($validated['gastos'] as $gasto) {
                // Convertir TODO a dólares para el cálculo correcto
                $montoEnUsd = $gasto['moneda'] === 'USD'
                    ? $gasto['monto']
                    : $gasto['monto'] / $importacion->valor_dolar;   // ← PEN → USD

                ImportacionGasto::create([
                    'importacion_id'   => $importacion->id,
                    'descripcion'      => $gasto['descripcion'],
                    'monto'            => $gasto['monto'],
                    'moneda'           => $gasto['moneda'],
                    'monto_convertido' => $montoEnUsd,   // Guardamos en USD
                ]);

                $gastosTotalUsd += $montoEnUsd;
            }

            // Cálculo correcto del factor (todo en USD)
            $factor = $importacion->fob_total > 0
                ? ($importacion->fob_total + $gastosTotalUsd) / $importacion->fob_total
                : 1;

            // Actualizar importación
            $importacion->update([
                'gastos_total' => $gastosTotalUsd,   // Guardamos en USD
                'factor'       => $factor,
                'estado'       => 'completada'
            ]);

            return response()->json([
                'message' => 'Gastos agregados correctamente',
                'importacion' => $importacion->fresh()->load('detalles', 'gastos')
            ]);
        });
    }

    public function destroy(Importacion $importacion)
    {
        // Solo permitir eliminar si está en borrador
        if ($importacion->estado === 'completada') {
            return response()->json(['message' => 'No se puede eliminar una importación completada'], 403);
        }

        return DB::transaction(function () use ($importacion) {
            $importacion->detalles()->delete();
            $importacion->gastos()->delete();
            $importacion->delete();

            return response()->json([
                'message' => 'Importación eliminada correctamente'
            ]);
        });
    }

    public function show(Importacion $importacion)
    {
        $importacion->load(['detalles.product', 'gastos']);

        return response()->json($importacion);
    }
}
