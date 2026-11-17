/** SahneAyarlari bölümleri (TEK-4: dosya bölündü, davranış aynı). */
import { API_BASE } from "../../../lib/api";
import SettingsSection from "../SettingsSection";
import TextStyleEditor from "../TextStyleEditor";
import { clearCreditsSession, creditsSessionCounts } from "../../../lib/creditsSession";
import { open } from "@tauri-apps/plugin-dialog";
import type { SahneAyarlariProps } from "./sahneOrtak";

export function BoyutlarBolumu(p: SahneAyarlariProps) {
  const { PART_LABELS, secOrder, settings, tt, update } = p;
  return (
    <SettingsSection id="boyutlar" title={tt("sec.boyutlar")} style={secOrder("boyutlar")}>
      <p className="text-ui-2 text-panel-muted">Önizlemede köşeden de ölçeklenebilir.</p>
      {(["logo", "eyebrow", "title", "sub", "countdown", "socials", "ticker", "credits", "visualizer", "nowPlaying", "lyrics"] as const).map((k) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className="w-20 text-panel-muted">{PART_LABELS[k] || k}</span>
          <input
            aria-label={PART_LABELS[k] || k}
            type="range"
            min={40}
            max={220}
            value={settings.sizes?.[k] || 100}
            onChange={(e) =>
              update({ sizes: { ...(settings.sizes || {}), [k]: Number(e.target.value) } })
            }
            className="flex-1"
          />
          <span>{settings.sizes?.[k] || 100}</span>
        </div>
      ))}
    </SettingsSection>
  );
}

export function GorunurlukBolumu(p: SahneAyarlariProps) {
  const { PART_LABELS, secOrder, settings, tt, update } = p;
  return (
    <SettingsSection id="gorunurluk" title={tt("sec.gorunurluk")} style={secOrder("gorunurluk")}>
      <p className="text-ui-2 text-panel-muted">Overlay öğelerini göster / gizle.</p>
      {(["logo", "eyebrow", "title", "sub", "countdown", "socials", "ticker", "credits"] as const).map((k) => (
        <label key={k} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.visible?.[k] !== false}
            onChange={(e) =>
              update({ visible: { ...(settings.visible || {}), [k]: e.target.checked } })
            }
          />
          {PART_LABELS[k] || k}
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.nowPlayingEnabled !== false && settings.visible?.nowPlaying !== false}
          onChange={(e) =>
            update({
              nowPlayingEnabled: e.target.checked,
              visible: { ...(settings.visible || {}), nowPlaying: e.target.checked },
            })
          }
        />
        Şimdi Çalıyor widget’ı
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.lyricsEnabled === true && settings.visible?.lyrics !== false}
          onChange={(e) =>
            update({
              lyricsEnabled: e.target.checked,
              visible: { ...(settings.visible || {}), lyrics: true },
            })
          }
        />
        Şarkı sözleri widget’ı
      </label>
      {settings.nowPlayingEnabled !== false && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.nowPlayingTheme !== false}
              onChange={(e) => update({ nowPlayingTheme: e.target.checked })}
            />
            Resonance temasını kullan
          </label>
          <p className="text-ui-2 text-panel-muted">
            Açıkken Müzik sekmesinde seçtiğin tema/skin bu ekranda da aynen görünür.
            Kapatırsan sade yerleşik kart kullanılır.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.nowPlayingOnlyWhilePlaying !== false}
              onChange={(e) => update({ nowPlayingOnlyWhilePlaying: e.target.checked })}
            />
            Yalnızca müzik çalarken göster
          </label>
          {settings.nowPlayingTheme !== false && (
            <p className="text-ui-2 text-panel-muted">
              Kart boyutu temaya göre kendiliğinden ayarlanır. Büyütmek/küçültmek
              için önizlemede karta tıklayıp boyut tutamacını kullan.
            </p>
          )}
        </>
      )}
    </SettingsSection>
  );
}

export function ParcacikBolumu(p: SahneAyarlariProps) {
  const { particleFiles, particleKeys, refreshParticles, secOrder, setParticleFiles, settings, showToast, tt, update } = p;
  return (
    <SettingsSection id="parcacik" title={tt("sec.parcacik")} style={secOrder("parcacik")}>
      <p className="text-ui-2 font-medium text-panel-muted">Parçacıklar</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.particles !== false}
          onChange={(e) => update({ particles: e.target.checked })}
        />
        Parçacık animasyonu
      </label>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-20 text-panel-muted">Yoğunluk</span>
        <input aria-label="Yoğunluk"
          type="range"
          min={20}
          max={200}
          value={settings.particleDensity ?? 100}
          onChange={(e) => update({ particleDensity: Number(e.target.value) })}
          className="flex-1"
        />
        <span>{settings.particleDensity ?? 100}%</span>
      </div>
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-md bg-black/40 px-2 py-2 text-xs"
          onClick={async () => {
            try {
              const selected = await open({
                multiple: false,
                filters: [{ name: "Parçacık", extensions: ["png", "webp"] }],
              });
              if (typeof selected !== "string") return;
              const res = await fetch(`${API_BASE}/media/file?path=${encodeURIComponent(selected)}`);
              const blob = await res.blob();
              const buf = await blob.arrayBuffer();
              const name = selected.split(/[/\\]/).pop() || "particle.png";
              const up = await fetch(`${API_BASE}/api/particles`, {
                method: "POST",
                headers: {
                  "Content-Type": blob.type || "image/png",
                  "X-Filename": name,
                },
                body: buf,
              });
              const data = await up.json();
              setParticleFiles(data.files || []);
              const key = name.replace(/\.(png|webp)$/i, "");
              update({
                particleTypes: { ...(settings.particleTypes || {}), [key]: true },
                particles: true,
              });
              showToast("Parçacık eklendi");
            } catch {
              showToast("Parçacık eklenemedi");
            }
          }}
        >
          + Parçacık ekle
        </button>
        <button className="rounded-md bg-black/40 px-2 py-2 text-xs" onClick={refreshParticles}>
          Yenile
        </button>
      </div>
      {particleKeys.length === 0 && (
        <p className="text-ui-2 text-panel-muted">Henüz parçacık yok — PNG/WEBP ekle</p>
      )}
      {particleKeys.map((key) => {
        const file = particleFiles.find((f) => f.replace(/\.(png|webp)$/i, "") === key) || `${key}.png`;
        return (
          <div key={key} className="space-y-1 rounded border border-panel-border/60 p-2">
            <div className="flex items-center gap-2">
              <img
                src={`${API_BASE}/assets/particles/${file}`}
                alt=""
                className="h-8 w-8 object-contain"
              />
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.particleTypes?.[key] !== false}
                  onChange={(e) =>
                    update({
                      particleTypes: { ...(settings.particleTypes || {}), [key]: e.target.checked },
                    })
                  }
                />
                {key}
              </label>
              <button
                className="rounded bg-red-800/70 px-2 py-1 text-ui-2"
                onClick={async () => {
                  if (!confirm(`${file} silinsin mi?`)) return;
                  const res = await fetch(`${API_BASE}/api/particles/delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: file }),
                  });
                  const data = await res.json();
                  setParticleFiles(data.files || []);
                  const nextTypes = { ...(settings.particleTypes || {}) };
                  delete nextTypes[key];
                  update({ particleTypes: nextTypes });
                  showToast("Parçacık silindi");
                }}
              >
                Sil
              </button>
            </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-panel-muted">Boyut</span>
                <input aria-label="Boyut"
                  type="range"
                  min={50}
                  max={400}
                  value={settings.particleSizes?.[key] || 100}
                  onChange={(e) =>
                    update({
                      particleSizes: { ...(settings.particleSizes || {}), [key]: Number(e.target.value) },
                    })
                  }
                  className="flex-1"
                />
                <span>{settings.particleSizes?.[key] || 100}%</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-panel-muted">Vurgu</span>
                <input aria-label="Vurgu"
                  type="color"
                  value={settings.particleColors?.[key] || settings.accent || "#7c5cff"}
                  onChange={(e) =>
                    update({
                      particleColors: { ...(settings.particleColors || {}), [key]: e.target.value },
                    })
                  }
                  className="h-7 w-10 cursor-pointer rounded border border-panel-border bg-transparent"
                />
                <label className="ml-auto flex items-center gap-1.5 text-ui-2">
                  <input
                    type="checkbox"
                    checked={settings.particleGlow?.[key] !== false}
                    onChange={(e) =>
                      update({
                        particleGlow: { ...(settings.particleGlow || {}), [key]: e.target.checked },
                      })
                    }
                  />
                  Glow
                </label>
              </div>
          </div>
        );
      })}
    </SettingsSection>
  );
}

export function JenerikBolumu(p: SahneAyarlariProps) {
  const { creditCounts, secOrder, setCreditCounts, settings, showToast, tt, update } = p;
  return (
    <SettingsSection id="jenerik" title={tt("sec.jenerik")} style={secOrder("jenerik")}>
      <TextStyleEditor settings={settings} onChange={update} includeCredits sadece={["credits"]} />
      <h3 className="text-sm font-semibold">Otomatik jenerik</h3>
      <p className="text-ui-2 text-panel-muted">
        Panel açıkken Twitch/Kick/YouTube abone, bağış (Super Chat / bits) ve
        takip/raid olayları jeneriğe yazılır. Bölüm başlıkları: Destekçiler, Yeni
        Aboneler, Yeni Takipçiler.
      </p>
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.creditsAuto !== false}
          onChange={(e) => update({ creditsAuto: e.target.checked })}
        />
        Abone / takip / bağış otomatik ekle
      </label>
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={settings.creditsOnlyLive !== false}
          onChange={(e) => update({ creditsOnlyLive: e.target.checked })}
        />
        Yalnız bu yayında gelenleri göster (hiçbiri yoksa jenerik açılmaz)
      </label>
      <div className="rounded-md border border-panel-border/60 bg-black/20 px-2 py-2 text-ui-2 text-panel-muted">
        Bu oturum:{" "}
        <span className="text-white/80">{creditCounts.donors}</span> destek ·{" "}
        <span className="text-white/80">{creditCounts.subscribers}</span> abone ·{" "}
        <span className="text-white/80">{creditCounts.followers}</span> takip/raid
      </div>
      <button
        type="button"
        className="w-full rounded-md bg-black/40 px-3 py-2 text-sm"
        onClick={() => {
          clearCreditsSession();
          setCreditCounts(creditsSessionCounts());
          showToast("Otomatik jenerik listesi temizlendi");
        }}
      >
        Oturum listesini temizle
      </button>
      <p className="text-ui-2 text-panel-muted">
        Manuel satırlar ve stiller yukarıdaki &quot;Jenerik bölümleri&quot;nden
        düzenlenir.
      </p>
    </SettingsSection>
  );
}
