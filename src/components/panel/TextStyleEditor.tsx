import type { ReactNode } from "react";
import {
  ANIM_OPTIONS,
  EFFECT_OPTIONS,
  FONT_OPTIONS,
  TEXT_STYLE_KEYS,
  TEXT_STYLE_LABELS,
  TextStyle,
  TextStyleKey,
} from "../../lib/textStyles";
import { OverlaySettings } from "../../lib/api";
import { CreditSection, sectionsFromSettings } from "../overlay/CreditsRoller";

type Props = {
  settings: OverlaySettings;
  onChange: (patch: OverlaySettings) => void;
  includeCredits?: boolean;
};

function StyleRow({
  label,
  st,
  defaultFont,
  onPatch,
  extra,
}: {
  label: string;
  st: TextStyle;
  defaultFont?: string;
  onPatch: (partial: TextStyle) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-panel-border/80 bg-black/25 p-2.5">
      <div className="text-xs font-medium text-panel-muted">{label}</div>
      {extra}
      <div className="grid grid-cols-2 gap-1.5">
        <label className="block text-[10px] text-panel-muted">
          Font
          <select
            className="mt-0.5 w-full rounded-md border border-panel-border bg-[#1c2030] text-white px-1.5 py-1.5 text-xs"
            value={st.font || defaultFont || "system"}
            onChange={(e) => onPatch({ font: e.target.value })}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] text-panel-muted">
          Efekt
          <select
            className="mt-0.5 w-full rounded-md border border-panel-border bg-[#1c2030] text-white px-1.5 py-1.5 text-xs"
            value={st.effect || "none"}
            onChange={(e) => onPatch({ effect: e.target.value })}
          >
            {EFFECT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block text-[10px] text-panel-muted">
          Animasyon
          <select
            className="mt-0.5 w-full rounded-md border border-panel-border bg-[#1c2030] text-white px-1.5 py-1.5 text-xs"
            value={st.anim || "none"}
            onChange={(e) => onPatch({ anim: e.target.value })}
          >
            {ANIM_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] text-panel-muted">
          Yazı rengi
          <input
            type="color"
            className="mt-0.5 h-8 w-full cursor-pointer rounded-md border border-panel-border bg-[#1c2030] text-white"
            value={st.color || "#ffffff"}
            onChange={(e) => onPatch({ color: e.target.value })}
          />
        </label>
        <label className="block text-[10px] text-panel-muted">
          Vurgu rengi
          <input
            type="color"
            className="mt-0.5 h-8 w-full cursor-pointer rounded-md border border-panel-border bg-[#1c2030] text-white"
            value={st.accentColor || "#7c5cff"}
            onChange={(e) => onPatch({ accentColor: e.target.value })}
          />
        </label>
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-panel-muted">Boyut</span>
        <input
          type="range"
          min={40}
          max={280}
          value={st.size ?? 100}
          onChange={(e) => onPatch({ size: Number(e.target.value) })}
          className="flex-1"
        />
        <span className="w-10 text-right">{st.size ?? 100}%</span>
      </div>
    </div>
  );
}

export default function TextStyleEditor({ settings, onChange, includeCredits }: Props) {
  const styles = (settings.textStyles || {}) as Record<string, TextStyle>;
  const keys = TEXT_STYLE_KEYS.filter(
    (k) => k !== "countdown" && (k === "credits" ? includeCredits : true)
  );

  const patchKey = (key: TextStyleKey, partial: TextStyle) => {
    const next = {
      ...styles,
      [key]: { ...(styles[key] || {}), ...partial },
    };
    const patch: OverlaySettings = { textStyles: next };
    if (key === "credits" && partial.size != null) {
      patch.creditsSize = partial.size;
    }
    onChange(patch);
  };

  const sections: CreditSection[] = includeCredits ? sectionsFromSettings(settings) : [];

  const patchSection = (index: number, partial: Partial<CreditSection>) => {
    const next = sections.map((s, i) => (i === index ? { ...s, ...partial } : s));
    onChange({
      creditsSections: next,
      credits: next.flatMap((s) => [s.title ? `# ${s.title}` : "", ...(s.lines || []), ""]),
      creditsEnabled: true,
    });
  };

  const patchSectionStyle = (
    index: number,
    which: "titleStyle" | "bodyStyle",
    partial: TextStyle
  ) => {
    const sec = sections[index] || { title: "", lines: [] };
    patchSection(index, {
      [which]: { ...(sec[which] || {}), ...partial },
    });
  };

  const cdSt = styles.countdown || {};
  const cdSize = cdSt.size ?? 100;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Yazı stilleri</h3>
      <p className="text-[11px] text-panel-muted">Her yazı ayrı: font, boyut, efekt ve animasyon</p>

      <StyleRow
        label="Geri sayım / rozet"
        st={{ ...cdSt, size: cdSize }}
        defaultFont={settings.font}
        onPatch={(p) => patchKey("countdown", p)}
        extra={
          <label className="mb-1 block text-[10px] text-panel-muted">
            Görünüm
            <select
              className="mt-0.5 w-full rounded-md border border-panel-border bg-[#1c2030] text-white px-1.5 py-1.5 text-xs"
              value={settings.countdownStyle === "minimal" ? "minimal" : "boxes"}
              onChange={(e) => onChange({ countdownStyle: e.target.value })}
            >
              <option value="boxes">Kutulu</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>
        }
      />

      {keys.map((key) => {
        const st = styles[key] || {};
        const size =
          st.size ?? (key === "credits" ? settings.creditsSize : undefined) ?? 100;
        return (
          <div key={key}>
            <StyleRow
              label={TEXT_STYLE_LABELS[key]}
              st={{ ...st, size }}
              defaultFont={settings.font}
              onPatch={(p) => patchKey(key, p)}
            />
            {key === "ticker" && (
              <div className="mt-1.5 space-y-1.5 px-1 text-[10px]">
                <div className="flex items-center gap-2">
                  <span className="text-panel-muted">Akış hızı</span>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={Math.min(20, Number(settings.tickerSpeed) >= 25 ? 12 : settings.tickerSpeed ?? 12)}
                    onChange={(e) => onChange({ tickerSpeed: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="w-14 text-right">
                    {Math.min(20, Number(settings.tickerSpeed) >= 25 ? 12 : settings.tickerSpeed ?? 12)}/20
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-28 text-panel-muted">Kayma alanı %</span>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    value={settings.tickerWidth ?? 92}
                    onChange={(e) => onChange({ tickerWidth: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="w-10 text-right">{settings.tickerWidth ?? 92}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-28 text-panel-muted">Kenar fade</span>
                  <input
                    type="range"
                    min={0}
                    max={35}
                    value={settings.tickerFade ?? 12}
                    onChange={(e) => onChange({ tickerFade: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="w-10 text-right">{settings.tickerFade ?? 12}%</span>
                </div>
                <p className="text-panel-muted">
                  Önizlemede köşe tutamacı da alan genişliğini ayarlar · fade ile kaybolarak girer/çıkar
                </p>
              </div>
            )}
          </div>
        );
      })}

      {includeCredits && (
        <div className="space-y-2 border-t border-panel-border pt-3">
          <h3 className="text-sm font-semibold">Jenerik bölümleri</h3>
          <p className="text-[11px] text-panel-muted">
            Her bölüm (Destekçiler, Yeni Takipçiler…) kendi efekt / animasyonuna sahip
          </p>
          {sections.map((sec, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-panel-border bg-black/30 p-2.5">
              <FieldInline
                label="Bölüm başlığı"
                value={sec.title || ""}
                onChange={(v) => patchSection(i, { title: v })}
              />
              <label className="block text-[10px] text-panel-muted">
                Satırlar (her satır bir isim)
                <textarea
                  className="mt-0.5 h-20 w-full rounded-md border border-panel-border bg-[#1c2030] text-white px-2 py-1.5 text-xs"
                  value={(sec.lines || []).join("\n")}
                  onChange={(e) =>
                    patchSection(i, {
                      lines: e.target.value.split("\n"),
                    })
                  }
                />
              </label>
              <StyleRow
                label="Başlık stili"
                st={sec.titleStyle || {}}
                defaultFont={settings.font}
                onPatch={(p) => patchSectionStyle(i, "titleStyle", p)}
              />
              <StyleRow
                label="Satır stili"
                st={sec.bodyStyle || {}}
                defaultFont={settings.font}
                onPatch={(p) => patchSectionStyle(i, "bodyStyle", p)}
              />
              <button
                type="button"
                className="text-[11px] text-red-300"
                onClick={() => {
                  const next = sections.filter((_, j) => j !== i);
                  onChange({
                    creditsSections: next,
                    credits: next.flatMap((s) => [s.title ? `# ${s.title}` : "", ...(s.lines || []), ""]),
                  });
                }}
              >
                Bölümü sil
              </button>
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded-md bg-[#1c2030] text-white px-2 py-2 text-xs"
            onClick={() => {
              const next = [...sections, { title: "Yeni Bölüm", lines: [] }];
              onChange({
                creditsSections: next,
                creditsEnabled: true,
                credits: next.flatMap((s) => [s.title ? `# ${s.title}` : "", ...(s.lines || []), ""]),
              });
            }}
          >
            + Bölüm ekle
          </button>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-panel-muted">Jenerik hızı (sn)</span>
            <input
              type="range"
              min={10}
              max={120}
              value={settings.creditsSpeed ?? 40}
              onChange={(e) => onChange({ creditsSpeed: Number(e.target.value) })}
              className="flex-1"
            />
            <span>{settings.creditsSpeed ?? 40}s</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-panel-muted">Bitince bekle (sn)</span>
            <input
              type="range"
              min={1}
              max={15}
              value={settings.creditsGap ?? 3}
              onChange={(e) => onChange({ creditsGap: Number(e.target.value) })}
              className="flex-1"
            />
            <span>{settings.creditsGap ?? 3}s</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldInline({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-[10px] text-panel-muted">
      {label}
      <input
        className="mt-0.5 w-full rounded-md border border-panel-border bg-[#1c2030] text-white px-2 py-1.5 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
