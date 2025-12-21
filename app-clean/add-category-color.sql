-- SQL para añadir columna color a la tabla categories en Supabase
-- Ejecutar en el SQL Editor de Supabase

-- Añadir columna color si no existe
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT;

-- Opcional: Actualizar categorías existentes con colores por defecto
-- (esto asigna colores aleatorios de una paleta predefinida)
UPDATE categories 
SET color = CASE (random() * 8)::int
  WHEN 0 THEN '#818cf8'
  WHEN 1 THEN '#34d399'
  WHEN 2 THEN '#fbbf24'
  WHEN 3 THEN '#f87171'
  WHEN 4 THEN '#60a5fa'
  WHEN 5 THEN '#a78bfa'
  WHEN 6 THEN '#fb923c'
  ELSE '#4ade80'
END
WHERE color IS NULL;
