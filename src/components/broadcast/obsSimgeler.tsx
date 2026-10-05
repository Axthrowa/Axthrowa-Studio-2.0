/**
 * OBS Studio "Dark" simge seti (GPL-2.0, bkz. src/assets/obs/OKUBENI.txt) — Yayın çalışma alanının OBS ile birebir
 * görünmesi için. Bileşen adları lucide-react ile aynıdır: dock dosyalarında yalnız içe aktarma kaynağı değişir.
 * OBS'te karşılığı olmayan simgeler lucide'den olduğu gibi yeniden dışa aktarılır.
 */
import type React from "react";
import type { CSSProperties } from "react";

const DOSYALAR = import.meta.glob("../../assets/obs/**/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

function adres(ad: string): string {
  return DOSYALAR[`../../assets/obs/${ad}.svg`] ?? "";
}

type SimgeOzellik = { className?: string; size?: number | string; style?: CSSProperties; "aria-hidden"?: boolean | "true" | "false"; strokeWidth?: number };

/** OBS SVG'sini çizer; `bos` ise aynı boyutta boş alan (OBS'te gizli/kilitsiz durumun simgesi yoktur) */
function obsSimgesi(ad: string | null) {
  const Simge = ({ className, size, style }: SimgeOzellik) => {
    const boyut = size ?? (className && /\b[hw]-/.test(className) ? undefined : 16);
    if (!ad) return <span aria-hidden className={className} style={{ display: "inline-block", width: boyut, height: boyut, ...style }} />;
    return (
      <img
        src={adres(ad)}
        alt=""
        aria-hidden
        draggable={false}
        className={className}
        width={boyut}
        height={boyut}
        style={{ display: "inline-block", ...style }}
      />
    );
  };
  Simge.displayName = `ObsSimge(${ad ?? "bos"})`;
  return Simge;
}

export type ObsSimgeBileseni = ReturnType<typeof obsSimgesi>;
/** Dock simgesi: OBS SVG bileşeni ya da lucide simgesi */
export type Simge = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

export const Plus = obsSimgesi("plus");
export const Minus = obsSimgesi("minus");
export const ChevronUp = obsSimgesi("up");
export const ChevronDown = obsSimgesi("down");
export const ChevronRight = obsSimgesi("right");
export const ChevronLeft = obsSimgesi("left");
export const Settings = obsSimgesi("settings/general");
export const Settings2 = obsSimgesi("settings/general");
export const Cogs = obsSimgesi("cogs");
export const DotsVert = obsSimgesi("dots-vert");
export const Eye = obsSimgesi("visible");
export const EyeOff = obsSimgesi(null);
export const Lock = obsSimgesi("locked");
export const LockOpen = obsSimgesi(null);
export const Filter = obsSimgesi("filter");
export const AlertTriangle = obsSimgesi("alert");
export const Trash2 = obsSimgesi("trash");
export const Volume2 = obsSimgesi("settings/audio");
export const VolumeX = obsSimgesi("mute");
export const Headphones = obsSimgesi("headphones");
export const HeadphoneOff = obsSimgesi("headphones-off");
export const Play = obsSimgesi("media/media_play");
export const Pause = obsSimgesi("media/media_pause");
export const Square = obsSimgesi("media/media_stop");
export const RotateCcw = obsSimgesi("media/media_restart");
export const SkipForward = obsSimgesi("media/media_next");
export const SkipBack = obsSimgesi("media/media_previous");
export const Columns3 = obsSimgesi("layout-vertical");
export const Rows3 = obsSimgesi("layout-horizontal");
export const Save = obsSimgesi("save");
export const ExternalLink = obsSimgesi("popout");
export const X = obsSimgesi("close");
export const RefreshCw = obsSimgesi("refresh");
export const MousePointer = obsSimgesi("interact");
// Kaynak türleri (OBS kaynak listesi simgeleri)
export const AppWindow = obsSimgesi("sources/window");
export const Camera = obsSimgesi("sources/camera");
export const Film = obsSimgesi("sources/media");
export const Clapperboard = obsSimgesi("sources/media");
export const Gamepad2 = obsSimgesi("sources/gamepad");
export const Globe = obsSimgesi("sources/globe");
export const Image = obsSimgesi("sources/image");
export const Images = obsSimgesi("sources/slideshow");
export const Mic = obsSimgesi("sources/microphone");
export const Monitor = obsSimgesi("sources/default");
export const Palette = obsSimgesi("sources/brush");
export const Type = obsSimgesi("sources/text");
export const Box = obsSimgesi("sources/default");
export const Puzzle = obsSimgesi("sources/default");
export const Folder = obsSimgesi("sources/group");
export const Layers = obsSimgesi("sources/scene");
export const AudioLines = obsSimgesi("sources/windowaudio");

// OBS'te karşılığı olmayanlar
export { ArrowRightLeft, Circle, MonitorPlay, Radio, Scissors, Video, type LucideIcon } from "lucide-react";
