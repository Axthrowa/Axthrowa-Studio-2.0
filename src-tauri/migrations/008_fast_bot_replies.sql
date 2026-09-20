-- Kick gönderim kuyruğu kendi hız limitini uygular; pipeline'da ikinci kez
-- 1200 ms beklemek ilk yanıtı gereksiz geciktiriyordu.
UPDATE bot_settings
SET reply_delay_ms = 0
WHERE reply_delay_ms IS NULL OR reply_delay_ms >= 250;
