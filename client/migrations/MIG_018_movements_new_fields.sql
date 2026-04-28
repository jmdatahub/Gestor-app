-- =============================================
-- MIGRACIÓN 018: Nuevos campos para Movimientos
-- =============================================
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Añadir campos de IVA
ALTER TABLE public.movements 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 21,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2);

-- 2. Añadir campo proveedor
ALTER TABLE public.movements 
ADD COLUMN IF NOT EXISTS provider TEXT;

-- 3. Añadir método de pago
ALTER TABLE public.movements 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 4. Añadir campos "pagado por" (para organizaciones)
ALTER TABLE public.movements 
ADD COLUMN IF NOT EXISTS paid_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS paid_by_external TEXT;

-- 5. Añadir vínculo con deudas
ALTER TABLE public.movements 
ADD COLUMN IF NOT EXISTS linked_debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL;

-- 6. Añadir campos de suscripción
ALTER TABLE public.movements 
ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_end_date DATE,
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true;

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_movements_provider ON public.movements(provider);
CREATE INDEX IF NOT EXISTS idx_movements_subscription ON public.movements(is_subscription) WHERE is_subscription = true;
CREATE INDEX IF NOT EXISTS idx_movements_subscription_end ON public.movements(subscription_end_date) WHERE subscription_end_date IS NOT NULL;

-- Verificación
SELECT 'Campos añadidos a movements correctamente' AS status;
