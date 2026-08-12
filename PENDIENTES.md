# Pendientes del backend

Estado al 2026-08-11. Este archivo es para retomar el trabajo sin tener que
reconstruir el contexto: dice que falta, por que, y que ya se decidio.

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

- **CORS abierto.** `src/server.js` usa `app.use(cors())` sin restringir origen.
  Para produccion hay que limitarlo al dominio del frontend.
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
