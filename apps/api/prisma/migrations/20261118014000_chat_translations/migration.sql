-- Add bilingual/multilingual automatic chat translation columns to messages
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "sourceLanguage" TEXT DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS "translations" JSONB;
