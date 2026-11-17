/** PanelPage'den ayrıldı (TEK-4, davranış aynı): logo, video, arka plan seçimi, Kick sohbet odası ve sahne geçişi. */
import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { API_BASE, importLibraryFile, OverlaySettings, ScreenId } from "../../lib/api";
import { type NavId } from "../../lib/panelLayout";
import { switchScene } from "../../lib/obs";
import { seedStartingCountdown } from "../../lib/streamAutomation";
import type { ObsConnection } from "../../lib/obs";

export type UsePanelDosyalarGirdisi = {
  endingStopDoneRef: React.RefObject<boolean>;
  forceNavRef: React.RefObject<NavId | null>;
  obsConnect: (cfg?: Partial<ObsConnection> | undefined) => Promise<void>;
  obsConnected: boolean;
  refreshBackgrounds: () => void;
  refreshLogos: () => void;
  refreshVideos: () => void;
  setActiveNav: React.Dispatch<React.SetStateAction<NavId | ScreenId>>;
  setObsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setScreen: React.Dispatch<React.SetStateAction<ScreenId>>;
  settingsRef: React.RefObject<OverlaySettings>;
  showToast: (m: string) => undefined;
  startingSwitchDoneRef: React.RefObject<boolean>;
  streamWatchArmedRef: React.RefObject<boolean>;
  update: (patch: OverlaySettings) => void;
};

export function usePanelDosyalar({ endingStopDoneRef, forceNavRef, obsConnect, obsConnected, refreshBackgrounds, refreshLogos, refreshVideos, setActiveNav, setObsConnected, setScreen, settingsRef, showToast, startingSwitchDoneRef, streamWatchArmedRef, update }: UsePanelDosyalarGirdisi) {

  const pickLogo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Görsel", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
      });
      if (typeof selected !== "string") return;
      const data = await importLibraryFile("logos", selected);
      if (data?.name) {
        // Dosya olarak kaydet — data URL JSON'u şişirmesin / kaybolmasın
        update({ logoFile: data.name, logo: null, logoPath: null });
        refreshLogos();
        showToast("Logo kaydedildi");
      }
    } catch {
      showToast("Logo seçilemedi");
    }
  };

  /** Kick chatroom kimliğini çeker; Tauri komutu yoksa HTTP API'ye düşer. */
  const fetchKickChatroom = useCallback(async () => {
    const slug = (settingsRef.current.kickSlug || "").trim();
    if (!slug) {
      showToast("Önce Kick kullanıcı adını gir");
      return;
    }
    try {
      const data = await invoke<any>("fetch_kick_chatroom", { slug });
      if (!data?.chatroomId) throw new Error("chatroom yok");
      update({ chatroomId: data.chatroomId });
      showToast("Kick chatroom alındı");
      return;
    } catch {
      /* Tauri dışı (tarayıcı) ortamda HTTP'ye düş */
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/kick/chatroom?slug=${encodeURIComponent(slug)}`
      );
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data = await res.json();
      if (!data?.chatroomId) throw new Error("chatroom yok");
      update({ chatroomId: data.chatroomId });
      showToast("Kick chatroom alındı");
    } catch (e) {
      showToast(`Kick bulunamadı: ${String((e as Error).message).slice(0, 60)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);

  const pickLocalVideo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Video", extensions: ["mp4", "webm", "mov", "mkv", "m4v"] }],
      });
      if (typeof selected !== "string") return;
      const data = await importLibraryFile("videos", selected);
      if (data?.name) {
        update({
          bgVideoPath: data.name,
          bgVideoStart: 0,
          bgVideoEnd: 0,
          bgStyle: "video",
          lastVideoSource: "video",
        });
        refreshVideos();
        showToast("Video uygulama deposuna kopyalandı");
      }
    } catch {
      showToast("Video eklenemedi");
    }
  };

  const pickBackground = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Görsel / GIF", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
      });
      if (typeof selected !== "string") return;
      const data = await importLibraryFile("backgrounds", selected);
      if (data?.name) {
        update({ bgImagePath: data.name, bgImage: null, bgStyle: "image" });
        refreshBackgrounds();
        showToast("Arka plan (hareketli resim) kaydedildi");
      }
    } catch {
      showToast("Arka plan eklenemedi");
    }
  };

  const goScene = useCallback(
    async (sceneName: string, label?: string, navHint?: NavId) => {
      if (!sceneName) {
        showToast((label || "Sahne") + " atanmamış");
        return;
      }
      if (navHint === "starting" || navHint === "ending" || navHint === "brb" || navHint === "chat") {
        forceNavRef.current = navHint;
        setActiveNav(navHint);
        setScreen(navHint);
        if (navHint === "ending") {
          endingStopDoneRef.current = false;
          streamWatchArmedRef.current = true;
        }
        if (navHint === "starting") {
          startingSwitchDoneRef.current = false;
          seedStartingCountdown(5);
        }
      } else if (label) {
        const low = label.toLowerCase();
        if (low.includes("çıkış") || low.includes("ending") || low === "end") {
          endingStopDoneRef.current = false;
          streamWatchArmedRef.current = true;
          forceNavRef.current = "ending";
          setActiveNav("ending");
          setScreen("ending");
        }
      }
      try {
        if (!obsConnected) {
          await obsConnect({
            host: settingsRef.current.obs?.host || "127.0.0.1",
            port: Number(settingsRef.current.obs?.port) || 4455,
            password: settingsRef.current.obs?.password || "",
          });
          setObsConnected(true);
        }
        await switchScene({
          sceneName,
          transition: settingsRef.current.obs?.transition,
          transitionMs: settingsRef.current.obs?.transitionMs,
        });
        showToast((label || sceneName) + " → geçildi");
      } catch (e: any) {
        showToast("Sahne hatası: " + (e?.message || e));
      }
    },
    [obsConnected, obsConnect, showToast]
  );
  return { fetchKickChatroom, goScene, pickBackground, pickLocalVideo, pickLogo };
}
