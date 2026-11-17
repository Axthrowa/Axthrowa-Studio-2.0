/** PanelPage'den ayrıldı (TEK-4, davranış aynı): gizli parçalar, medya listeleri ve YouTube indirme. */
import { useCallback, useMemo } from "react";
import { API_BASE, OverlaySettings, overlayUrl, ScreenId, okJson } from "../../lib/api";
import { useVideoDownload } from "../../lib/useVideoDownload";
import { PART_KEYS } from "./PanelPage";

export type UsePanelMedyaGirdisi = {
  screen: ScreenId;
  server: any;
  setBgFiles: React.Dispatch<React.SetStateAction<string[]>>;
  setLogoFiles: React.Dispatch<React.SetStateAction<string[]>>;
  setMusicFiles: React.Dispatch<React.SetStateAction<string[]>>;
  setParticleFiles: React.Dispatch<React.SetStateAction<string[]>>;
  setVideoFiles: React.Dispatch<React.SetStateAction<string[]>>;
  settings: OverlaySettings;
  showToast: (m: string) => undefined;
  update: (patch: OverlaySettings) => void;
};

export function usePanelMedya({ screen, server, setBgFiles, setLogoFiles, setMusicFiles, setParticleFiles, setVideoFiles, settings, showToast, update }: UsePanelMedyaGirdisi) {

  // Önizlemede kapatılan parçalar. Kullanıcı bir şeyi gizleyince kenar
  // çubuğundaki onay kutusunu aramak zorunda kalmasın diye önizlemenin altında
  // tek tıkla geri getirilebilir duruyorlar.
  const hiddenParts = useMemo(
    () =>
      PART_KEYS.filter((k) =>
        k === "nowPlaying"
          ? settings.nowPlayingEnabled === false || settings.visible?.nowPlaying === false
          : settings.visible?.[k] === false
      ),
    [settings.visible, settings.nowPlayingEnabled]
  );

  const restorePart = useCallback(
    (key: string) => {
      const patch: OverlaySettings = {
        visible: { ...(settings.visible || {}), [key]: true },
      };
      if (key === "nowPlaying") patch.nowPlayingEnabled = true;
      update(patch);
    },
    [settings.visible, update]
  );

  const restoreAllParts = useCallback(() => {
    const visible = { ...(settings.visible || {}) };
    for (const k of PART_KEYS) visible[k] = true;
    update({ visible, nowPlayingEnabled: true });
  }, [settings.visible, update]);

  const obsUrl = useMemo(() => {
    const base = server?.baseUrl || API_BASE;
    return overlayUrl(base, screen === "chat" ? "chat" : screen);
  }, [screen, server]);

  const refreshParticles = useCallback(() => {
    fetch(`${API_BASE}/api/particles`)
      .then(okJson)
      .then((list) => setParticleFiles(Array.isArray(list) ? list : []))
      .catch(() => setParticleFiles([]));
  }, []);

  const refreshMusic = useCallback(() => {
    fetch(`${API_BASE}/api/music`)
      .then(okJson)
      .then((list) => setMusicFiles(Array.isArray(list) ? list : []))
      .catch(() => setMusicFiles([]));
  }, []);

  const refreshLogos = useCallback(() => {
    fetch(`${API_BASE}/api/logos`)
      .then(okJson)
      .then((list) => setLogoFiles(Array.isArray(list) ? list : []))
      .catch(() => setLogoFiles([]));
  }, []);

  const refreshVideos = useCallback(() => {
    fetch(`${API_BASE}/api/videos`)
      .then(okJson)
      .then((list) => setVideoFiles(Array.isArray(list) ? list : []))
      .catch(() => setVideoFiles([]));
  }, []);

  // YouTube arka planını yerele indirme. Biten dosyaya kendiliğinden geçiyoruz:
  // indirmenin tek amacı zaten oynatıcı arayüzünden kurtulmak.
  const indirmeBitti = useCallback(
    (dosya: string) => {
      refreshVideos();
      update({
        bgVideoPath: dosya,
        bgVideoStart: 0,
        bgVideoEnd: 0,
        bgStyle: "video",
        lastVideoSource: "video",
        youtubeUrl: "",
      });
      showToast("Video yerele indirildi — artık yerel dosyadan oynuyor");
    },
    [refreshVideos, update, showToast]
  );
  const indirme = useVideoDownload(indirmeBitti);
  const indirmeSuruyor =
    indirme.durum.phase === "araclar" ||
    indirme.durum.phase === "indiriliyor" ||
    indirme.durum.phase === "birlestiriliyor";
  const indirmeMetni =
    indirme.durum.phase === "araclar"
      ? indirme.durum.message || "İndirme aracı hazırlanıyor…"
      : indirme.durum.phase === "birlestiriliyor"
        ? "Görüntü ve ses birleştiriliyor…"
        : `%${Math.round(Math.max(0, indirme.durum.percent))}${
            indirme.durum.message ? ` — ${indirme.durum.message}` : ""
          }`;

  const refreshBackgrounds = useCallback(() => {
    fetch(`${API_BASE}/api/backgrounds`)
      .then(okJson)
      .then((list) => setBgFiles(Array.isArray(list) ? list : []))
      .catch(() => setBgFiles([]));
  }, []);
  return { hiddenParts, indirme, indirmeMetni, indirmeSuruyor, obsUrl, refreshBackgrounds, refreshLogos, refreshMusic, refreshParticles, refreshVideos, restoreAllParts, restorePart };
}
