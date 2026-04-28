-- Migration: Add telegram_chat_id to profiles

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT UNIQUE;

-- Create an index to quickly find users by their telegram chat id
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id 
ON public.profiles(telegram_chat_id);
