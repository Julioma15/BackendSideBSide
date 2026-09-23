-- 006 - Factura XML separada del PDF
--
-- Aplicar sobre una base que ya tiene datos:
--   psql -U postgres -d sidebside -f sql/migrations/006_factura_xml.sql
--
-- Las bases nuevas no necesitan esto: schema.sql ya viene actualizado.

BEGIN;

-- El CFDI (factura fiscal mexicana) trae dos archivos con validez distinta:
-- el XML es el documento fiscal, el PDF es solo la representacion legible.
-- Antes se subian como un solo archivo (factura_url aceptaba PDF o XML);
-- ahora van en columnas separadas porque el formulario los pide por
-- separado. factura_url queda como la representacion PDF/imagen.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS factura_xml_url VARCHAR(255);

COMMIT;
