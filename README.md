# SideBSide — Backend

API REST para el control de gastos operativos de SideBSide (Node.js + Express + MySQL).

## Setup

1. Instalar dependencias:
   ```
   npm install
   ```

2. Crear la base de datos y las tablas ejecutando `sql/schema.sql` en MySQL Workbench
   (o `mysql -u root -p < sql/schema.sql`).

3. Copiar `.env.example` a `.env` y ajustar credenciales de MySQL y `JWT_SECRET`:
   ```
   cp .env.example .env
   ```

4. Crear el primer administrador (no existe registro publico para admins):
   ```
   node src/utils/crearAdmin.js "Nombre Admin" admin@empresa.mx contrasena123
   ```

5. Levantar el servidor en modo desarrollo:
   ```
   npm run dev
   ```

El servidor arranca en `http://localhost:5000` (o el puerto definido en `.env`).

## Flujo de prueba con curl

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.mx","contrasena":"contrasena123"}'

# Guarda el token de la respuesta anterior
TOKEN="<pega_aqui_el_token>"

# Crear operador (requiere admin)
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"nombre":"Carlos Mendoza","email":"c.mendoza@empresa.mx","contrasena":"operador123","rol":"operador"}'

# Listar categorias
curl http://localhost:5000/api/categorias -H "Authorization: Bearer $TOKEN"

# Crear gasto (login como operador para obtener su propio token)
curl -X POST http://localhost:5000/api/gastos \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_OPERADOR" \
  -d '{"monto":1250.00,"categoria_id":1,"descripcion":"Diesel unidad 14","fecha":"2026-07-17","enviar":true}'

# Admin: ver pendientes
curl http://localhost:5000/api/gastos/pendientes -H "Authorization: Bearer $TOKEN"

# Admin: aprobar gasto 1
curl -X PUT http://localhost:5000/api/gastos/1/aprobar -H "Authorization: Bearer $TOKEN"

# Admin: reporte por categoria
curl http://localhost:5000/api/reportes/por-categoria -H "Authorization: Bearer $TOKEN"
```

## Notas de alcance (MVP)

- Fotos de comprobantes se guardan localmente en `uploads/` (servidas en `/uploads/<archivo>`).
  Para produccion en AWS se migra a S3 (ver documento de Arquitectura).
- `gastos.estado` incluye `borrador` ademas de `pendiente/aprobado/rechazado` para soportar
  guardar un gasto sin enviarlo a revision (RF2.5).
- `gastos.categoria_id` es FK a `categorias` (en la guia original era un VARCHAR libre); se
  cambio para mantener integridad referencial con el modulo de categorias.
- Notificaciones in-app (RF7) y exportacion real a Excel/PDF quedan fuera de este alcance
  (marcadas como opcionales/futuras en el documento de Requerimientos).
