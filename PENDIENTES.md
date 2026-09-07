# Pendientes del backend

Estado al 2026-08-11 (ver actualizacion 2026-08-23 abajo). Este archivo es
para retomar el trabajo sin tener que reconstruir el contexto: dice que
falta, por que, y que ya se decidio.

## Actualizacion 2026-08-23 — integracion con el frontend

Pamela ya tenia el frontend completo (`sidebside-frontend/`, clonado de
`TerryPotato/sideBside`) pero 100% mockeado. Se conecto con el backend real:

- **Modulo `viajes` nuevo de punta a punta**: no existia en el backend (tabla,
  controller, rutas). Se agrego siguiendo el mismo patron de `gastos`
  (ownership por `obtenerViajeOAutorizar`, admin ve todo, operador solo lo
  suyo). Migracion `sql/migrations/002_viajes_y_campos_gasto.sql`.
- **CRUD de usuarios nuevo** (`/api/usuarios`, solo admin): el backend solo
  tenia `POST /auth/register`. `eliminar` es soft-delete (`estado=inactivo`),
  no DELETE fisico, porque rompia la FK con `gastos.usuario_id`. Al crear, se
  genera una password temporal aleatoria que se devuelve una sola vez en la
  respuesta (no hay servicio de correo).
- **Campos nuevos en `gastos`**: `viaje_id`, `moneda`, `ubicacion` (el front
  ya los pedia). **Campos nuevos en `categorias`**: `color`, `icono`. Campo
  nuevo en `usuarios`: `num_empleado`.
- **`reportes.controller.js`**: se agrego `porMes` (grafica de tendencia
  mensual) y se extendio `totales` con montos por estado
  (`monto_aprobado`/`monto_rechazado`/`monto_pendiente`), que antes solo
  traia conteos.
- **CORS restringido** al origen del front (`FRONTEND_URL`, default
  `http://localhost:5173`) — era el punto suelto que ya estaba anotado abajo.
- **Dos bugs reales de tipos en `pg`, atrapados probando con curl, no
  adivinados**: `NUMERIC`/`DECIMAL` (`monto`, `presupuesto`, los `SUM()` de
  reportes) y `BIGINT` (los `COUNT()`) llegaban como *string*, no *number* —
  rompia `.toFixed()` y las sumas en el front. Y `DATE` (`gastos.fecha`,
  `viajes.fecha_inicio/fecha_fin`) llegaba como datetime con hora y zona
  (`"2026-08-21T06:00:00.000Z"`) en vez de `"YYYY-MM-DD"`, rompiendo
  `formatDate()` del front — justo lo que el comentario original en
  `schema.sql` sobre por que `fecha` es `DATE` y no `TIMESTAMPTZ` queria
  evitar. Los tres se arreglaron centralizados con `pg.types.setTypeParser`
  en `src/config/database.js`, no parcheando cada query.
- **Frontend**: capa `src/api/` nueva (fetch + token + manejo de 401),
  `AuthContext`/`DataContext` conectados al backend real en vez de arrays
  mock, `ComprobanteImage.jsx` nuevo para el patron fetch+blob que ya estaba
  anotado abajo, y se corrigio un bug de `usuarioId` hardcodeado a `1` en 3
  paginas del operador (rompia todo para cualquier operador que no fuera el
  usuario id 1).
- **Se quito `revertirGasto`** (el "Deshacer" del toast al aprobar/rechazar):
  no hay endpoint de backend para revertir una aprobacion ya escrita en
  `aprobaciones`, y no era parte del plan aprobado agregar uno. Si se
  necesita, es un modulo de "reversion de aprobaciones" nuevo, no un fix.
- **Deliberadamente fuera de alcance** (documentado, no olvidado): el campo
  `factura` (segundo archivo) en `NuevoGasto.jsx` no se manda al backend —
  solo hay columna para un comprobante. `Notificaciones.jsx` y los botones de
  exportar Excel/PDF siguen mockeados (igual que ya estaba decidido para el
  RF7). Avatar de perfil sigue siendo solo local (color/foto en localStorage).
  Las paginas huerfanas `admin/GastosPendientes.jsx` y `admin/DetalleGasto.jsx`
  (no estan en ninguna ruta) no se tocaron.

## De donde viene esto

El equipo recibio comentarios de revision sobre el backend (8 puntos). Se
triaguearon por impacto real y se atendieron primero los baratos. Lo que ya
quedo esta en dos commits:

- `2a978b5` — migracion de MySQL a PostgreSQL
- `a92fc71` — husos horarios, constantes, CHECK de rechazo y comprobantes protegidos

## Resumen

| # | Tema | Estado |
|---|------|--------|
| 1 | Zona horaria | Hecho |
| 2 | Cadenas magicas | Hecho |
| 3 | Uploads seguros | Hecho |
| 4 | Datos nulos | Parcial — falta `usuarios.empresa` |
| 5 | Swagger | Pendiente |
| 6 | ORM (Prisma) | Pendiente |
| 7 | TypeScript | Pendiente |
| 8 | IDs autoincrementales | Descartado a proposito |

---

## Pendiente 1 — Swagger / OpenAPI

**Prioridad: alta. Costo: ~2 horas.**

Es lo mas util ahorita porque el frontend en React no ha empezado y Pamela
necesita saber que endpoints existen, que reciben y que devuelven. Hoy solo
existe la coleccion de Postman en `postman/`, que sirve para probar pero no
para documentar.

Plan: agregar `swagger-ui-express` + `swagger-jsdoc`, anotar las rutas en
`src/routes/*.js` y exponer la UI en `/api-docs`. Ojo: esa ruta debe quedar
fuera de `verificarToken`, o no se va a poder abrir sin token.

Endpoints a documentar (los que ya existen):

- `POST /api/auth/login` (publico), `POST /api/auth/register` (solo admin),
  `POST /api/auth/logout`, `PUT /api/auth/cambiar-contrasena`
- `GET|POST /api/gastos`, `GET|PUT|DELETE /api/gastos/:id`
- `POST /api/gastos/:id/comprobante` (multipart, campo `foto`)
- `GET /api/gastos/:id/comprobante`
- `GET /api/gastos/pendientes`, `PUT /api/gastos/:id/aprobar`,
  `PUT /api/gastos/:id/rechazar` (los tres solo admin)
- `GET /api/categorias`, `POST /api/categorias` y `PUT /api/categorias/:id`
  (estos dos solo admin)
- `GET /api/reportes/totales`, `/por-categoria`, `/por-empleado`, y
  `GET /api/reportes/` para el general (todo el modulo es solo admin)
- `GET /api/health` (publico)

---

## Pendiente 2 — TypeScript + ORM (Prisma)

**Prioridad: media. Costo: 2-3 dias. Es UNA decision, no dos.**

Van juntos o no van. Prisma genera los tipos de TypeScript solo, trae
migraciones versionadas, y eliminaria el shim de `?` -> `$1` que vive en
`src/config/database.js`. Hacerlos por separado es pagar dos veces la misma
mudanza.

**La ventana se cierra cuando Pamela empiece el React.** Despues significa
tocar codigo que ella ya consume. Si se va a hacer, es ahora.

Si se decide que no, no pasa nada: el backend funciona. Pero entonces hay que
seguir escribiendo migraciones a mano en `sql/migrations/`.

Nota si se migra a Prisma: los controllers usan placeholders `?` estilo
mysql2 (los traduce `src/config/database.js`). No "corregirlos" a `$1, $2`
mientras siga el shim; si entra Prisma, desaparecen los dos.

---

## Pendiente 3 — `usuarios.empresa` esta muerta

**Prioridad: baja. Costo: 30 min.**

La columna se escribe al registrar un usuario (`src/controllers/auth.controller.js`,
en el INSERT de `register`) y **nunca se lee en ningun lado**. Es el residuo real
del comentario sobre "datos nulos" — los demas campos nullable (`descripcion`,
`foto_url`, `comentario`) son opcionales legitimos y estan bien asi.

Dos salidas, hay que elegir una:

- **Conectarla:** si SideBSide va a manejar varias empresas (multi-tenant),
  deberia ser FK a una tabla `empresas` y filtrar los gastos por ella.
- **Borrarla:** si el piloto es solo Transportes Falcon, quitarla del INSERT,
  del esquema y con una migracion nueva.

---

## Descartado a proposito — IDs autoincrementales

En la revision dijeron que los IDs secuenciales "le facilitan el trabajo a los
hackers". **No aplica a este codigo.** El riesgo real detras de ese consejo se
llama IDOR: que alguien cambie `/api/gastos/5` por `/api/gastos/6` y vea el
gasto de otro. Eso ya esta bloqueado en `obtenerGastoOAutorizar`
(`src/controllers/gastos.controller.js`), que corre en obtener, actualizar,
eliminar y ver comprobante.

Se probo: un operador que pide un gasto ajeno recibe **403**.

Un ID secuencial no es vulnerabilidad cuando la autorizacion esta bien hecha.
Lo unico que filtra es volumen de negocio (cuantos gastos procesas al mes), que
para este piloto no es riesgo serio.

**Solo cambiar a UUID si el profesor lo exige para la calificacion.** Si se
hace, seria UUIDv7 y hay que tocar las 4 tablas y sus FKs.

---

## Deuda tecnica detectada aparte de la revision

Ninguna de estas la menciono el revisor, pero salieron al auditar el codigo:

- ~~**CORS abierto.**~~ Hecho el 2026-08-23: restringido a `FRONTEND_URL`.
- **Sin rate limiting en el login.** `POST /api/auth/login` acepta intentos
  ilimitados; se presta a fuerza bruta. `express-rate-limit` lo resuelve.
- **El rol viaja en el JWT.** Si un admin degrada a un usuario, su token sigue
  siendo valido hasta 30 min despues. Aceptable para el MVP, pero hay que
  saberlo.
- **Uploads locales.** `uploads/` no sobrevive a un redeploy ni funciona con
  varias instancias. La solucion es S3 con URLs firmadas. Docker **no** arregla
  esto: sin volumen montado lo empeora.

---

## Aviso para quien haga el frontend

`GET /api/gastos/:id/comprobante` exige el header `Authorization`. Por eso
**un `<img src="/api/gastos/3/comprobante">` NO va a funcionar** — el navegador
no manda headers en las etiquetas `<img>`.

Hay que traer la imagen con `fetch`, convertirla a blob y usar esa URL:

```js
const res = await fetch(`/api/gastos/${id}/comprobante`, {
  headers: { Authorization: `Bearer ${token}` },
});
const url = URL.createObjectURL(await res.blob());
// <img src={url} />  y luego URL.revokeObjectURL(url) al desmontar
```

Es el costo de que los comprobantes ya no sean publicos.

---

## Como levantar todo para retomar

```bash
npm install
npm run dev            # http://localhost:5000
```

La base local es PostgreSQL 17 (servicio `postgresql-x64-17`), base `sidebside`,
credenciales en `.env`. `psql` no esta en el PATH:

```bash
"C:/Program Files/PostgreSQL/17/bin/psql.exe" -U postgres -d sidebside
```

Si aparecen migraciones nuevas en `sql/migrations/`, aplicarlas en orden. La
`001` ya esta aplicada en el ambiente local.
