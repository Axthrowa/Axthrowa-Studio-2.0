/** SahneAyarlari bölümleri (TEK-4: dosya bölündü, davranış aynı). */
import { API_BASE } from "../../../lib/api";
import LazyMount from "../LazyMount";
import PanelTimer from "../PanelTimer";
import SettingsSection from "../SettingsSection";
import TextStyleEditor from "../TextStyleEditor";
import VideoTrimBar from "../VideoTrimBar";
import { Field, Select, VideoScrubber } from "./sahneOrtak";
import type { SahneAyarlariProps } from "./sahneOrtak";

export function MetinBolumu(p: SahneAyarlariProps) {
  const { secOrder, settings, tt, update } = p;
  return (
    <SettingsSection id="metin" title={tt("sec.metin")} style={secOrder("metin")}>
      <Field alan="eyebrow" label={tt("field.eyebrow")} value={settings.eyebrow || ""} onChange={(v) => update({ eyebrow: v })} />
      <Field alan="title" label={tt("field.title")} value={settings.title || ""} onChange={(v) => update({ title: v })} />
      <Field alan="sub" label={tt("field.sub")} value={settings.sub || ""} onChange={(v) => update({ sub: v })} />
      <Field label={tt("field.badge")} value={settings.liveText || ""} onChange={(v) => update({ liveText: v })} />
      <Field alan="ticker" label={tt("field.ticker")} value={settings.ticker || ""} onChange={(v) => update({ ticker: v })} />
      {/* Yazı stilleri ait oldukları ayarın altında (eskiden ayrı "Yazı stilleri" bölümündeydi) */}
      <TextStyleEditor settings={settings} onChange={update} sadece={["eyebrow", "title", "sub", "ticker"]} />
    </SettingsSection>
  );
}

export function GeriSayimBolumu(p: SahneAyarlariProps) {
  const { scenes, screen, secOrder, settings, tt, update } = p;
  return (
    <SettingsSection id="geriSayim" title={tt("sec.geriSayim")} style={secOrder("geriSayim")}>
      <TextStyleEditor settings={settings} onChange={update} sadece={["countdown"]} />
      <Field
        label="Geri sayım (datetime-local)"
        value={settings.targetDate || ""}
        onChange={(v) => update({ targetDate: v })}
        type="datetime-local"
      />
      <button
        className="w-full rounded-md bg-black/40 px-2 py-2 text-xs"
        onClick={() => {
          const mins = Number(prompt("Kaç dakika sonra?", "10")) || 10;
          const d = new Date(Date.now() + mins * 60_000);
          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          update({ targetDate: local });
        }}
      >
        …veya X dakika sonra ayarla
      </button>

      {screen === "brb" && (
        <>
          <Field
            label="BRB dakika"
            value={String(settings.brbMinutes ?? 5)}
            onChange={(v) => {
              sessionStorage.removeItem("brb_end_" + (settings.brbMinutes || 5));
              sessionStorage.removeItem("brb_end_" + (Number(v) || 5));
              update({ brbMinutes: Number(v) || 5 });
            }}
            type="number"
          />
          <Select
            label="Mola ekranı açılınca OBS sahnesi"
            value={settings.obs?.brbScene || settings.obs?.sceneMap?.brb || ""}
            options={scenes}
            onChange={(v) =>
              update({
                obs: {
                  ...(settings.obs || {}),
                  brbScene: v,
                  sceneMap: { ...(settings.obs?.sceneMap || {}), brb: v },
                },
              })
            }
          />
          <Select
            label="Mola bitince otomatik sahne"
            value={settings.obs?.brbEndScene || settings.obs?.returnScene || ""}
            options={scenes}
            onChange={(v) =>
              update({ obs: { ...(settings.obs || {}), brbEndScene: v, returnScene: v } })
            }
          />
          <Field
            label="Mola bitiş sahnesi (elle)"
            value={settings.obs?.brbEndScene || settings.obs?.returnScene || ""}
            onChange={(v) =>
              update({ obs: { ...(settings.obs || {}), brbEndScene: v, returnScene: v } })
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.obs?.autoSwitchOnBrbEnd !== false}
              onChange={(e) =>
                update({ obs: { ...(settings.obs || {}), autoSwitchOnBrbEnd: e.target.checked } })
              }
            />
            Süre bitince otomatik geç
          </label>
        </>
      )}

      {screen === "starting" && (
        <>
          <Select
            label="Giriş ekranı açılınca OBS sahnesi"
            value={settings.obs?.startingScene || settings.obs?.sceneMap?.starting || ""}
            options={scenes}
            onChange={(v) =>
              update({
                obs: {
                  ...(settings.obs || {}),
                  startingScene: v,
                  sceneMap: { ...(settings.obs?.sceneMap || {}), starting: v },
                },
              })
            }
          />
          <div className="rounded-xl border border-panel-accent/30 bg-panel-elevated/60 px-3 py-2.5 text-sm">
            <div className="font-medium text-panel-accent">Sabit geri sayım: 5:00</div>
            <p className="mt-1 text-[11px] leading-relaxed text-panel-muted">
              Giriş sahnesine her geçişte 5 dakikadan geri sayar. Süre bitince OBS’de
              atanmış <b className="text-white/80">Oyun</b> sahnesine geçer.
            </p>
            <PanelTimer
              timer={{ screen }}
              render={(text) => (
                <div className="mt-2 font-display text-2xl tabular-nums text-white">{text}</div>
              )}
            />
          </div>
          <Select
            label="Süre bitince şu sahneye geç"
            value={
              settings.obs?.sceneMap?.game ||
              settings.obs?.sceneOnEnd ||
              settings.obs?.returnScene ||
              ""
            }
            options={scenes}
            onChange={(v) =>
              update({
                obs: {
                  ...(settings.obs || {}),
                  sceneOnEnd: v,
                  returnScene: v,
                  sceneMap: { ...(settings.obs?.sceneMap || {}), game: v },
                },
              })
            }
          />
          <Field
            label="Sahne adı (elle)"
            value={
              settings.obs?.sceneMap?.game ||
              settings.obs?.sceneOnEnd ||
              settings.obs?.returnScene ||
              ""
            }
            onChange={(v) =>
              update({
                obs: {
                  ...(settings.obs || {}),
                  sceneOnEnd: v,
                  returnScene: v,
                  sceneMap: { ...(settings.obs?.sceneMap || {}), game: v },
                },
              })
            }
          />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.obs?.autoSwitchOnStartingMediaEnd !== false}
              onChange={(e) =>
                update({
                  obs: {
                    ...(settings.obs || {}),
                    autoSwitchOnStartingMediaEnd: e.target.checked,
                  },
                })
              }
            />
            <span>
              Sayaç yokken / bitmişken video-müzik bitince de oyun sahnesine geç
              <span className="mt-0.5 block text-[11px] text-panel-muted">
                5 dk sayacı çalışırken bu seçenek uygulanmaz; önce süre biter.
              </span>
            </span>
          </label>
        </>
      )}

      {screen === "ending" && (
        <>
          <Select
            label="Çıkış ekranı açılınca OBS sahnesi"
            value={
              settings.obs?.endingScene ||
              settings.obs?.sceneMap?.ending ||
              ""
            }
            options={scenes}
            onChange={(v) =>
              update({
                obs: {
                  ...(settings.obs || {}),
                  endingScene: v,
                  sceneMap: { ...(settings.obs?.sceneMap || {}), ending: v },
                },
              })
            }
          />
          <Field
            label="Çıkış süresi (dakika)"
            value={
              settings.endingMinutes === 0 || settings.endingMinutes === ""
                ? ""
                : String(settings.endingMinutes ?? "")
            }
            onChange={(v) => {
              const eski = Number(settings.endingMinutes) || 0;
              if (eski) sessionStorage.removeItem("ending_end_" + eski);
              const temiz = String(v).trim();
              if (!temiz) {
                update({ endingMinutes: 0 });
                return;
              }
              const n = Math.max(0, Number(temiz) || 0);
              sessionStorage.removeItem("ending_end_" + n);
              update({ endingMinutes: n });
            }}
            type="number"
            placeholder="Boş = video/müzik bitince"
          />
          <p className="text-[11px] text-panel-muted">
            Boş bırakırsan arka plan videosu veya fon müziği bitince bitiş aksiyonu
            çalışır. Dakika girersen önce geri sayım biter.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.obs?.stopStreamOnEnd !== false}
              onChange={(e) =>
                update({ obs: { ...(settings.obs || {}), stopStreamOnEnd: e.target.checked } })
              }
            />
            <span>
              Video / müzik (veya süre) bitince yayını kapat
              <span className="mt-0.5 block text-[11px] text-panel-muted">
                OBS Stop Stream. Kapalıysa medya bitince yayın kapanmaz.
              </span>
            </span>
          </label>
        </>
      )}
    </SettingsSection>
  );
}

export function ArkaPlanBolumu(p: SahneAyarlariProps) {
  const { bgFiles, pickBackground, refreshBackgrounds, secOrder, settings, showToast, tt, update, videoFiles } = p;
  return (
    <SettingsSection id="arkaPlan" title={tt("sec.arkaPlan")} style={secOrder("arkaPlan")}>
      <div>
        <label className="mb-1 block text-xs text-panel-muted">{tt("field.bg")}</label>
        <select
          aria-label={tt("field.bg")}
          className="w-full rounded-md border border-panel-border bg-ui-s2 px-2 py-2 text-sm text-white"
          value={settings.bgStyle || "mix"}
          onChange={(e) => update({ bgStyle: e.target.value })}
        >
          <option value="mix">{tt("bg.mix")}</option>
          <option value="accent">{tt("bg.accent")}</option>
          <option value="dark">{tt("bg.dark")}</option>
          <option value="image">{tt("bg.image")}</option>
          <option value="video">{tt("bg.video")}</option>
          <option value="youtube">{tt("bg.youtube")}</option>
        </select>
      </div>

      <button
        className="w-full rounded-md bg-black/40 px-3 py-2 text-sm"
        onClick={() => void pickBackground()}
      >
        + Hareketli / sabit arka plan ekle (GIF, WebP, PNG)
      </button>
      <p className="text-[11px] font-medium text-panel-muted">Arka plan görselleri</p>
      <p className="text-[11px] text-panel-muted">
        GIF ve animasyonlu WebP desteklenir. Sil = uygulama deposundan kalıcı siler.
      </p>
      <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-panel-border/60 bg-black/20 p-1.5">
        {bgFiles.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-panel-muted">Henüz arka plan yok</p>
        )}
        {bgFiles.map((name) => {
          const active =
            settings.bgImagePath === name ||
            (settings.bgImagePath || "").replace(/\\/g, "/").endsWith("/" + name);
          return (
            <div key={name} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-black/30">
              <button
                type="button"
                className={`min-w-0 flex-1 truncate text-left text-xs ${active ? "text-panel-accent" : ""}`}
                onClick={() => update({ bgImagePath: name, bgImage: null, bgStyle: "image" })}
              >
                {active ? "▶ " : ""}
                {name}
              </button>
              <button
                type="button"
                className="shrink-0 text-[10px] text-red-300"
                onClick={async () => {
                  await fetch(`${API_BASE}/api/backgrounds/delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name }),
                  });
                  if (active) update({ bgImagePath: null });
                  refreshBackgrounds();
                  showToast("Arka plan silindi");
                }}
              >
                Sil
              </button>
            </div>
          );
        })}
      </div>
      {settings.bgImagePath && (
        <p className="truncate text-[11px] text-panel-muted">
          Aktif arka plan: {String(settings.bgImagePath).split(/[/\\]/).pop()}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className={`flex-1 rounded-md px-2 py-2 text-sm ${
            settings.bgStyle === "video"
              ? "bg-panel-accent text-[color:var(--panel-cta-ink)] font-semibold"
              : "bg-black/40"
          }`}
          onClick={() => {
            if (!settings.bgVideoPath && videoFiles[0]) {
              update({ bgStyle: "video", bgVideoPath: videoFiles[0], lastVideoSource: "video" });
            } else {
              update({ bgStyle: "video", lastVideoSource: "video" });
            }
          }}
        >
          Yerel video
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-2 py-2 text-sm ${
            settings.bgStyle === "youtube"
              ? "bg-panel-accent text-[color:var(--panel-cta-ink)] font-semibold"
              : "bg-black/40"
          }`}
          onClick={() => update({ bgStyle: "youtube", lastVideoSource: "youtube" })}
        >
          YouTube
        </button>
      </div>
    </SettingsSection>
  );
}

export function VideoBolumu(p: SahneAyarlariProps) {
  const { pickLocalVideo, refreshVideos, secOrder, settings, showToast, tt, update, videoFiles } = p;
  return (
    <SettingsSection id="video" title={tt("sec.video")} style={secOrder("video")}>
      <p className="text-[11px] text-panel-muted">
        Videolar <code className="text-white/70">assets/videos</code> içine kopyalanır. Sil =
        diskten de siler.
      </p>
      <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-panel-border/60 bg-black/20 p-1.5">
        {videoFiles.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-panel-muted">Henüz yerel video yok</p>
        )}
        {videoFiles.map((name) => {
          const active =
            settings.bgVideoPath === name ||
            (settings.bgVideoPath || "").replace(/\\/g, "/").endsWith("/" + name);
          return (
            <div key={name} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-black/30">
              <button
                type="button"
                className={`min-w-0 flex-1 truncate text-left text-xs ${active ? "text-panel-accent" : ""}`}
                onClick={() =>
                  update({
                    bgVideoPath: name,
                    bgVideoStart: 0,
                    bgVideoEnd: 0,
                    bgStyle: "video",
                    lastVideoSource: "video",
                  })
                }
              >
                {active ? "▶ " : ""}
                {name}
              </button>
              <button
                type="button"
                className="shrink-0 text-[10px] text-red-300"
                onClick={async () => {
                  await fetch(`${API_BASE}/api/videos/delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name }),
                  });
                  if (active) update({ bgVideoPath: null });
                  refreshVideos();
                  showToast("Video depodan silindi");
                }}
              >
                Sil
              </button>
            </div>
          );
        })}
      </div>
      <button className="w-full rounded-md bg-black/40 px-3 py-2 text-sm" onClick={() => void pickLocalVideo()}>
        + Yerel video ekle (uygulama deposu)
      </button>
      {/* OBS'in gömülü tarayıcısında donanımlı VP9/AV1 çözümü yok; bu
          biçimler uygulamada akıcı oynarken OBS'te takılabiliyor. */}
      {/\.(webm|mkv)$/i.test(String(settings.bgVideoPath || "")) && (
        <p className="rounded-md border border-panel-cta/40 bg-panel-cta/10 px-2 py-1.5 text-[11px] text-orange-100">
          Bu video <b>{String(settings.bgVideoPath).split(".").pop()?.toUpperCase()}</b>{" "}
          biçiminde. OBS&apos;in tarayıcı kaynağı VP9/AV1&apos;i donanımla çözemediği için
          uygulamada akıcı oynasa da OBS&apos;te takılabilir — özellikle 4K dosyalarda.
          Takılma yaşarsan videoyu <b>MP4 (H.264)</b> olarak dönüştürüp ekle.
        </p>
      )}
      {settings.bgVideoPath && (
        <p className="truncate text-[11px] text-panel-muted">
          Aktif yerel: {String(settings.bgVideoPath).split(/[/\\]/).pop()}
        </p>
      )}
      <LazyMount minHeight={220}>
        <VideoScrubber
          videoPath={settings.bgVideoPath}
          start={Number(settings.bgVideoStart) || 0}
          end={Number(settings.bgVideoEnd) || 0}
          onSetStart={(t) =>
            update({ bgVideoStart: t, bgStyle: "video", lastVideoSource: "video" })
          }
          onSetEnd={(t) => update({ bgVideoEnd: t, bgStyle: "video", lastVideoSource: "video" })}
          onGoLive={(t) => {
            update({
              bgStyle: "video",
              lastVideoSource: "video",
              videoSeek: t,
              videoSeekAt: Date.now(),
            });
            showToast("Video yayına verildi");
          }}
        />
      </LazyMount>
      <VideoTrimBar
        videoPath={settings.bgVideoPath}
        start={Number(settings.bgVideoStart) || 0}
        end={Number(settings.bgVideoEnd) || 0}
        onChange={(start, end) =>
          update({ bgVideoStart: start, bgVideoEnd: end, bgStyle: "video", lastVideoSource: "video" })
        }
        label="Yerel kırpma"
      />

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
          Windows ses karıştırıcısında &quot;AxBoT&quot; adıyla görünür
          (ses çalarken; Edge WebView2 diye arama).
        </p>
      </div>
    </SettingsSection>
  );
}
