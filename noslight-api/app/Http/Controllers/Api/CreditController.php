<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Sale;
use App\Models\Customer;
use App\Models\SaleItem;
use Illuminate\Support\Facades\DB;


class CreditController extends Controller
{
    /**
     * 1. Trae todos los despachos que el vendedor hizo a crédito
     * y que están esperando que tú les pongas precio.
     */
    public function getPending()
    {
        // Traemos todas las ventas pendientes con sus productos
        $sales = \App\Models\Sale::where('status', 'pending_verification')
            ->with(['customer', 'items.productVariant.product'])
            ->orderBy('created_at', 'desc')
            ->get();

        $grouped = [];

        // Agrupamos POR CLIENTE
        foreach ($sales as $sale) {
            $customerId = $sale->customer_id ?: 0;
            $customerName = $sale->customer ? $sale->customer->name : ($sale->customer_name ?: 'Público General');
            $date = $sale->created_at->format('Y-m-d');

            $key = 'cliente_' . $customerId; // Llave única por cliente

            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'group_id' => $key,
                    'customer_id' => $customerId,
                    'customer_name' => $customerName,
                    'sale_ids' => [],
                    'estimated_total' => 0, // El total de referencia
                    'days' => [] // Aquí separaremos los días internamente
                ];
            }

            // Agregamos el ID de este despacho
            $grouped[$key]['sale_ids'][] = $sale->id;

            // Sumamos el monto base al estimado total
            $grouped[$key]['estimated_total'] += $sale->total_amount;

            // Creamos el espacio para este día si no existe
            if (!isset($grouped[$key]['days'][$date])) {
                $grouped[$key]['days'][$date] = [];
            }

            // Metemos los productos al saco de su día correspondiente
            foreach ($sale->items as $item) {
                $itemArray = $item->toArray();
                $itemArray['receipt_number'] = $sale->receipt_number;
                $itemArray['time'] = $sale->created_at->format('H:i');
                $grouped[$key]['days'][$date][] = $itemArray;
            }
        }

        // Formateamos el arreglo de días para que sea fácil leerlo en React
        foreach ($grouped as &$group) {
            $formattedDays = [];
            foreach ($group['days'] as $d => $items) {
                $formattedDays[] = [
                    'date' => $d,
                    'items' => $items
                ];
            }
            // Ordenamos para que los días más recientes salgan primero
            usort($formattedDays, function ($a, $b) {
                return strtotime($b['date']) - strtotime($a['date']);
            });
            $group['days'] = $formattedDays;
        }

        return response()->json(array_values($grouped));
    }

    /**
     * 2. Recibe los precios que tú decidiste, recalcula el total,
     * y le clava la deuda al cliente.
     */
    public function approve(Request $request, $id)
    {
        // Validamos que desde React nos manden los precios correctamente
        $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|exists:sale_items,id',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request, $id) {
            $sale = Sale::findOrFail($id);

            // Evitamos que por error apruebes dos veces lo mismo
            if ($sale->status !== 'pending_verification') {
                return response()->json(['message' => 'Este despacho ya fue valorizado y cobrado.'], 400);
            }

            // Usaremos exactamente el mismo nombre en todo el código
            $newTotal = 0;

            // Recorremos los productos y les ponemos el precio final que elegiste
            foreach ($request->items as $itemData) {
                $saleItem = SaleItem::where('id', $itemData['id'])->where('sale_id', $sale->id)->firstOrFail();

                $subtotal = $saleItem->quantity * $itemData['unit_price'];

                $newTotal += $subtotal;

                $saleItem->update([
                    'unit_price' => $itemData['unit_price'],
                    'subtotal'   => $subtotal,
                ]);
            }

            // 3. Actualizamos la Venta
            $sale->update([
                'total_amount' => $newTotal,
                'pending_balance' => $newTotal, // 👈 NUEVO: Empieza debiendo todo el ticket
                'status' => 'credit'
            ]);

            // ¡El toque final! Le sumamos esta deuda al saldo del cliente
            if ($sale->customer_id) {
                $customer = Customer::findOrFail($sale->customer_id);
                $customer->increment('credit_balance', $newTotal);
            }

            return response()->json([
                'message' => '¡Precios fijados! La deuda se ha sumado a la cuenta del cliente.',
                'sale' => $sale
            ]);
        });
    }


    public function getAccounts()
    {
        $customers = Customer::with([
            'credits' => function ($query) {
                $query->orderBy('created_at', 'desc');
            },
            'sales' => function ($query) {
                $query->whereIn('status', ['credit', 'paid', 'consolidated_credit'])
                    ->with('items.productVariant.product')
                    ->orderBy('created_at', 'desc');
            },
            'creditPayments' => function ($query) {
                $query->orderBy('created_at', 'desc');
            }
        ])
            ->orderBy('name', 'asc')
            ->get();

        $customers->transform(function ($customer) {
            $legacyDebt = collect($customer->sales)->where('status', 'credit')->sum(function ($sale) {
                return collect($sale['items'])->sum('subtotal');
            });

            $newDocumentDebt = DB::table('credits')
                ->where('customer_id', $customer->id)
                ->whereIn('status', ['pending', 'partial'])
                ->sum('remaining_amount');

            $customer->credit_balance = (float)($legacyDebt + $newDocumentDebt);

            // 🟢 MAPEO ESPEJO ADAPTADO AL SLIDER DE REACT
            $mappedCredits = $customer->credits->map(function ($credit) use ($customer) {
                $connectedSaleIds = DB::table('credit_sales')
                    ->where('credit_id', $credit->id)
                    ->pluck('sale_id')
                    ->toArray();

                $consolidatedItems = [];
                foreach ($customer->sales as $sale) {
                    if (in_array($sale->id, $connectedSaleIds)) {
                        foreach ($sale->items as $item) {
                            $consolidatedItems[] = $item;
                        }
                    }
                }

                // Generamos el formato exacto que exige la página 36 y 37 de tu PDF
                return [
                    'id' => $credit->id,
                    'customer_id' => $credit->customer_id,
                    'total_amount' => (float)$credit->total_amount,
                    'pending_balance' => (float)$credit->remaining_amount, // 🟢 Campo crítico que React filtra
                    'paid_amount' => (float)$credit->paid_amount,
                    'status' => 'credit',
                    'real_status' => $credit->status,
                    'created_at' => $credit->created_at->toDateTimeString(),
                    'updated_at' => $credit->updated_at->toDateTimeString(),
                    // 🟢 DEJA LA PROPIEDAD 'NOTES' LIMPIA Y NATIVA (Dentro de $mappedCredits):
                    'notes' => $credit->notes, // Ya no usamos str_replace, viaja el código real 'LOTE-VALORIZADO-...'

                    'id_compuesto' => $credit->notes,
                    'items' => $consolidatedItems,
                    'is_consolidated_lote' => true
                ];
            });

            $customer->sales = collect($customer->sales)->merge($mappedCredits)->toArray();

            return $customer;
        });

        return response()->json($customers);
    }



    /**
     * 4. Registrar un Abono a la deuda del cliente.
     */
    /*public function addPayment(Request $request, $customerId)
    {
        $request->validate([
            'payments' => 'required|array|min:1',
            'payments.*.amount' => 'required|numeric|min:0.1',
            'payments.*.method' => 'required|string',
        ]);

        return DB::transaction(function () use ($request, $customerId) {
            $customer = Customer::findOrFail($customerId);

            // 1. Calculamos cuánto dinero nos están dando en total
            $totalPaid = collect($request->payments)->sum('amount');

            if ($totalPaid > $customer->credit_balance) {
                return response()->json(['message' => 'El abono es mayor a la deuda total.'], 400);
            }

            // 2. Descontamos la deuda general del cliente
            $customer->decrement('credit_balance', $totalPaid);

            // 3. LA MAGIA DE LA CASCADA (Mata las deudas más viejas primero)
            $moneyLeftToDistribute = $totalPaid;

            // Buscamos todos sus tickets que aún tengan saldo pendiente, del más viejo al más nuevo
            $pendingSales = $customer->sales()
                ->where('status', 'credit')
                ->where('pending_balance', '>', 0)
                ->orderBy('created_at', 'asc')
                ->get();

            foreach ($pendingSales as $sale) {
                if ($moneyLeftToDistribute <= 0) break;

                if ($moneyLeftToDistribute >= $sale->pending_balance) {
                    // Paga todo este ticket y sobra plata para el siguiente
                    $moneyLeftToDistribute -= $sale->pending_balance;
                    $sale->update(['pending_balance' => 0]);
                } else {
                    // Solo paga una parte de este ticket y se acaba la plata
                    $sale->decrement('pending_balance', $moneyLeftToDistribute);
                    $moneyLeftToDistribute = 0;
                }
            }

            // 4. Guardamos los recibos del pago en su tabla natural de créditos de forma transparente
            foreach ($request->payments as $paymentData) {
                \App\Models\CreditPayment::create([
                    'customer_id'    => $customer->id,
                    'user_id'        => $request->user()->id,
                    'amount'         => $paymentData['amount'],
                    'payment_method' => $paymentData['method'], // efectivo, yape o transferencia
                    'payment_date'   => now(),
                ]);
            }



            return response()->json([
                'message' => 'Abono en cascada registrado correctamente.',
                'new_balance' => $customer->credit_balance
            ]);
        });
    }*/

    public function addPayment(Request $request, $customerId)
    {
        // 1. Validamos que viajen los montos y métodos de pago obligatorios
        $request->validate([
            'payments' => 'required|array|min:1',
            'payments.*.amount' => 'required|numeric|min:0.1',
            'payments.*.method' => 'required|string',
        ]);

        return DB::transaction(function () use ($request, $customerId) {
            $customer = Customer::findOrFail($customerId);

            // 🟢 CAPTURA MASIVA DE IDS DESDE EL ARREGLO DE REACT
            $rawIds = [];
            if ($request->has('sale_ids') && is_array($request->input('sale_ids'))) {
                $rawIds = $request->input('sale_ids');
            } else {
                // Soporte por si viaja un ID suelto individual
                $singleId = $request->input('credit_id') ?? $request->input('sale_id') ?? $request->route('id');
                if ($singleId) {
                    $rawIds = [$singleId];
                }
            }

            if (empty($rawIds)) {
                return response()->json([
                    'message' => 'Error técnico: Por favor, selecciona al menos una tarjeta en el carrusel superior.'
                ], 400);
            }

            // Limpiamos los prefijos 'lote_' de todos los IDs seleccionados
            $cleanCreditIds = array_map(function ($id) {
                return (int) str_replace('lote_', '', $id);
            }, $rawIds);

            // Buscamos todos los documentos de cobro seleccionados ordenados cronológicamente (del más antiguo al más nuevo)
            $credits = \App\Models\Credit::whereIn('id', $cleanCreditIds)
                ->whereIn('status', ['pending', 'partial'])
                ->orderBy('created_at', 'asc')
                ->get();

            $totalPaid = collect($request->payments)->sum('amount');
            $totalPendingDebt = $credits->sum('remaining_amount');

            // 🛡️ CANDADO ANTI-EXCESO GLOBAL: Valida contra la suma total de las tarjetas marcadas
            if ($totalPaid > $totalPendingDebt) {
                return response()->json([
                    'message' => 'El abono de S/ ' . $totalPaid . ' supera el saldo pendiente de los lotes seleccionados (S/ ' . $totalPendingDebt . ').'
                ], 400);
            }

            // Forzamos la creación de una cola de objetos stdClass puros y controlados
            $paymentsQueue = [];
            foreach ($request->payments as $p) {
                $obj = new \stdClass();
                $obj->amount = (float)$p['amount'];
                $obj->method = strtolower($p['method']);
                $paymentsQueue[] = $obj;
            }


            // 🟢 🔥 MOTOR DE DISTRIBUCIÓN MATRICIAL INDEPENDIENTE (SOPORTE MIXTO REAL)
            // Recorremos cronológicamente cada uno de los documentos de cobro abiertos
            foreach ($credits as $credit) {
                if (count($paymentsQueue) === 0) break;

                $creditRemainingToCover = $credit->remaining_amount;

                // 🟢 CONSUMO EN COLA MEDIANTE ACCESO A OBJETOS (Fidelidad 100% Anti-Warnings)
                // 🟢 CONSUMO DIRECTO INDEXADO SIN VARIABLES INTERMEDIAS (ANTI-WARNINGS INFAILIBLE)
                while ($creditRemainingToCover > 0 && count($paymentsQueue) > 0) {
                    $currentKey = array_key_first($paymentsQueue);

                    // Validamos que el objeto de la cola tenga saldo de forma directa
                    if ($paymentsQueue[$currentKey]->amount <= 0) {
                        array_shift($paymentsQueue);
                        continue;
                    }

                    // Determinamos cuánto dinero le aplicamos a este crédito
                    $amountToApply = min($creditRemainingToCover, $paymentsQueue[$currentKey]->amount);

                    // 🟢 REGISTRAMOS EL ABONO USANDO SINTAXIS DE OBJETO ESTRICTA
                    \App\Models\CreditPayment::create([
                        'credit_id' => $credit->id,
                        'customer_id' => $customer->id,
                        'user_id' => $request->user()->id,
                        'amount' => $amountToApply,
                        'payment_method' => $paymentsQueue[$currentKey]->method, // Flecha directa de objeto
                        'payment_date' => now()->toDateString(),
                        'notes' => 'Abono directo al lote: ' . $credit->notes
                    ]);

                    // Actualizamos las matemáticas de la iteración directo en la cola
                    $creditRemainingToCover -= $amountToApply;
                    $paymentsQueue[$currentKey]->amount -= $amountToApply;

                    // Si esta línea de pago llegó a 0, la sacamos de la cola
                    if ($paymentsQueue[$currentKey]->amount <= 0) {
                        array_shift($paymentsQueue);
                    }
                }



                // Calculamos las matemáticas definitivas para guardar de forma inmutable en la tabla credits
                $finalRemaining = $creditRemainingToCover;
                $finalPaidAmount = $credit->total_amount - $finalRemaining;
                $newStatus = $finalRemaining <= 0 ? 'paid' : 'partial';

                $credit->update([
                    'paid_amount' => $finalPaidAmount,
                    'remaining_amount' => $finalRemaining,
                    'status' => $newStatus
                ]);

                // Si el lote se cerró al 100%, extinguimos sus vales originales en la tabla sales
                if ($finalRemaining <= 0) {
                    $connectedSaleIds = DB::table('credit_sales')
                        ->where('credit_id', $credit->id)
                        ->pluck('sale_id')
                        ->toArray();

                    if (!empty($connectedSaleIds)) {
                        DB::table('sales')->whereIn('id', $connectedSaleIds)->update(['status' => 'paid']);
                    }
                }
            }

            // 💵 B. INTEGRACIÓN CON EL TURNO DE CAJA (Calcula el proporcional físico real recibido)
            $cashAmount = collect($request->payments)->where(function ($p) {
                return strtolower($p['method']) === 'efectivo';
            })->sum('amount');

            if ($cashAmount > 0) {
                $typeEnum = DB::table('cash_movements')->where('id', '>', 0)->value('type');
                $finalType = ($typeEnum === 'ingreso' || $typeEnum === 'egreso') ? 'ingreso' : 'income';

                $activeRegisterId = $request->input('cash_register_id')
                    ?? DB::table('cash_registers')->where('status', 'open')->value('id');

                if ($activeRegisterId) {
                    DB::table('cash_movements')->insert([
                        'cash_register_id' => $activeRegisterId,
                        'user_id' => $request->user()->id,
                        'type' => $finalType,
                        'amount' => $cashAmount,
                        'description' => 'Cobranza Masiva Créditos - Cliente: ' . $customer->name,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                } else {
                    logger("Cobranza masiva realizada sin turno de caja activo para el usuario: " . $request->user()->id);
                }
            }

            // D. Descontamos del balance general de la cartilla del cliente
            $customer->decrement('credit_balance', $totalPaid);

            return response()->json([
                'message' => 'Cobranza masiva en cascada procesada con éxito absoluto.',
                'total_applied' => $totalPaid
            ]);
        });
    }



    public function getCustomerStatement(Request $request, $id)
    {
        $customer = Customer::findOrFail($id);

        $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
        $endDate = $request->input('end_date', now()->endOfMonth()->format('Y-m-d'));

        // 1. Cargamos de forma limpia los Documentos de Cobro Reales de la tabla credits
        $lotesDb = DB::table('credits')
            ->where('customer_id', $customer->id)
            ->get();

        $loteIds = $lotesDb->pluck('id')->toArray();

        // Relaciones intermedias indexadas
        $creditSalesIndexed = DB::table('credit_sales')
            ->whereIn('credit_id', $loteIds)
            ->get()
            ->groupBy('credit_id');

        // 2. Cargamos TODAS las ventas de la tabla sales (Mundo antiguo + Nuevo)
        $salesDb = $customer->sales()
            ->with(['items.productVariant.product'])
            ->get();

        $salesHistoryIndexed = $salesDb->groupBy('id');

        // 3. 🎫 Estructuramos los lotes inmutables inyectando la identidad visual de sus vales originales
        $mappedCredits = $lotesDb->map(function ($credit) use ($creditSalesIndexed, $salesHistoryIndexed) {
            $connectedSaleIds = isset($creditSalesIndexed[$credit->id])
                ? $creditSalesIndexed[$credit->id]->pluck('sale_id')->toArray()
                : [];

            // 🟢 INYECCIÓN VISUAL UNIFICADA:
            // Recorremos los vales amarrados a este lote. Por cada uno, metemos un elemento "separador"
            // dentro del mismo arreglo de items para que React dibuje el título del ticket en la lista continua.
            $consolidatedItems = [];
            foreach ($connectedSaleIds as $saleId) {
                if (isset($salesHistoryIndexed[$saleId])) {
                    $saleRecord = $salesHistoryIndexed[$saleId]->first();

                    // Metemos un artículo artificial que servirá como separador visual en la pantalla
                    $consolidatedItems[] = [
                        'id' => 'header_' . $saleRecord->id,
                        'quantity' => 0, // Bandera para saber que es un título
                        'unit_price' => 0.00,
                        'subtotal' => 0.00,
                        'product_variant' => [
                            'product' => [
                                'name' => "🎫 VALE ORIGINAL: #" . ($saleRecord->receipt_number ?? 'N/A') . " — Retirado: " . \Carbon\Carbon::parse($saleRecord->created_at)->format('d/m/Y')
                            ]
                        ]
                    ];

                    // En tu bucle original de items dentro de getCustomerStatement:
                    foreach ($saleRecord->items as $item) {
                        // 🟢 INYECTAMOS LA FECHA DE LA VENTA EN EL ÍTEM
                        $item->fecha_despacho = \Carbon\Carbon::parse($saleRecord->created_at)->format('d/m/Y H:i');
                        $consolidatedItems[] = $item;
                    }
                }
            }

            return [
                'id' => 'lote_' . $credit->id,
                'customer_id' => $credit->customer_id,
                'total_amount' => (float)$credit->total_amount,
                'pending_balance' => (float)$credit->remaining_amount,
                'paid_amount' => (float)$credit->paid_amount,
                'status' => 'credit',
                'real_status' => $credit->status,
                'created_at' => $credit->created_at,
                'updated_at' => $credit->updated_at,
                'notes' => str_replace('DOC-COBRO-', 'LOTE-VALORIZADO-', $credit->notes),
                'id_compuesto' => $credit->notes,
                'items' => $consolidatedItems, // La lista unificada que tu frontend ya sabe mapear perfectamente
                'is_consolidated_lote' => true,
                'payments' => []
            ];
        });


        // 4. 📜 RETROCOMPATIBILIDAD CON VENTAS TRADICIONALES:
        // Si el cliente tiene vales con estado 'credit' que NO están metidos en ningún lote,
        // los preparamos para que React los pinte de forma individual en el carrusel superior.
        $mappedLegacySales = collect();
        foreach ($salesDb as $item) {
            if ($item->status === 'credit') {
                $alreadyInLote = DB::table('credit_sales')->where('sale_id', $item->id)->exists();
                if (!$alreadyInLote) {
                    $mappedLegacySales->push([
                        'id' => $item->id, // Viaja como ID numérico puro (Mundo antiguo)
                        'customer_id' => $item->customer_id,
                        'total_amount' => (float)$item->total_amount,
                        'pending_balance' => (float)$item->total_amount, // Su deuda es su total bruto original
                        'paid_amount' => 0.00,
                        'status' => 'credit',
                        'real_status' => 'credit',
                        'created_at' => $item->created_at,
                        'updated_at' => $item->updated_at,
                        'notes' => $item->notes ?? 'VALE TRADICIONAL SUELTO',
                        'id_compuesto' => "DIRECTO-" . $item->id,
                        'items' => $item->items,
                        'is_consolidated_lote' => false
                    ]);
                }
            }
        }

        // 5. Historial Diario Plano de Abonos reales
        $payments = $customer->creditPayments()
            ->with('user')
            ->whereBetween('created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->get()
            ->map(function ($item) {
                return [
                    'id' => 'pay_' . $item->id,
                    'credit_id' => $item->credit_id,
                    'sale_id' => $item->sale_id,
                    'date' => \Carbon\Carbon::parse($item->payment_date)->format('Y-m-d'),
                    'time' => \Carbon\Carbon::parse($item->created_at)->format('H:i'),
                    'full_date' => $item->created_at,
                    'type' => 'ABONO',
                    'description' => 'Pago recibido por ' . ($item->user ? $item->user->name : 'Sistema'),
                    'method' => strtoupper($item->payment_method),
                    'amount' => (float)$item->amount,
                    'is_payment' => true
                ];
            });

        // Sincronizamos abonos en memoria
        $paymentsGroupedByCredit = $payments->groupBy('credit_id');
        $mappedCredits = $mappedCredits->map(function ($lote) use ($paymentsGroupedByCredit) {
            $rawId = (int) str_replace('lote_', '', $lote['id']);
            $lote['payments'] = isset($paymentsGroupedByCredit[$rawId]) ? $paymentsGroupedByCredit[$rawId]->values()->toArray() : [];
            return $lote;
        });

        // Historial para la sección inferior
        $salesHistory = $salesDb->where('status', 'credit')->map(function ($item) {
            return [
                'id' => 'sale_' . $item->id,
                'date' => \Carbon\Carbon::parse($item->created_at)->format('Y-m-d'),
                'time' => \Carbon\Carbon::parse($item->created_at)->format('H:i'),
                'full_date' => $item->created_at,
                'type' => 'VENTA',
                'description' => 'Despacho #' . $item->receipt_number,
                'amount' => (float)$item->total_amount,
                'details' => $item->items,
                'is_payment' => false
            ];
        });

        $lotesHistory = $mappedCredits->map(function ($lote) {
            $createdAt = \Carbon\Carbon::parse($lote['created_at']);
            return [
                'id' => $lote['id'],
                'date' => $createdAt->format('Y-m-d'),
                'time' => $createdAt->format('H:i'),
                'full_date' => $lote['created_at'],
                'type' => 'VENTA',
                'description' => str_replace('LOTE-VALORIZADO-', 'LOTE-COBRO #', $lote['notes']),
                'amount' => (float)$lote['pending_balance'],
                'details' => $lote['items'],
                'is_payment' => false
            ];
        });

        $historyFlat = $salesHistory->concat($lotesHistory)->concat($payments)
            ->whereBetween('date', [$startDate, $endDate])
            ->sortBy('full_date')
            ->values();

        $groupedHistory = [];
        foreach ($historyFlat as $mov) {
            $date = $mov['date'];
            if (!isset($groupedHistory[$date])) {
                $groupedHistory[$date] = ['date' => $date, 'movements' => [], 'daily_sales' => 0, 'daily_payments' => 0];
            }
            $groupedHistory[$date]['movements'][] = $mov;
            if ($mov['is_payment']) {
                $groupedHistory[$date]['daily_payments'] += $mov['amount'];
            } else {
                $groupedHistory[$date]['daily_sales'] += $mov['amount'];
            }
        }

        krsort($groupedHistory);

        // 📊 DIVISIÓN DE BUZONES CONTABLES (Sin tocar tu $mappedCredits original)

        $paidLotes = [];
        $totalDaysToPay = 0;
        $totalPaidLotesCount = 0;



        // 🔏 BUZONES CONTABLES CON CONTROL DE VOLUMEN RÁPIDO (Carga de 10 en 10)
        $activeLotes = [];
        $paidLotesAll = []; // Saco temporal para recolectar todos los pagados

        foreach ($mappedCredits as $lote) {
            // Buscamos las trazas de abonos que corresponden estrictamente a este lote
            $lotePayments = isset($paymentsGroupedByCredit[$lote['raw_id'] ?? (int)str_replace('lote_', '', $lote['id'])])
                ? $paymentsGroupedByCredit[$lote['raw_id'] ?? (int)str_replace('lote_', '', $lote['id'])]->values()->toArray()
                : [];

            $lote['payments'] = $lotePayments;

            // Matemática de marcas de tiempo enteras puras
            $createdAt = \Carbon\Carbon::parse($lote['created_at']);
            $updatedAt = \Carbon\Carbon::parse($lote['updated_at'] ?? $lote['created_at']);

            $daysToPay = $lote['status'] === 'paid' || (float)$lote['pending_balance'] <= 0
                ? (int) ceil($createdAt->diffInMinutes($updatedAt) / 1440)
                : (int) ceil($createdAt->diffInMinutes(now()) / 1440);

            if ($daysToPay === 0) $daysToPay = 1;

            $lote['days_to_pay'] = $daysToPay;

            // Calibración estricta de insignias basadas en tu regla comercial de 1 semana
            if ($daysToPay <= 7) {
                $lote['punctuality'] = "EXCELENTE";
            } elseif ($daysToPay <= 14) {
                $lote['punctuality'] = "REGULAR";
            } else {
                $lote['punctuality'] = "DEUDOR LENTO";
            }

            // Separación por cajones según balance
            if ($lote['status'] === 'paid' || (float)$lote['pending_balance'] <= 0) {
                $lote['status'] = 'paid';
                $paidLotesAll[] = $lote; // Acumulamos en el saco histórico total
            } else {
                $activeLotes[] = $lote; // Se queda arriba en la pasarela activa para cobrar
            }
        }

        // 🟢 CORTADOR DE VOLUMEN INTELIGENTE (Paginación Dinámica para el botón de React)
        $page = (int) $request->input('page', 1);
        $perPage = 10;
        $skip = ($page - 1) * $perPage;
        // 🟢 EL FILTRO DE CONTROL DE VOLUMEN (Tu idea de 10 en 10):
        // Ordenamos los lotes cancelados para poner los más nuevos arriba y cortamos el arreglo
        // para enviar única y exclusivamente los últimos 10 de la historia contable del cliente.
        $paidLotesOrdered = collect($paidLotesAll)->sortByDesc('updated_at')->values();
        $paidLotesFiltered = $paidLotesOrdered->slice($skip, $perPage)->values()->toArray();

        // Bandera de control para que el frontend sepa si quedan más deudas viejas en el disco duro
        $hasMoreLotes = count($paidLotesAll) > ($skip + $perPage);

       // Calculamos las métricas generales basándonos en la historia real total procesada
        $totalPaidLotesCount = count($paidLotesAll);
        $totalDaysToPay = collect($paidLotesAll)->sum('days_to_pay');
        $avgDaysToReturn = $totalPaidLotesCount > 0 ? round($totalDaysToPay / $totalPaidLotesCount, 1) : 0;


        $generalPunctuality = "EXCELENTE";
        if ($avgDaysToReturn > 7 && $avgDaysToReturn <= 14) {
            $generalPunctuality = "REGULAR";
        } elseif ($avgDaysToReturn > 14) {
            $generalPunctuality = "DEUDOR LENTO";
        }

        // Matemáticas Reales Finales Combinadas
        $realCreditsDebt = collect($activeLotes)->sum('pending_balance');
        $realLegacyDebt = $salesDb->where('status', 'credit')->sum(function ($s) {
            $inLote = DB::table('credit_sales')->where('sale_id', $s->id)->exists();
            return $inLote ? 0 : $s->items->sum('subtotal');
        });

        $customer->credit_balance = (float)($realLegacyDebt + $realCreditsDebt);

        // 🟢 HIDRATAMOS EL SLIDER VISUAL ÚNICAMENTE CON DEUDAS VIVAS PENDIENTES
        $customer->sales = collect($mappedLegacySales)->merge($activeLotes)->toArray();

        // RETORNAMOS EL PAYLOAD ESTRUCTURADO SIN ADIVINAR VARIABLES MUERTAS
        return response()->json([
            'customer' => $customer,
            'history' => array_values($groupedHistory),
            'paid_lotes' => $paidLotesFiltered, // 🟢 ENVIAMOS EL BUZÓN AL FRONTEND PARA LA PESTAÑA 2
            'current_balance' => (float)($realLegacyDebt + $realCreditsDebt),
            'has_more_lotes' => $hasMoreLotes, // PARA VER SI HAY REGISTROS VIEJOS
            'metrics' => [ // 🟢 KPI'S DE AUDITORÍA COMERCIAL EN TIEMPO REAL
                'avg_days_to_pay' => $avgDaysToReturn,
                'total_paid_lotes' => $totalPaidLotesCount,
                'general_punctuality' => $generalPunctuality,
            ]
        ]);
    }





    public function approveGroup(Request $request)
    {
        $request->validate([
            'sale_ids' => 'required|array',
            'items' => 'required|array',
            'items.*.id' => 'required|exists:sale_items,id',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request) {
            $totalNewDebt = 0;
            $realCustomerId = null;

            // A. Actualizamos los precios en caliente
            foreach ($request->items as $itemData) {
                $saleItem = \App\Models\SaleItem::whereIn('sale_id', $request->sale_ids)
                    ->where('id', $itemData['id'])
                    ->firstOrFail();
                $subtotal = $saleItem->quantity * $itemData['unit_price'];
                $saleItem->update([
                    'unit_price' => $itemData['unit_price'],
                    'subtotal' => $subtotal,
                ]);
            }

            // B. Calculamos el monto global sumando los vales de la tabla REAL sales
            foreach ($request->sale_ids as $saleId) {
                $sale = Sale::findOrFail($saleId);
                if ($sale->status === 'consolidated_credit') continue;

                $realCustomerId = $sale->customer_id; // Columna real de tu ERP

                $newSaleTotal = $sale->items()->sum('subtotal');
                $totalNewDebt += $newSaleTotal;

                $sale->update([
                    'total_amount' => $newSaleTotal,
                    'status' => 'consolidated_credit'
                ]);
            }

            if ($totalNewDebt > 0 && $realCustomerId) {
                // 🟢 MODIFICA ESTA LÍNEA DE PREFIJO (Línea ~60 de la función approveGroup):
                $groupCode = 'LOTE-VALORIZADO-' . now()->format('Ymd-His');

                // Al haber ejecutado el migrate, cambiamos 'client_id' por 'customer_id'
                // conectando el flujo de forma nativa a tu Panel de Administración
                $credit = \App\Models\Credit::create([
                    'customer_id' => $realCustomerId,
                    'sale_id' => null,
                    'total_amount' => $totalNewDebt,
                    'paid_amount' => 0.00,
                    'remaining_amount' => $totalNewDebt,
                    'due_date' => now()->addDays(30),
                    'status' => 'pending',
                    'notes' => $groupCode
                ]);

                // Guardamos la identidad de los vales en la tabla intermedia
                foreach ($request->sale_ids as $saleId) {
                    DB::table('credit_sales')->insert([
                        'credit_id' => $credit->id,
                        'sale_id' => $saleId,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }

                // Incrementamos el saldo en la cartilla visual (customers)
                $customer = \App\Models\Customer::findOrFail($realCustomerId);
                $customer->increment('credit_balance', $totalNewDebt);
            }

            return response()->json(['message' => '¡Documento de cobro inmutable generado con éxito!']);
        });
    }


    public function getValePayments($saleId)
    {
        $cleanId = (int) str_replace('lote_', '', $saleId);

        // Buscamos si el ID es directamente un lote o si es una venta amarrada a un lote
        $creditId = DB::table('credit_sales')
            ->where('sale_id', $cleanId)
            ->orWhere('credit_id', $cleanId)
            ->value('credit_id');

        if ($creditId) {
            // Arquitectura limpia: Jala los abonos asociados al documento global
            $payments = \App\Models\CreditPayment::where('credit_id', $creditId)
                ->orderBy('created_at', 'desc')
                ->get();
        } else {
            // Historial limpio por columna real de base de datos
            $payments = \App\Models\CreditPayment::where('credit_id', $cleanId)
                ->orderBy('created_at', 'desc')
                ->get();
        }

        // 🟢 FORMATEAMOS LAS VARIABLES PARA INYECTAR LA HORA EN LA PANTALLA
        $payments->transform(function ($payment) {
            // Extraemos la hora y minuto del registro real de la base de datos (ej: "15:42")
            $timeString = \Carbon\Carbon::parse($payment->created_at)->format('H:i');

            // Alteramos transitoriamente la propiedad del método de pago para que React dibuje el horario al lado
            $payment->payment_method = $payment->payment_method . " (A las " . $timeString . ")";
            return $payment;
        });

        return response()->json([
            'success' => true,
            'payments' => $payments
        ]);
    }
}
