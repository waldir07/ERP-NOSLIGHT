# 🚀 NOSLIGHT ERP - Manual de Operaciones en Producción

Este archivo contiene los comandos esenciales para mantener, reiniciar y administrar el sistema en el servidor VPS de Contabo (`161.97.142.245`).

---

## 🟢 1. Estado Ideal del Servidor
Para que el sistema funcione, deben estar activos dos componentes principales:
1. **Nginx:** Atiende los dominios HTTPS y sirve el frontend rápido.
2. **Docker (Laravel Sail):** Corre el backend y la base de datos en los puertos internos.

---

## 🔄 2. Procedimiento de Reinicio Completo
Si el servidor se reinicia (por mantenimiento de Contabo o apagón), ejecuta estos comandos en orden para levantar todo:

```bash
# 1. Entrar a la carpeta del backend
cd /root/ERP-NOSLIGHT/noslight-api

# 2. Encender los contenedores de Docker en segundo plano (-d)
./vendor/bin/sail up -d

# 3. Asegurar que Nginx esté encendido
systemctl restart nginx

🛠️ 3. Comandos de Mantenimiento Frecuentes
Ver si el Backend está encendido:

cd /root/ERP-NOSLIGHT/noslight-api
./vendor/bin/sail ps

Ver los registros de error (Logs) del Backend en tiempo real:

./vendor/bin/sail logs -f

Entrar a la base de datos de Laravel (Tinker) para crear usuarios:

./vendor/bin/sail artisan tinker

🚀 4. Cómo subir cambios desde tu Computadora Local
Si tú o tu programador hacen cambios en el código y los suben a GitHub, para aplicarlos en este servidor debes hacer lo siguiente:

Para el Backend (Laravel):

cd /root/ERP-NOSLIGHT
git pull origin main
# Si hubo cambios en la base de datos, ejecutar las migraciones:
cd noslight-api
./vendor/bin/sail artisan migrate

Para el Frontend (React - Compilación limpia):

cd /root/ERP-NOSLIGHT
git pull origin main
cd noslight-frontend

# 1. Recompilar el código con Docker
docker run --rm -v $(pwd):/app -w /app node:20 npx vite build

# 2. Limpiar la carpeta de Nginx y copiar lo nuevo
rm -rf /var/www/noslight/*
cp -r dist/* /var/www/noslight/

🔒 5. Seguridad del Servidor

Firewall (UFW): Activo. Solo permite puertos 22 (SSH), 80 (HTTP) y 443 (HTTPS).

Base de Datos: Bloqueada para el exterior. Solo responde a 127.0.0.1 dentro del archivo compose.yaml.

Fail2Ban: Activo y vigilando intentos de hackeo en el puerto SSH.


