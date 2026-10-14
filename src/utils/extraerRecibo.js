// Auto-rellenado del formulario de gasto a partir de la foto del ticket.
// Todo lo especifico de Gemini vive aqui, adentro de una sola funcion. El
// dia que se migre a Claude/GPT (por costo, precision o limite de tasa
// agotado), este es el UNICO archivo que se reescribe -- el endpoint, el
// controller y el frontend no saben ni les importa que proveedor hay detras.

const { GoogleGenAI, Type, ThinkingLevel } = require('@google/genai');

let cliente = null;
function obtenerCliente() {
  if (cliente) return cliente;
  if (!process.env.GEMINI_API_KEY) return null;
  cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return cliente;
}

const esquema = {
  type: Type.OBJECT,
  properties: {
    monto: { type: Type.NUMBER, nullable: true, description: 'El monto TOTAL pagado, tal como aparece en el ticket. null si no se puede leer con confianza.' },
    iva: { type: Type.NUMBER, nullable: true, description: 'El IVA, SOLO si el ticket lo desglosa explicitamente (ej. "IVA 16% incluido $104.00"). null si no aparece desglosado -- nunca lo calcules ni lo inventes.' },
    fecha: { type: Type.STRING, nullable: true, description: 'La fecha del ticket en formato YYYY-MM-DD. Si el ticket no trae año, asume el año actual. null si no se puede leer.' },
    comercio: { type: Type.STRING, nullable: true, description: 'El nombre del comercio o establecimiento donde se hizo el gasto.' },
    ubicacion: { type: Type.STRING, nullable: true, description: 'Ciudad o direccion, solo si aparece impresa en el ticket. null si no aparece.' },
    categoria_sugerida: { type: Type.STRING, nullable: true, description: 'Cual de las categorias de la lista dada se parece mas a este gasto. Debe ser EXACTAMENTE uno de esos nombres, o null si ninguna aplica bien.' },
    confianza: { type: Type.STRING, enum: ['alta', 'media', 'baja'], description: 'Que tan seguro estas de la lectura en general.' },
  },
  required: ['confianza'],
};

function construirPrompt(categoriasDisponibles) {
  return `Eres un asistente que lee tickets y recibos de gastos operativos (viaticos, combustible, comida, materiales, hospedaje, etc.) para una app de reembolsos de una empresa mexicana. Analiza la imagen adjunta y extrae los datos del ticket.

Categorias disponibles (elige la que mas se parezca, o null si ninguna aplica): ${categoriasDisponibles.join(', ')}.

Reglas importantes:
- Si no puedes leer un campo con confianza razonable, dejalo en null en vez de adivinar. Es mejor un campo vacio que uno incorrecto.
- El IVA solo se llena si el ticket lo desglosa explicitamente. No lo calcules a partir del total.
- La fecha siempre en formato YYYY-MM-DD.`;
}

// Error con un codigo que el controller traduce a un mensaje para el
// usuario. Antes cualquier fallo se tragaba y se regresaba VACIO, y el
// frontend no podia distinguir "Gemini esta caido" de "el ticket no se lee".
class ErrorExtraccion extends Error {
  constructor(codigo, message) {
    super(message);
    this.codigo = codigo; // 'saturado' | 'cuota' | 'sin_config'
  }
}

// Cadena de modelos: si el principal esta saturado o sin cuota, se pasa al
// siguiente. Medido 2026-10-14: gemini-3.6-flash daba 503 "high demand" en
// TODAS las llamadas por horas, mientras los -lite respondian en ~3 s con la
// misma lectura del ticket. En la capa gratis la cuota es POR MODELO, asi que
// un 429 en uno no impide usar el otro. Ojo: los flash mas nuevos (3.7/3.8)
// rechazan thinkingLevel MINIMAL con 400, por eso no estan aqui.
const MODELOS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
// 1 intento por modelo: con 2, el usuario esperaba hasta ~21 s mientras el
// principal fallaba dos veces antes de llegar al -lite.
const INTENTOS_POR_MODELO = 1;
const TIMEOUT_MS = 15000;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// 503/timeout: siguiente modelo. 429 (cuota agotada) no se reintenta en el mismo modelo: no se
// libera en segundos y solo gastaria mas cuota.
async function llamarGemini(client, request) {
  let ultimoError;
  let todosSinCuota = true;
  for (const model of MODELOS) {
    for (let intento = 1; intento <= INTENTOS_POR_MODELO; intento++) {
      try {
        return await client.models.generateContent({
          ...request,
          model,
          config: { ...request.config, httpOptions: { timeout: TIMEOUT_MS } },
        });
      } catch (err) {
        ultimoError = err;
        if (err.status === 429) break; // siguiente modelo
        todosSinCuota = false;
        // 5xx o error de red/timeout (sin status): reintentable
        const reintentable = !err.status || err.status >= 500;
        if (!reintentable) throw err;
        if (intento < INTENTOS_POR_MODELO) await esperar(1000);
      }
    }
  }
  if (todosSinCuota) throw new ErrorExtraccion('cuota', ultimoError.message);
  throw new ErrorExtraccion('saturado', ultimoError.message);
}

// bufferImagen: Buffer de la imagen. mimeType: ej. 'image/jpeg'.
// categoriasDisponibles: array de nombres de categorias activas de esta cuenta.
async function extraerDatosRecibo(bufferImagen, mimeType, categoriasDisponibles) {
  const client = obtenerCliente();
  if (!client) throw new ErrorExtraccion('sin_config', 'GEMINI_API_KEY no configurada');

  const response = await llamarGemini(client, {
    contents: [
      {
        role: 'user',
        parts: [
          { text: construirPrompt(categoriasDisponibles) },
          { inlineData: { data: bufferImagen.toString('base64'), mimeType } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: esquema,
      // Leer un ticket es transcripcion, no razonamiento. Con el thinking por
      // defecto el modelo gastaba ~500 tokens "pensando" y tardaba ~6.5 s;
      // con MINIMAL, ~2.5 s y el mismo resultado en los tickets de prueba.
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    },
  });

  const datos = JSON.parse(response.text);
  return {
    monto: typeof datos.monto === 'number' ? datos.monto : null,
    iva: typeof datos.iva === 'number' ? datos.iva : null,
    fecha: datos.fecha || null,
    comercio: datos.comercio || null,
    ubicacion: datos.ubicacion || null,
    // Nunca confiamos ciegamente en el nombre que regresa el modelo: solo se
    // usa si coincide exacto con una categoria que de verdad existe en esta
    // cuenta (el admin pudo haber renombrado/borrado categorias).
    categoria_sugerida: categoriasDisponibles.includes(datos.categoria_sugerida) ? datos.categoria_sugerida : null,
    confianza: ['alta', 'media', 'baja'].includes(datos.confianza) ? datos.confianza : 'baja',
  };
}

module.exports = { extraerDatosRecibo, ErrorExtraccion };
