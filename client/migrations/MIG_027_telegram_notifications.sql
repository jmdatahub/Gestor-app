-- MIG_027: Add telegram notification preference to profiles
-- Users can opt-out of Telegram alert notifications independently of having the chat linked

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_notifications_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.profiles.telegram_notifications_enabled
  IS 'When false, alerts created by the system are NOT forwarded to the user''s Telegram chat even if telegram_chat_id is set.';
