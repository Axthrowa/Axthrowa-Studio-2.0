/** SahneAyarlari bölümleri (TEK-4: dosya bölündü, davranış aynı). */
import HotkeyInput from "../HotkeyInput";
import SettingsSection from "../SettingsSection";
import { Field, clampInt } from "./sahneOrtak";
import type { SahneAyarlariProps } from "./sahneOrtak";

export function ChatAyarlariBolumu(p: SahneAyarlariProps) {
  const { clearChatHk, clearChatNow, fetchKickChatroom, secOrder, setClearChatHk, setHotkeyCapture, settings, tt, update } = p;
  return (
    <SettingsSection id="chatAyarlari" title={tt("sec.chatAyarlari")} style={secOrder("chatAyarlari")} defaultOpen>
      <div className="rounded-xl border border-panel-accent/30 bg-panel-soft px-2.5 py-2 text-[11px] leading-relaxed text-panel-accent/90">
        <p className="mb-1 font-semibold text-panel-accent">{tt("chat.tipsTitle")}</p>
        <p>{tt("chat.tipsBody")}</p>
      </div>
      <p className="text-[11px] text-panel-muted">
        Üç platform tek listede akar. Kanal alanlarını boş bırakırsan{" "}
        <b className="text-white/80">Giriş</b> ekranındaki sosyal hesap adları
        kullanılır. OBS Browser Source:{" "}
        <code className="text-white/70">/chat?obs=1</code>
      </p>
      <Field
        label={tt("chat.scale")}
        value={String(settings.chatScale ?? 100)}
        onChange={(v) => update({ chatScale: clampInt(v, 40, 200, 100) })}
        type="number"
      />
      <Field
        label={tt("chat.width")}
        value={String(settings.chatBoxWidth ?? 100)}
        onChange={(v) => update({ chatBoxWidth: clampInt(v, 20, 100, 100) })}
        type="number"
      />
      <Field
        label={tt("chat.height")}
        value={String(settings.chatBoxHeight ?? 100)}
        onChange={(v) => update({ chatBoxHeight: clampInt(v, 20, 100, 100) })}
        type="number"
      />
      <p className="text-[11px] text-panel-muted">{tt("chat.sizeHint")}</p>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-xs">{tt("chat.clearHotkey")}</span>
        <HotkeyInput
          className="w-28 rounded border border-panel-border bg-black/40 px-1 py-1 text-center text-xs"
          value={clearChatHk || settings.clearChatHotkey || ""}
          placeholder="Ctrl+Shift+X"
          onListeningChange={setHotkeyCapture}
          onChange={(v) => {
            setClearChatHk(v);
            update({ clearChatHotkey: v });
          }}
        />
      </div>
      <p className="text-[11px] text-panel-muted">{tt("chat.clearHotkeyHint")}</p>
      <button
        type="button"
        className="w-full rounded-md bg-black/40 px-3 py-2 text-sm"
        onClick={() => void clearChatNow()}
      >
        {tt("chat.clearNow")}
      </button>
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.autoDetect !== false}
          onChange={(e) => update({ autoDetect: e.target.checked })}
        />
        Kanalları otomatik algıla (Giriş → sosyal hesaplar)
      </label>

      <label className="mt-2 flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.enableKick !== false}
          onChange={(e) => update({ enableKick: e.target.checked })}
        />
        Kick
      </label>
      {settings.enableKick !== false && (
        <>
          <Field
            label="Kick kullanıcı (boş = otomatik)"
            value={settings.kickSlug || ""}
            onChange={(v) => update({ kickSlug: v, chatroomId: null })}
          />
          <Field
            label="Chatroom ID (otomatik)"
            value={settings.chatroomId ? String(settings.chatroomId) : ""}
            onChange={(v) => update({ chatroomId: v || null })}
          />
          <button
            className="w-full rounded-md bg-black/40 px-3 py-2 text-sm"
            onClick={() => void fetchKickChatroom()}
          >
            Kick chatroom çek
          </button>
        </>
      )}

      <label className="mt-2 flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.enableTwitch !== false}
          onChange={(e) => update({ enableTwitch: e.target.checked })}
        />
        Twitch
      </label>
      {settings.enableTwitch !== false && (
        <Field
          label="Twitch kanal (boş = otomatik)"
          value={settings.twitchChannel || ""}
          onChange={(v) => update({ twitchChannel: v.replace(/^#/, "") })}
        />
      )}

      <label className="mt-2 flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.enableYoutube !== false}
          onChange={(e) => update({ enableYoutube: e.target.checked })}
        />
        YouTube
      </label>
      {settings.enableYoutube !== false && (
        <>
          <Field
            label="YouTube kanal (@handle, boş = otomatik)"
            value={settings.youtubeChannel || ""}
            onChange={(v) => update({ youtubeChannel: v })}
          />
          <Field
            label="veya canlı video URL / ID"
            value={settings.youtubeVideoId || ""}
            onChange={(v) => update({ youtubeVideoId: v })}
          />
          <p className="text-[11px] text-panel-muted">
            Kanal yayındayken @handle yeterli; yayın bitip yeniden başlarsa video
            kimliği kendiliğinden yenilenir.
          </p>
        </>
      )}

      <hr className="border-panel-border" />
      <Field
        label="Maks. mesaj"
        value={String(settings.maxMessages || 60)}
        onChange={(v) => update({ maxMessages: clampInt(v, 5, 500, 60) })}
        type="number"
      />
      <Field
        label="Yazı boyutu (px)"
        value={String(settings.fontSize || 22)}
        onChange={(v) => update({ fontSize: clampInt(v, 10, 80, 22) })}
        type="number"
      />
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.showPlatformBadge !== false}
          onChange={(e) => update({ showPlatformBadge: e.target.checked })}
        />
        Platform logosu (Twitch / Kick / YouTube)
      </label>
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.showUserBadges !== false}
          onChange={(e) => update({ showUserBadges: e.target.checked })}
        />
        Sohbet rozetleri (mod / abone / VIP)
      </label>
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={!!settings.showTimestamps}
          onChange={(e) => update({ showTimestamps: e.target.checked })}
        />
        Saat göster
      </label>
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.highlightEvents !== false}
          onChange={(e) => update({ highlightEvents: e.target.checked })}
        />
        Super Chat / abonelik / raid vurgusu
      </label>
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.autoHideMessages !== false}
          onChange={(e) => update({ autoHideMessages: e.target.checked })}
        />
        Mesajlar zamanla kaybolsun
      </label>
      {settings.autoHideMessages !== false && (
        <div>
          <label className="mb-1 block text-xs text-panel-muted">
            Kaybolma süresi (saniye)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={3}
              max={60}
              step={1}
              className="flex-1"
              value={Math.min(60, Math.max(3, Number(settings.messageHideSec) || 12))}
              onChange={(e) => update({ messageHideSec: Number(e.target.value) })}
            />
            <input
              type="number"
              min={2}
              max={180}
              className="w-16 rounded-md border border-panel-border bg-ui-s2 px-2 py-1 text-sm text-white"
              value={Number(settings.messageHideSec) || 12}
              onChange={(e) =>
                update({ messageHideSec: clampInt(e.target.value, 2, 180, 12) })
              }
            />
            <span className="text-xs text-panel-muted">sn</span>
          </div>
          <p className="mt-1 text-[11px] text-panel-muted">
            Süre dolunca mesaj solar ve listeden çıkar (varsayılan 12 sn).
          </p>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={!!settings.fadeOldMessages}
          onChange={(e) => update({ fadeOldMessages: e.target.checked })}
        />
        Liste üstü yumuşak maske (eski mesajlar soluk)
      </label>
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.textShadow !== false}
          onChange={(e) => update({ textShadow: e.target.checked })}
        />
        Yazı gölgesi (OBS'te okunurluk)
      </label>
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.bgTransparent !== false}
          onChange={(e) => update({ bgTransparent: e.target.checked })}
        />
        Şeffaf arka plan
      </label>
    </SettingsSection>
  );
}
