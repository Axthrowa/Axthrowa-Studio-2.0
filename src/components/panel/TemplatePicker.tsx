import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutTemplate, Plus, Trash2, Undo2 } from "lucide-react";
import { FONT_STACKS } from "../../lib/textStyles";
import {
  captureTemplate,
  mergeTemplate,
  type Json,
  type ScreenTemplate,
  type TemplateScreen,
} from "../../lib/templates/fields";
import {
  TemplateSaveError,
  deleteUserTemplate,
  loadUserTemplates,
  saveUserTemplate,
  templatesFor,
} from "../../lib/templates/store";

/**
 * Giriş / Çıkış / Mola şablon seçici.
 *
 * Şablon yalnız görünümü uygular (renk, yazı tipi, yerleşim…). OBS ayarları,
 * sosyal hesaplar, logo ve medya dosyaları dokunulmaz kalır — beyaz liste
 * `lib/templates/fields.ts` içinde.
 */

type Props = {
  screen: TemplateScreen;
  settings: Json;
  /** Ayarı uygula (PanelPage `update`) */
  onApply: (patch: Json) => void;
  onToast: (msg: string) => void;
};

const UNDO_MS = 10_000;

const BG_PREVIEW: Record<string, string> = {
  dark: "linear-gradient(160deg,#0b0d12,#151922)",
  accent: "linear-gradient(160deg,#0b0d12,var(--tpl-accent))",
  mix: "linear-gradient(160deg,#141826,#0b0d12 60%,var(--tpl-accent))",
};

function Preview({ t }: { t: ScreenTemplate }) {
  const s = t.settings;
  const font = FONT_STACKS[s.textStyles?.title?.font || s.font || "system"] || FONT_STACKS.system;
  return (
    <div
      className="relative flex h-[72px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-white/[0.09] shadow-sm transition-all duration-150 group-hover:border-white/[0.22] group-hover:scale-[1.02]"
      style={
        {
          "--tpl-accent": `${s.accent || "#7c5cff"}55`,
          background: BG_PREVIEW[s.bgStyle] || BG_PREVIEW.mix,
        } as React.CSSProperties
      }
      aria-hidden
    >
      <span
        className="text-[8px] uppercase tracking-widest font-semibold"
        style={{ color: s.eyebrowColor || s.accent }}
      >
        {s.eyebrow || "etiket"}
      </span>
      <span
        className="max-w-full truncate px-1 text-[14px] font-bold leading-tight"
        style={{ color: s.textColor || "#fff", fontFamily: font }}
      >
        {s.title || "Başlık"}
      </span>
      <span
        className="mt-0.5 rounded px-1.5 text-[10px] tabular-nums font-mono"
        style={{ color: s.countdownColor || "#fff", border: `1px solid ${s.accent || "#fff"}88` }}
      >
        05:00
      </span>
    </div>
  );
}

export default function TemplatePicker({ screen, settings, onApply, onToast }: Props) {
  const [user, setUser] = useState<ScreenTemplate[]>([]);
  const [withTexts, setWithTexts] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  // Formun altındaki durum satırı: toast kaçırılabiliyor, hata burada kalıcı görünür.
  const [saveNote, setSaveNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [undo, setUndo] = useState<{ label: string; before: Json } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    void loadUserTemplates().then((l) => alive && setUser(l));
    return () => {
      alive = false;
    };
  }, []);

  // Ekran değişince eski ekranın geri-al bandı yanlış ekranı bozmasın.
  useEffect(() => {
    setUndo(null);
    setNaming(false);
    setSaveNote(null);
  }, [screen]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const list = useMemo(() => templatesFor(screen, user), [screen, user]);

  const apply = useCallback(
    (t: ScreenTemplate) => {
      const { next, changed, before } = mergeTemplate(settings, t.settings, withTexts);
      if (!changed.length) {
        onToast(`«${t.name}» zaten uygulanmış`);
        return;
      }
      onApply(next);
      setUndo({ label: t.name, before });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
      onToast(`«${t.name}» uygulandı (${changed.length} alan)`);
    },
    [settings, withTexts, onApply, onToast]
  );

  const revert = () => {
    if (!undo) return;
    onApply(undo.before);
    onToast(`«${undo.label}» geri alındı`);
    setUndo(null);
    if (timer.current) window.clearTimeout(timer.current);
  };

  const saveCurrent = async () => {
    if (saving) return;
    setSaving(true);
    setSaveNote(null);
    const t = captureTemplate(screen, name, "Kendi şablonum", settings);
    try {
      setUser(await saveUserTemplate(t));
      setNaming(false);
      setName("");
      setSaveNote({ ok: true, text: `«${t.name}» kaydedildi` });
      onToast(`«${t.name}» şablon olarak kaydedildi`);
    } catch (e) {
      // Sunucu yazamadıysa şablon yine de bu bilgisayarda duruyor: listede göster.
      if (e instanceof TemplateSaveError && e.localOk) setUser((prev) => [...prev.filter((x) => x.id !== t.id), t]);
      const why = String((e as Error)?.message || e);
      setSaveNote({ ok: false, text: `Sunucuya yazılamadı: ${why}. Şablon yalnız bu bilgisayarda duruyor.` });
      onToast("Şablon sunucuya yazılamadı");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: ScreenTemplate) => {
    try {
      setUser(await deleteUserTemplate(t.id));
      onToast(`«${t.name}» silindi`);
    } catch {
      onToast("Şablon silinemedi");
    }
  };

  return (
    <section
      className="mb-3 rounded-2xl border border-white/[0.08] bg-panel-card/70 p-3.5 shadow-panel"
      aria-label="Şablonlar"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-white">
          <LayoutTemplate className="h-4 w-4 text-panel-accent" /> Şablonlar
        </h3>
        <button
          type="button"
          className="yya-btn-ghost inline-flex h-7 items-center gap-1 px-2 text-[11px]"
          onClick={() => setNaming((v) => !v)}
        >
          <Plus className="h-3 w-3" /> Bunu kaydet
        </button>
      </div>

      <p className="mb-2 text-[11px] leading-snug text-panel-muted">
        Renk, yazı tipi ve yerleşimi tek tıkla değiştirir. Logo, video, sosyal hesaplar ve OBS
        ayarların olduğu gibi kalır.
      </p>

      <label className="mb-2 flex items-center gap-2 text-[11px] text-panel-muted">
        <input type="checkbox" checked={withTexts} onChange={(e) => setWithTexts(e.target.checked)} />
        Şablonun yazılarını da uygula (başlık, alt yazı…)
      </label>

      {naming && (
        <div className="mb-2 flex items-center gap-1.5">
          <input
            className="yya-input h-8 min-w-0 flex-1 text-xs"
            value={name}
            maxLength={40}
            placeholder="Şablon adı"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void saveCurrent()}
          />
          <button
            type="button"
            className="shrink-0 rounded bg-panel-accent/80 px-2.5 py-1.5 text-[11px] font-medium text-[#08131c]"
            disabled={saving}
            onClick={() => void saveCurrent()}
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      )}

      {saveNote && (
        <p
          role="status"
          className={
            "mb-2 rounded-md px-2 py-1.5 text-[11px] " +
            (saveNote.ok ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200")
          }
        >
          {saveNote.text}
        </p>
      )}

      {undo && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
          <span>«{undo.label}» uygulandı.</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 font-medium hover:bg-amber-500/30"
            onClick={revert}
          >
            <Undo2 className="h-3 w-3" /> Geri al
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {list.map((t) => (
          <div key={t.id} className="group relative">
            <button
              type="button"
              onClick={() => apply(t)}
              title={t.description || t.name}
              className="block w-full rounded-lg border border-white/[0.08] bg-black/20 p-1.5 text-left transition hover:border-panel-accent/60"
            >
              <Preview t={t} />
              <div className="mt-1.5 truncate text-[11px] font-medium text-white">{t.name}</div>
              <div className="truncate text-[10px] text-panel-muted">
                {t.builtin ? t.description : "Kendi şablonum"}
              </div>
            </button>
            {!t.builtin && (
              <button
                type="button"
                title="Şablonu sil"
                aria-label={`${t.name} şablonunu sil`}
                className="absolute right-2.5 top-2.5 rounded bg-red-900/70 p-1 text-red-100 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                onClick={() => void remove(t)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
