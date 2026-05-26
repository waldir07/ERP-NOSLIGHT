# NOSLIGHT API - ERP Básico para Importación, Transformación y Venta de Productos Eléctricos

**Última actualización:** 24 febrero 2026  
**Objetivo:** API RESTful en Laravel 11 para gestionar el ciclo completo del negocio NOSLIGHT (importación desde China, transformación en almacén principal, stock finished en tienda, ventas en mostrador, créditos a clientes, cobros y pases).

## Modelo de negocio NOSLIGHT (resumen)

- Productos importados desde China en blanco/raw (ej: interruptor base 63A).
- Llegan en cajones variables (4, 50, 100, 120 uds).
- Almacén Principal: stock raw (SKU con "E" al inicio, ej: EITM63AIC).
- Transformación: láser + tampográfica (cambiar amperaje, poner marca NOSLIGHT).
    - De un cajón raw se pueden hacer diferentes amperajes (flexible).
- Almacén Tienda (subterráneo): stock finished (SKU sin "E", ej: ITM25IC).
- Ventas en mostrador: salida de finished + registro de venta, crédito o cobro.
- Créditos: clientes pueden comprar a crédito (saldo pendiente).
- Cobros: registrar pagos parciales o totales de créditos.
- Pases: movimientos internos entre almacenes (ej: pase de raw a tienda sin transformar, o finished de vuelta a principal).
- Futuro: importación directa de producto terminado (sin transformación).

## Roles de usuarios

- **Administrador (Master - solo tú)**: acceso total
    - Ingresar compras/importaciones (raw al Almacén Principal)
    - Crear/editar productos raw y variantes
    - Ver y gestionar todos los reportes, créditos, cobros, pases
    - Todo lo demás
- **Almacén Principal**: solo movimientos y transformaciones de raw
    - Transformar raw → finished
    - Registrar pases internos
    - Ver stock raw y movimientos propios
- **Cajero Tienda**: solo ventas y gestión de clientes en mostrador
    - Registrar ventas (restar stock finished)
    - Vender a crédito / registrar cobros parciales
    - Ver stock finished y ventas del día
    - No accede a transformación ni compras import

## Estado actual del desarrollo (24 feb 2026)

- Laravel 11 + Sail + Docker + MySQL OK
- Autenticación Sanctum (register/login/token Bearer) OK
- Modelos y tablas creadas:
    - products (raw)
    - product_variants (finished)
    - warehouses (Principal y Tienda)
    - stocks (cantidad por variant y almacén)
    - transformations (registro de raw → finished)
- Endpoints protegidos funcionando:
    - GET /api/products/raw → lista productos raw
    - POST /api/transformations → transforma (crea variant, suma stock Tienda, registra con user_id)
- Stock finished se incrementa correctamente en Tienda
- Autenticación correcta (user_id se guarda en transformations)

## Funcionalidades pendientes para MVP (mínimo viable)

1. Restar stock raw + validar disponibilidad antes de transformar
2. Tabla stock_movements (historial entradas/salidas/transformaciones/ventas)
3. POST /api/sales → registrar venta en mostrador (restar stock Tienda, registrar crédito/cobro)
4. GET /api/stocks → ver stock actual en ambos almacenes
5. GET /api/transformations y GET /api/sales → listar con filtros básicos
6. Créditos y cobros (tabla credits/cobros + endpoints básicos)
7. Pases internos (movimientos entre almacenes sin transformación)
8. Roles/permisos básicos (Gates o Spatie para restringir acciones por rol)

## Cómo probar / retomar el proyecto (pasos rápidos)

1. Inicia todo: `sail up -d`
2. Genera token nuevo:

    ```bash
    sail artisan tinker

    $user = App\Models\User::first();
    echo $user->createToken('prueba')->plainTextToken;
    ```

    curl -X POST http://localhost:8000/api/transformations \
    -H "Authorization: Bearer TU_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"product_id":1,"raw_amperage":63,"finished_amperage":25,"quantity":10,"notes":"Prueba"}'


# NOSLIGHT API - ERP Básico para Importación, Transformación y Venta de Productos Eléctricos

**Última actualización:** 26 febrero 2026  
**Objetivo:** API RESTful en Laravel 11 para gestionar el ciclo completo del negocio NOSLIGHT (importación raw desde China, transformación en Almacén Principal, stock finished en Tienda, ventas en mostrador, créditos/cobros, pases internos y historial de movimientos).

## Estado actual (funcionalidades listas - 26 feb 2026)
- Laravel 11 + Sail + Docker + MySQL OK
- Autenticación Sanctum (register/login/token Bearer) OK
- Modelos y tablas creadas: products (raw), product_variants (finished), warehouses (Principal/Tienda), stocks, transformations, sales, stock_movements
- Endpoints protegidos (requieren token Bearer):
  - GET /api/products/raw → lista productos raw
  - POST /api/transformations → transforma raw → finished (crea variant, suma stock Tienda, registra en transformations y stock_movements)
  - POST /api/sales → registra venta en mostrador (resta stock Tienda, maneja crédito/pago parcial, registra en sales y stock_movements)
- Historial de movimientos (stock_movements) se registra automáticamente en ventas y transformaciones (type: transformation/exit)

## Cómo probar ahora mismo (con token)
1. Inicia servidor: `sail up -d`
2. Genera token nuevo:
   ```bash
   sail artisan tinker

   

# NOSLIGHT API - ERP/CRM Básico para Importación y Venta de Productos Eléctricos

API RESTful en Laravel 11 para NOSLIGHT (importación desde China y venta de productos de automatización eléctrica: interruptores termomagnéticos, diferenciales, contactores, variadores, etc.).

**Objetivo**: Gestionar el ciclo completo:  
- Importación de productos raw (en blanco) desde China  
- Transformación (láser + tampográfica: amperaje, marca NOSLIGHT)  
- Stock en dos almacenes: Principal (raw) y Tienda (finished)  
- Ventas en Tienda física  
- Movimientos, alertas de stock bajo y reportes básicos

**Fecha de documentación**: 2 de marzo 2026  
**Estado**: Núcleo completo + ciclo cerrado + alertas + reportes + catálogo (producción básica lista)

## Tecnologías
- Laravel 11  
- PHP 8.2+  
- MySQL 8  
- Laravel Sail + Docker  
- Autenticación: Sanctum (tokens Bearer)  
- Paginación, relaciones eager loading, transacciones DB

## Estructura clave (actual al 2 mar 2026)

app/
├── Http/Controllers/
|   ├──  Api/
│   │   ├── ProductController.php       # GET products (catálogo completo)
│   │   ├── TransformationController.php # POST transformaciones + alerta low raw
│   │   ├── SaleController.php          # POST ventas + GET sales (listado)
│   │   ├── StockController.php         # GET stocks + alertas low raw/finished
│   │   ├── StockEntryController.php    # POST entradas importación
│   │   ├── StockMovementController.php # GET historial movimientos
│   │   ├── ReportController.php        # GET most-transformed + sales-summary
│   ├── AuthController.php          # register / login
│   ├── Controller.php  
├── Models/
│   ├── Product.php
│   ├── ProductVariant.php
│   ├── Warehouse.php
│   ├── Stock.php
│   ├── Transformation.php
│   ├── Sale.php
│   ├── StockMovement.php
│   ├── User.php
routes/
└── api.php                         # rutas protegidas con auth:sanctum
database/migrations/                # todas las tablas + correcciones
database/seeders/                   # WarehouseSeeder, ProductSeeder, etc.



## Endpoints completos (todos protegidos con Bearer Token)

### Autenticación
- POST /api/register  
- POST /api/login  

### Catálogo y stock
- GET /api/products → catálogo completo (stock raw + variants finished + total finished en Tienda)  
- GET /api/stocks → stock actual (filtros ?warehouse_id=1 &is_raw=1)  
- GET /api/alerts/low-stock-finished → finished bajo en Tienda (?threshold=20)  
- GET /api/alerts/low-stock-raw → raw bajo en Principal (?threshold=50)  

### Transformación
- POST /api/transformations  
  Body: { "product_id":1, "raw_amperage":63, "finished_amperage":25, "quantity":20, "notes":"..." }  
  Respuesta: éxito + transformación + variant + stock_tienda + alerta si raw bajo  

### Ventas
- POST /api/sales  
  Body: { "product_variant_id":5, "quantity":5, "unit_price":15.00, "customer_name":"...", "is_credit":true, "paid_amount":30.00 }  
  Respuesta: éxito + venta + stock_tienda_remaining  
- GET /api/sales → listado ventas (filtros ?date_from & date_to, ?variant_id)  

### Entradas importación
- POST /api/stock-entries  
  Body: { "product_id":1, "amperage":63, "quantity":100, "cost_price":4.80, "supplier":"...", "notes":"..." }  
  Respuesta: éxito + variant + quantity_added + stock_raw_new  

### Reportes
- GET /api/reports/most-transformed → top transformados (?limit=10, ?date_from & date_to)  
- GET /api/reports/sales-summary → resumen ventas (total quantity/income por variant, ?date_from & date_to)  

### Movimientos
- GET /api/stock-movements → historial paginado (?type=sale, ?warehouse_id=2, ?variant_id=5, ?date_from & date_to)  

## Cómo correr localmente (Sail)
```bash
sail up -d
sail artisan migrate
sail artisan db:seed --class=WarehouseSeeder
sail artisan db:seed --class=ProductSeeder  # opcional

Cómo obtener token
Bashcurl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"master@noslight.com","password":"password123"}'
Usar en todos los headers:
Authorization: Bearer [token]

Flujo completo del negociogit push -u origin main

Registrar entrada import → POST /api/stock-entries → suma raw en Principal + movimiento entry
Transformar → POST /api/transformations → resta raw + suma finished en Tienda + alerta si raw bajo
Vender → POST /api/sales → resta finished + movimiento salida + registro venta
Ver stock → GET /api/stocks o /api/products
Ver alertas → GET /api/alerts/low-stock-raw o low-stock-finished
Ver reportes → GET /api/reports/... (con filtros fecha)
Ver historial → GET /api/stock-movements
Ver ventas → GET /api/sales (con filtros fecha)

Pendientes sugeridos (fases futuras)

Filtros avanzados en listados (por cliente, por tipo movimiento)
GET /api/variants → listado de todas las variants con stock por almacén
POST /api/adjustments → ajustes manuales de stock
Integración n8n (webhooks para alertas cuando lo necesites)

Última actualización: 2 de marzo 2026
API lista para uso diario en producción básica.
¡A importar, transformar y vender! 🚀

# NOSLIGHT - Sistema de Ventas, Almacén y Créditos

API RESTful en Laravel + frontend en React (en desarrollo).

## Estado actual (marzo 2026)

- Autenticación con Sanctum (login/register).
- Roles: ADMIN, STORE, WAREHOUSE (campo `role` en users).
- Productos y variants (raw y finished).
- Stock en dos almacenes (PRINCIPAL raw, TIENDA finished).
- Entradas importación (POST /stock-entries).
- Transformaciones (POST /transformations).
- Ventas (POST /sales) con soporte para crédito parcial.
- Créditos (model Credit + CreditPayment):
  - Creación automática al vender con is_credit=true.
  - Abonos parciales (POST /credits/{id}/pay).
  - Listado (GET /credits).
  - Alertas vencidos (GET /credits/overdue).
- Reportes básicos y alertas de stock bajo.

## Endpoints clave (protegidos con Bearer Token)

### Autenticación
- POST /api/login → devuelve user + token

### Ventas y Créditos
- POST /api/sales → crea venta (soporta is_credit, client_id, due_date)
- GET /api/credits → lista paginada de créditos
- POST /api/credits/{id}/pay → abona parcial (amount, payment_method)
- GET /api/credits/overdue → créditos vencidos (due_date pasada + remaining > 0)

### Otros
- GET /api/products → catálogo
- GET /api/alerts/low-stock-raw → stock bajo raw
- POST /api/stock-entries → entrada importación
- POST /api/transformations → transformación raw → finished

## Modelos principales

- User (role: ADMIN/STORE/WAREHOUSE)
- Product + ProductVariant
- Warehouse (code: PRINCIPAL, TIENDA)
- Stock
- Sale (is_credit, credit_amount, paid_amount)
- Client (name, credit_limit)
- Credit (sale_id, client_id, total_amount, paid_amount, remaining_amount, due_date, status: pending/partial/paid/overdue)
- CreditPayment (abonos)

## Flujo probado

1. Login → token
2. Venta a crédito (POST /sales con is_credit=true, client_id, due_date)
3. Crédito creado automáticamente
4. Abono parcial (POST /credits/{id}/pay)
5. Listado y alertas

## Próximo: Frontend React

- Estructura modular por dominio (auth, admin, store, warehouse)
- AuthContext + token + role-based routes
- Layouts por rol
- Form POS (venta) con toggle crédito
- Gestión de abonos y lista de créditos

¡Backend listo para conectar frontend!
