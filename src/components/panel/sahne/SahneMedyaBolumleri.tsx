/** SahneAyarlari bölümleri (TEK-4: dosya bölündü, davranış aynı). */
import { ANIM_OPTIONS, EFFECT_OPTIONS } from "../../../lib/textStyles";
import { API_BASE, importLibraryFile } from "../../../lib/api";
import { DEFAULT_END_MARGIN } from "../../../lib/youtube";
import LazyMount from "../LazyMount";
import SettingsSection from "../SettingsSection";
import VideoTrimBar from "../VideoTrimBar";
import { open } from "@tauri-apps/plugin-dialog";
import { Field, VideoScrubber } from "./sahneOrtak";
import type { SahneAyarlariProps } from "./sahneOrtak";

export function YoutubeBolumu(p: SahneAyarlariProps) {
  const { indirme, indirmeMetni, indirmeSuruyor, secOrder, settings, showToast, tt, update } = p;
  return (
    <SettingsSection id="youtube" title={tt("sec.youtube")} style={secOrder("youtube")}>
      <Field
        label="YouTube URL"
        value={settings.youtubeUrl || ""}
        onChange={(v) =>
          update({
            youtubeUrl: v,
            youtubeDuration: null,
            youtubeStart: 0,
            youtubeEnd: 0,
            bgStyle: v ? "youtube" : settings.bgStyle,
            lastVideoSource: v ? "youtube" : settings.lastVideoSource,
          })
        }
      />
      {!!settings.youtubeUrl && (
        <div className="space-y-1.5 rounded-md border border-panel-border/60 bg-black/20 p-2">
          <p className="text-[11px] text-panel-muted">
            YouTube oynatıcısı videonun başında başlık ile duraklat ikonunu, sonunda da
            bitiş kartlarını kendi çiziyor. Videoyu yerele indirirsen bu arayüz hiç
            olmaz, döngü de kesintisiz olur.
          </p>
          {indirmeSuruyor ? (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
                <div
                  className="h-full rounded-full bg-panel-accent transition-[width] duration-200"
                  style={{
                    width:
                      indirme.durum.percent >= 0 ? `${indirme.durum.percent}%` : "100%",
                    opacity: indirme.durum.percent >= 0 ? 1 : 0.4,
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-panel-muted">
                  {indirmeMetni}
                </span>
                <button
                  type="button"
                  className="rounded-md bg-black/40 px-2 py-1 text-[11px]"
                  onClick={() => indirme.iptalEt()}
                >
                  İptal
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="w-full rounded-md bg-black/40 px-3 py-2 text-sm"
              onClick={() => void indirme.indir(String(settings.youtubeUrl))}
            >
              ⬇ İndir ve yerelde sakla
            </button>
          )}
          {(indirme.durum.phase === "hata" || indirme.durum.phase === "iptal") && (
            <p className="rounded-md border border-panel-cta/40 bg-panel-cta/10 px-2 py-1.5 text-[11px] text-orange-100">
              {indirme.durum.message || "İndirme tamamlanamadı"}
            </p>
          )}
        </div>
      )}
      {!!settings.youtubeUrl && (
        <>
          <LazyMount minHeight={220}>
          <VideoScrubber
            youtubeUrl={settings.youtubeUrl}
            start={Number(settings.youtubeStart) || 0}
            end={Number(settings.youtubeEnd) || 0}
            onDuration={(d) => {
              // Önizlemede süreyi zaten okuduk; kırpma barı tahmine
              // düşmesin diye ayarlara yazıyoruz.
              if (Math.abs((Number(settings.youtubeDuration) || 0) - d) > 0.5) {
                update({ youtubeDuration: d });
              }
            }}
            onSetStart={(t) =>
              update({ youtubeStart: t, bgStyle: "youtube", lastVideoSource: "youtube" })
            }
            onSetEnd={(t) =>
              update({ youtubeEnd: t, bgStyle: "youtube", lastVideoSource: "youtube" })
            }
            onGoLive={(t) => {
              update({
                bgStyle: "youtube",
                lastVideoSource: "youtube",
                videoSeek: t,
                videoSeekAt: Date.now(),
              });
              showToast("YouTube videosu yayına verildi");
            }}
            endMargin={
              Number(settings.youtubeEndMargin) > 0
                ? Number(settings.youtubeEndMargin)
                : DEFAULT_END_MARGIN
            }
          />
          </LazyMount>
          <VideoTrimBar
            durationHint={
              Number(settings.youtubeDuration) > 0
                ? Number(settings.youtubeDuration)
                : Math.max(
                    60,
                    Number(settings.youtubeEnd) || 0,
                    Number(settings.youtubeStart) || 0,
                    600
                  )
            }
            start={Number(settings.youtubeStart) || 0}
            end={Number(settings.youtubeEnd) || 0}
            onChange={(start, end) =>
              update({
                youtubeStart: start,
                youtubeEnd: end,
                bgStyle: "youtube",
                lastVideoSource: "youtube",
              })
            }
            label="YouTube kırpma"
          />
          {Number(settings.youtubeDuration) > 0 ? (
            <p className="text-[11px] text-panel-muted">
              Süre otomatik: {Math.floor(Number(settings.youtubeDuration) / 60)}:
              {String(Math.floor(Number(settings.youtubeDuration) % 60)).padStart(2, "0")}
            </p>
          ) : (
            <p className="text-[11px] text-panel-muted">Süre yükleniyor (önizleme / OBS açıkken)…</p>
          )}
          <div>
            <label className="mb-1 block text-xs text-panel-muted">YouTube kalite</label>
            <select aria-label="YouTube kalite"
              className="w-full rounded-md border border-panel-border bg-ui-s2 px-2 py-2 text-sm text-white"
              value={settings.youtubeQuality || "hd1080"}
              onChange={(e) => update({ youtubeQuality: e.target.value, bgStyle: "youtube" })}
            >
              <option value="default">Otomatik</option>
              <option value="small">360p</option>
              <option value="medium">480p</option>
              <option value="large">720p</option>
              <option value="hd720">HD 720</option>
              <option value="hd1080">Full HD 1080</option>
              <option value="highres">En yüksek</option>
            </select>
          </div>
          <label className="flex items-start gap-2 rounded-md border border-panel-border/60 bg-black/20 p-2 text-xs text-white">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!settings.youtubePlayToEnd}
              onChange={(e) => update({ youtubePlayToEnd: !e.target.checked })}
            />
            <span>
              Bitiş kartlarını engelle
              <span className="mt-0.5 block text-[11px] text-panel-muted">
                YouTube&apos;un bitiş kartları oynatıcının kendi içinde çiziliyor;
                dışarıdan kapatan bir ayar ya da CSS yok. Tek çalışan yol o bölüme hiç
                girmemek. Uygulama videonun kart bilgisini YouTube&apos;dan okuyor:
                <b> kartı olmayan videolar hiç kısalmadan sonuna kadar oynar</b>, kartı
                olanlar da tam kartın çıktığı saniyede başa sarar. Kapatırsan her video
                sonuna kadar oynar ama varsa kartlar görünür.
              </span>
            </span>
          </label>
          <div className={settings.youtubePlayToEnd ? "opacity-40" : undefined}>
            <label className="mb-1 block text-xs text-panel-muted">
              Kart bilgisi okunamazsa sondan atlanacak süre (sn)
            </label>
            <input aria-label="Kart bilgisi okunamazsa sondan atlanacak süre (sn)"
              type="number"
              min={0.5}
              max={60}
              step={0.5}
              disabled={!!settings.youtubePlayToEnd}
              className="w-full rounded-md border border-panel-border bg-black/40 px-2 py-2 text-sm text-white"
              value={
                Number(settings.youtubeEndMargin) > 0
                  ? Number(settings.youtubeEndMargin)
                  : DEFAULT_END_MARGIN
              }
              onChange={(e) =>
                update({
                  youtubeEndMargin: Math.min(
                    60,
                    Math.max(0.5, Number(e.target.value) || DEFAULT_END_MARGIN)
                  ),
                })
              }
            />
            <p className="mt-1 text-[10px] text-panel-muted">
              Normalde kullanılmaz — video sonuna kadar ya da tam kartın çıktığı saniyeye
              kadar oynar. Yalnızca YouTube&apos;a ulaşılamayıp kart bilgisi okunamadığında
              bu kör pay devreye girer. Kartlar en erken bitişten 20 sn önce
              çıkabildiği için varsayılan 20.
            </p>
          </div>

      <div className="rounded-md border border-panel-border/60 bg-ui-s1 p-3">
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={!!settings.videoSound}
            onChange={(e) => update({ videoSound: e.target.checked })}
          />
          Video sesi açık
        </label>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="w-16 text-panel-muted">Seviye</span>
          <input aria-label="Seviye"
            type="range"
            min={0}
            max={100}
            step={1}
            className="flex-1"
            value={settings.videoVolume ?? 100}
            onChange={(e) => update({ videoVolume: Number(e.target.value) })}
          />
          <span className="w-10 text-right text-white">{settings.videoVolume ?? 100}%</span>
        </div>
        <p className="mt-1 text-[10px] text-panel-muted">
          Yerel video ve YouTube aynı ses ayarını kullanır — hangisi fon ise o çalar.
        </p>
      </div>

        </>
      )}
    </SettingsSection>
  );
}

export function FonMuzigiBolumu(p: SahneAyarlariProps) {
  const { musicFiles, refreshMusic, screen, secOrder, settings, showToast, tt, update } = p;
  return (
    <SettingsSection id="fonMuzigi" title={tt("sec.fonMuzigi")} style={secOrder("fonMuzigi")}>
      <p className="text-[11px] text-panel-muted">
        Arka plan müziği uygulama deposunda saklanır; varsayılan olarak döngüde çalar. Sil =
        diskten siler.
      </p>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-panel-border/60 bg-black/20 p-1.5">
        {musicFiles.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-panel-muted">Henüz müzik yok</p>
        )}
        {musicFiles.map((name) => {
          const active =
            settings.bgAudioPath === name ||
            (settings.bgAudioPath || "").replace(/\\/g, "/").endsWith("/" + name);
          return (
            <div key={name} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-black/30">
              <button
                type="button"
                className={`min-w-0 flex-1 truncate text-left text-xs ${active ? "text-panel-accent" : ""}`}
                onClick={() =>
                  update({ bgAudioPath: name, audioLoop: settings.audioLoop !== false, musicSound: true })
                }
                title={name}
              >
                {active ? "▶ " : ""}
                {name}
              </button>
              <button
                type="button"
                className="shrink-0 text-[10px] text-red-300"
                onClick={async () => {
                  await fetch(`${API_BASE}/api/music/delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name }),
                  });
                  if (active) update({ bgAudioPath: null });
                  refreshMusic();
                  showToast("Müzik silindi");
                }}
              >
                Sil
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-md bg-black/40 px-3 py-2 text-sm"
          onClick={async () => {
            try {
              const selected = await open({
                multiple: false,
                filters: [
                  {
                    name: "Ses",
                    extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac"],
                  },
                ],
              });
              if (typeof selected !== "string") return;
              const data = await importLibraryFile("music", selected);
              refreshMusic();
              if (data?.name) {
                update({
                  bgAudioPath: data.name,
                  audioLoop: true,
                  musicSound: settings.musicSound !== false,
                });
                showToast("Fon müziği eklendi (döngü açık)");
              }
            } catch {
              showToast("Müzik eklenemedi");
            }
          }}
        >
          + Fon müziği ekle
        </button>
        {settings.bgAudioPath && (
          <button
            className="rounded-md bg-black/40 px-3 py-2 text-sm"
            onClick={() => update({ bgAudioPath: null })}
          >
            Bu ekranda kapat
          </button>
        )}
      </div>
      {settings.bgAudioPath && (
        <p className="truncate text-[11px] text-panel-muted">
          Aktif: {String(settings.bgAudioPath).split(/[/\\]/).pop()}
        </p>
      )}

      <label className="flex items-start gap-2 rounded-md border border-panel-border/60 bg-black/20 p-2 text-xs text-white">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={!!settings.musicShared}
          onChange={(e) => update({ musicShared: e.target.checked })}
        />
        <span>
          Aynı müzik Giriş, Çıkış ve Mola ekranlarında çalsın
          <span className="mt-0.5 block text-[11px] text-panel-muted">
            Seçtiğin parça, döngü, ses açık/kapalı ve seviye üç ekrana birden yazılır.
            OBS&apos;te üç sahne aynı anda açıksa sesi üst üste duyarsın — kaynak
            ayarlarında &ldquo;Görünür değilken kaynağı kapat&rdquo;ı işaretle.
          </span>
        </span>
      </label>

      {/* Video sesi artık ilgili videonun yanında; burada müzik kalıyor. */}
      <p className="text-[11px] font-medium text-panel-muted">Müzik sesi</p>
      <div className="space-y-3 rounded-md border border-panel-border/60 bg-ui-s1 p-3">
        <div>
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={settings.musicSound !== false}
              onChange={(e) => update({ musicSound: e.target.checked })}
            />
            Müzik sesi açık
          </label>
          <label className="mt-1.5 flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={settings.audioLoop !== false}
              disabled={
                (screen === "starting" &&
                  settings.obs?.autoSwitchOnStartingMediaEnd !== false) ||
                (screen === "ending" &&
                  settings.obs?.stopStreamOnEnd !== false &&
                  !settings.endingMinutes &&
                  !settings.targetDate)
              }
              onChange={(e) => update({ audioLoop: e.target.checked })}
            />
            Müziği döngüde çal (fon müziği)
          </label>
          {((screen === "starting" &&
            settings.obs?.autoSwitchOnStartingMediaEnd !== false) ||
            (screen === "ending" &&
              settings.obs?.stopStreamOnEnd !== false &&
              !settings.endingMinutes &&
              !settings.targetDate)) && (
            <p className="mt-1 text-[10px] text-panel-muted">
              Medya bitiş aksiyonu açıkken müzik bir kez çalar (döngü kapalı).
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className="w-16 text-panel-muted">Seviye</span>
            <input aria-label="Seviye"
              type="range"
              min={0}
              max={100}
              step={1}
              className="flex-1"
              value={settings.musicVolume ?? 70}
              onChange={(e) => update({ musicVolume: Number(e.target.value) })}
            />
            <span className="w-10 text-right text-white">{settings.musicVolume ?? 70}%</span>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

export function LogoBolumu(p: SahneAyarlariProps) {
  const { logoFiles, pickLogo, refreshLogos, secOrder, settings, tt, update } = p;
  return (
    <SettingsSection id="logo" title={tt("sec.logo")} style={secOrder("logo")}>
      <p className="text-[11px] text-panel-muted">Dosya olarak kaydedilir; kapanınca kaybolmaz.</p>
      <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-panel-border/60 bg-black/20 p-1.5">
        {logoFiles.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-panel-muted">Henüz logo yok</p>
        )}
        {logoFiles.map((name) => {
          const active = settings.logoFile === name;
          return (
            <div key={name} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-black/30">
              <button
                type="button"
                className={`min-w-0 flex-1 truncate text-left text-xs ${active ? "text-panel-accent" : ""}`}
                onClick={() => update({ logoFile: name, logo: null, logoPath: null })}
              >
                {active ? "▶ " : ""}
                {name}
              </button>
              <button
                type="button"
                className="shrink-0 text-[10px] text-red-300"
                onClick={async () => {
                  await fetch(`${API_BASE}/api/logos/delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name }),
                  });
                  if (active) update({ logoFile: null, logo: null });
                  refreshLogos();
                }}
              >
                Sil
              </button>
            </div>
          );
        })}
      </div>
      {settings.logoFile && !logoFiles.includes(settings.logoFile) ? (
        <p role="alert" className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-200">
          Seçili logo ({settings.logoFile}) bu uygulama klasörünün assets\logos klasöründe yok, ekranda görünmez. Yeni sürüm klasörüne geçtiysen logoyu yeniden ekle.
        </p>
      ) : null}
      <button className="w-full rounded-md bg-black/40 px-3 py-2 text-sm" onClick={() => void pickLogo()}>
        + Logo ekle / kaydet
      </button>
      {(settings.logoFile || settings.logo) && (
        <button
          className="w-full rounded-md bg-black/40 px-3 py-2 text-xs"
          onClick={() => update({ logoFile: null, logo: null, logoPath: null })}
        >
          Bu ekranda logoyu kaldır
        </button>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={settings.logoFit !== false} onChange={(e) => update({ logoFit: e.target.checked })} />
        Logo sığdır / kırp
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={settings.logoFrame !== false} onChange={(e) => update({ logoFrame: e.target.checked })} />
        Logo çerçevesi
      </label>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-20 text-panel-muted">Biçim</span>
        <select aria-label="Logo biçimi"
          className="flex-1 rounded-md border border-panel-border bg-ui-s2 px-2 py-1.5 text-sm text-white"
          value={settings.logoShape || "daire"}
          onChange={(e) => update({ logoShape: e.target.value })}
        >
          <option value="daire">Daire</option>
          <option value="yuvarlakKare">Yuvarlak kare</option>
          <option value="kare">Kare</option>
        </select>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-20 text-panel-muted">Zoom</span>
        <input aria-label="Zoom"
          type="range"
          min={50}
          max={250}
          value={settings.logoZoom ?? 100}
          onChange={(e) => update({ logoZoom: Number(e.target.value) })}
          className="flex-1"
        />
        <span>{settings.logoZoom ?? 100}%</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-20 text-panel-muted">Kaydır X</span>
        <input aria-label="Kaydır X"
          type="range"
          min={-40}
          max={40}
          value={settings.logoPanX ?? 0}
          onChange={(e) => update({ logoPanX: Number(e.target.value) })}
          className="flex-1"
        />
        <span>{settings.logoPanX ?? 0}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-20 text-panel-muted">Kaydır Y</span>
        <input aria-label="Kaydır Y"
          type="range"
          min={-40}
          max={40}
          value={settings.logoPanY ?? 0}
          onChange={(e) => update({ logoPanY: Number(e.target.value) })}
          className="flex-1"
        />
        <span>{settings.logoPanY ?? 0}</span>
      </div>
      <div>
        <label className="mb-1 block text-xs text-panel-muted">Logo efekt</label>
        <select aria-label="Logo efekt"
          className="w-full rounded-md border border-panel-border bg-ui-s2 px-2 py-2 text-sm text-white"
          value={settings.logoEffect || "none"}
          onChange={(e) => update({ logoEffect: e.target.value })}
        >
          {EFFECT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-panel-muted">Logo animasyon</label>
        <select aria-label="Logo animasyon"
          className="w-full rounded-md border border-panel-border bg-ui-s2 px-2 py-2 text-sm text-white"
          value={settings.logoAnim || "none"}
          onChange={(e) => update({ logoAnim: e.target.value })}
        >
          {ANIM_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-panel-muted">Logo vurgu rengi</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Logo vurgu rengi"
            className="h-9 w-12 cursor-pointer rounded border border-panel-border bg-ui-s2"
            value={settings.logoAccentColor || settings.accent || "#7c5cff"}
            onChange={(e) => update({ logoAccentColor: e.target.value })}
          />
          <button
            type="button"
            className="rounded-md bg-black/40 px-2 py-1.5 text-[11px] text-white"
            onClick={() => update({ logoAccentColor: null })}
          >
            Genel accent
          </button>
        </div>
      </div>
    </SettingsSection>
  );
}
