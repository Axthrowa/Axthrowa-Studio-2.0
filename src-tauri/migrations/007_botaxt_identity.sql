-- Görünen bot adı BotAxT; Kick chat POST hız limiti için varsayılan gecikme.
UPDATE bot_settings
   SET bot_name = 'BotAxT'
 WHERE lower(trim(bot_name)) IN ('bot', 'botaxt', 'sesbot', 'botrix', '');

UPDATE bot_settings
   SET reply_delay_ms = 1200
 WHERE reply_delay_ms IS NULL OR reply_delay_ms < 1100;
