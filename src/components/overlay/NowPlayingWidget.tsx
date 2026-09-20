import { NowPlaying } from "../../lib/api";
import { formatClock } from "../../lib/youtube";

type Props = {
  track: NowPlaying | null;
  /** ms — yoklamalar arasında yürütülmüş ilerleme */
  progress: number;
  accent?: string;
  /** Panelde konumlandırabilmek için boşken de bir yer tutucu göster */
  placeholder?: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  spotify: "Spotify",
  "youtube-music": "YouTube Music",
};

/** Giriş / Mola / Çıkış ekranlarındaki “Şimdi Çalıyor” kartı. */
export default function NowPlayingWidget({ track, progress, accent, placeholder }: Props) {
  if (!track && !placeholder) return null;

  const title = track?.title || "Şu an bir şey çalmıyor";
  const artist = track?.artist || "Müzik kaynağı bekleniyor";
  const duration = track?.duration || 0;
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0;
  const color = accent || "var(--accent, #22d3b8)";

  return (
    <div className="np-widget" style={{ ["--np-accent" as string]: color }}>
      <div className={`np-cover ${track?.isPlaying ? "is-playing" : ""}`}>
        {track?.albumArt ? <img src={track.albumArt} alt="" /> : <span className="np-note">♪</span>}
      </div>
      <div className="np-body">
        <span className="np-kicker">
          <i className={`np-pulse ${track?.isPlaying ? "on" : ""}`} />
          {SOURCE_LABEL[track?.source || ""] || "Şimdi Çalıyor"}
        </span>
        <span className="np-title">{title}</span>
        <span className="np-artist">{artist}</span>
        <div className="np-bar">
          <div className="np-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        {/* Süre bilinmiyorsa sayı basmıyoruz; "0:00 / 0:00" bilgi değil. */}
        {duration > 0 && (
          <div className="np-times">
            <span>{formatClock(progress / 1000)}</span>
            <span>{formatClock(duration / 1000)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
