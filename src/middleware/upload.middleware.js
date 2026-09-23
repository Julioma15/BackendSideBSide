const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('./errorHandler');

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Recibo/factura: foto o PDF (muchas empresas piden ambos formatos de
// factura). La extension guardada sale de este mapa, nunca del
// originalname que manda el cliente: asi el nombre de archivo guardado en
// disco y en la BD (gastos.foto_url / factura_url) queda 100% controlado
// por el servidor, sin importar que envie el cliente en el nombre original.
const tiposPermitidos = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  // CFDI (factura fiscal mexicana): el XML es el documento con validez
  // fiscal, el PDF es solo la representacion legible.
  'text/xml': '.xml',
  'application/xml': '.xml',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const sufijo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${sufijo}${tiposPermitidos[file.mimetype]}`);
  },
});

const maxMb = Number(process.env.MAX_UPLOAD_MB || 5);

const upload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!tiposPermitidos[file.mimetype]) {
      return cb(new AppError('Formato no soportado (usa JPG, PNG, WEBP, PDF o XML)', 400));
    }
    cb(null, true);
  },
});

// Solo para la extraccion automatica de datos del ticket (ver
// extraerRecibo.js): el archivo se manda a Gemini y se descarta, nunca debe
// tocar disco -- a diferencia de `upload`, que si persiste el comprobante
// real cuando el usuario ya confirmo el gasto.
const uploadMemoria = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!tiposPermitidos[file.mimetype]) {
      return cb(new AppError('Formato no soportado (usa JPG, PNG, WEBP o PDF)', 400));
    }
    cb(null, true);
  },
});

module.exports = { upload, uploadMemoria };
