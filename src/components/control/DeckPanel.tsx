/**
 * Kontrol destesi — Stream Deck benzeri yazılım düğme ızgarası.
 *
 * Her düğme eylem kayıt defterindeki bir eylemi çağırır (`/api/actions/run`): izin, onay ve denetim günlüğü
 * sunucuda uygulanır; burada yalnız görünüm ve yapılandırma var. Onay isteyen eylemler (yayın durdurma vb.)
 * çift dokunuşla çalışır. Yapılandırma `settings-panel.json` içinde `controlDeck` altında saklanır.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { Copy, Keyboard, Palette, PencilSimple, Trash } from "@phosphor-icons/react";
import { nesneMenusu, type MenuOgesi } from "../axthrowa/SagTikMenusu";
import { DESTE_OLAYI, destedenKisayol, KISAYOL_YOK, kisayolAta } from "../../lib/nesneMenusu";
import { API_BASE, fetchSettings } from "../../lib/api";
import { actionsApi, CATEGORY_LABEL, PARAM_LABEL, type ActionInfo, type ActionParamKind } from "../../lib/api/actions";
import { multistreamApi } from "../../lib/api/multistream";
import { obsControl } from "../../lib/obsControl";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import {
  addButton,
  addPage,
  addToFirstFree,
  duplicateButton,
  nextColor,
  updateButton,
  DECK_COLORS,
  DECK_MAX_BUTTONS,
  DECK_MAX_PAGES,
  defaultDeck,
  moveButton,
  parseDeck,
  removeButton,
  removePage,
  type DeckButton,
  type DeckColor,
  type DeckConfig,
} from "../../lib/deck";

const RENK: Record<DeckColor, string> = {
  slate: "border-white/15 bg-white/[0.06]",
  sky: "border-sky-400/40 bg-sky-500/15",
  emerald: "border-emerald-400/40 bg-emerald-500/15",
  amber: "border-amber-400/40 bg-amber-500/15",
  rose: "border-rose-400/40 bg-rose-500/15",
  violet: "border-violet-400/40 bg-violet-500/15",
};

type Oneriler = Partial<Record<ActionParamKind, string[]>>;

/** Başka bir ekrandan desteye düğme ekler (sahne sağ tık "Desteye ekle"); açık deste kendini yeniler */
/** Desteyi yazar; başka pencere arada kaydettiyse (sürüm kilidi, 409) null döner. Dönen deste yeni sürümü taşır. */
async function desteYaz(d: DeckConfig): Promise<DeckConfig | null> {
  const res = await fetch(`${API_BASE}/api/settings/patch?screen=panel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ controlDeck: { ...d, rev: d.rev ?? 0 } }),
  });
  if (res.status === 409) return null;
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return parseDeck((await res.json()).controlDeck);
}

export async function desteyeEkle(b: Omit<DeckButton, "id">): Promise<string> {
  // Sürüm çakışırsa (deste o an başka pencerede kaydedildi) bir kez daha okuyup dener
  for (let deneme = 0; deneme < 2; deneme++) {
    const s = await fetchSettings("panel");
    const r = addToFirstFree(parseDeck(s.controlDeck), b);
    if (!r) return "Destede yer yok: bir sayfayı boşaltın ya da yeni sayfa ekleyin";
    if (await desteYaz(r.deck)) {
      window.dispatchEvent(new Event(DESTE_OLAYI));
      return `${b.label}: desteye eklendi (${r.page})`;
    }
  }
  return "Deste başka bir pencerede değişiyor; birazdan yeniden deneyin";
}

export function DeckPanel({ onToast }: { onToast: (m: string) => void }) {
  const [deck, setDeck] = useState<DeckConfig | null>(null);
  const [sayfaId, setSayfaId] = useState("");
  const [eylemler, setEylemler] = useState<ActionInfo[]>([]);
  const [duzenle, setDuzenle] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [kurulu, setKurulu] = useState<string | null>(null); // onay bekleyen düğme
  const [hata, setHata] = useState("");

  const [duzenlenen, setDuzenlenen] = useState<DeckButton | null>(null);

  const sira = useRef(Promise.resolve());
  const rev = useRef<number | undefined>(undefined);
  const oku = useCallback(
    () =>
      fetchSettings("panel")
        .then((s) => {
          const d = parseDeck(s.controlDeck);
          rev.current = d.rev;
          setDeck(d);
        })
        .catch(() => setDeck((d) => d ?? defaultDeck())),
    []
  );
  useEffect(() => {
    void oku();
    window.addEventListener(DESTE_OLAYI, oku);
    return () => window.removeEventListener(DESTE_OLAYI, oku);
  }, [oku]);

  const yukle = useCallback(async () => {
    try {
      setEylemler(await actionsApi.list());
      setHata("");
    } catch (e) {
      setHata(String((e as Error).message || e).slice(0, 160));
    }
  }, []);
  useEffect(() => {
    void yukle();
    const id = setVisibleInterval(() => void yukle(), 5000);
    return () => clearVisibleInterval(id);
  }, [yukle]);

  useEffect(() => {
    if (!kurulu) return;
    const t = window.setTimeout(() => setKurulu(null), 4000);
    return () => window.clearTimeout(t);
  }, [kurulu]);

  // Kayıtlar sırayla gider; her biri bir öncekinin döndürdüğü sürümle yazılır (art arda düzenleme kendine çakışmaz)
  const kaydet = (d: DeckConfig) => {
    setDeck(d);
    sira.current = sira.current
      .then(async () => {
        const yazilan = await desteYaz({ ...d, rev: rev.current });
        if (yazilan) {
          rev.current = yazilan.rev;
          return;
        }
        onToast("Deste başka bir pencerede değişti; son hâli yüklendi");
        await oku();
      })
      .catch((e) => onToast(`Deste kaydedilemedi: ${String((e as Error).message || e).slice(0, 120)}`));
  };

  const eylem = useMemo(() => Object.fromEntries(eylemler.map((a) => [a.id, a])), [eylemler]);
  const sayfa = deck?.pages.find((p) => p.id === sayfaId) || deck?.pages[0];

  const bas = async (b: DeckButton) => {
    const a = eylem[b.actionId];
    if (!a) return onToast(`${b.label}: eylem tanımlı değil (${b.actionId})`);
    if (a.confirm && kurulu !== b.id) return setKurulu(b.id);
    setKurulu(null);
    setBusy(b.id);
    try {
      await actionsApi.run(b.actionId, b.params, a.confirm);
      onToast(`${b.label}: tamam`);
    } catch (e) {
      onToast(`${b.label}: ${String((e as Error).message || e).slice(0, 160)}`);
    } finally {
      setBusy(null);
      void yukle();
    }
  };

  if (!deck || !sayfa) return <p className="text-xs text-panel-muted">Yükleniyor…</p>;

  // Tablo A7 — Düzenle · Kopyala · Renk · Kısayol ata · Sil
  const tusMenusu = (b: DeckButton): MenuOgesi[] => [
    { ad: "Düzenle", ikon: PencilSimple, yap: () => setDuzenlenen(b) },
    { ad: "Kopyala", ikon: Copy, kapali: sayfa.buttons.length >= DECK_MAX_BUTTONS, yap: () => kaydet(duplicateButton(deck, sayfa.id, b.id)) },
    { ad: `Renk: ${nextColor(b.color)}`, ikon: Palette, yap: () => kaydet(updateButton(deck, sayfa.id, b.id, { color: nextColor(b.color) })) },
    { ad: "Kısayol ata", ikon: Keyboard, kapali: !eylem[b.actionId], yap: () => void (kisayolAta(destedenKisayol(b)) || onToast(KISAYOL_YOK)) },
    { ad: "Sil", ikon: Trash, onay: true, ayrac: true, yap: () => kaydet(removeButton(deck, sayfa.id, b.id)) },
  ];

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {deck.pages.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`rounded px-2 py-0.5 ${p.id === sayfa.id ? "bg-panel-accent/20 text-white" : "text-white/60 hover:text-white"}`}
            onClick={() => setSayfaId(p.id)}
          >
            {p.name}
          </button>
        ))}
        <span className="flex-1" />
        {duzenle && deck.pages.length < DECK_MAX_PAGES && (
          <button type="button" className="studio-btn-ghost !px-2 !py-0.5" onClick={() => kaydet(addPage(deck, `Sayfa ${deck.pages.length + 1}`))}>
            + Sayfa
          </button>
        )}
        {duzenle && deck.pages.length > 1 && (
          <button
            type="button"
            className="studio-btn-ghost !px-2 !py-0.5"
            onClick={() => {
              kaydet(removePage(deck, sayfa.id));
              setSayfaId("");
            }}
          >
            Sayfayı sil
          </button>
        )}
        <button type="button" className="studio-btn-ghost !px-2 !py-0.5" aria-pressed={duzenle} onClick={() => setDuzenle((v) => !v)}>
          {duzenle ? "Bitti" : "Düzenle"}
        </button>
      </div>
      {hata && <p className="text-red-300">Eylemler alınamadı: {hata}</p>}

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {sayfa.buttons.map((b, i) => {
          const a = eylem[b.actionId];
          const hazir = !!a && a.available;
          const ipucu = !a ? "Bu eylem artık tanımlı değil" : !a.available ? a.reason || "Kullanılamıyor" : a.confirm ? "Çift dokunuş ister" : a.label;
          return (
            <div key={b.id} className="relative" onContextMenu={nesneMenusu(() => tusMenusu(b))}>
              <button
                type="button"
                title={ipucu}
                disabled={duzenle || !hazir || busy !== null}
                onClick={() => void bas(b)}
                className={`flex h-16 w-full flex-col items-center justify-center rounded-lg border px-1 text-center font-bold leading-tight text-white transition ${RENK[b.color]} ${
                  hazir ? "hover:brightness-125" : "opacity-45"
                } ${kurulu === b.id ? "ring-2 ring-red-400" : ""}`}
              >
                <span className="line-clamp-2">{kurulu === b.id ? "Emin misin? Tekrar dokun" : b.label}</span>
                {!duzenle && a && !a.available && <span className="mt-0.5 text-ui-2 font-normal text-white/60">{a.reason}</span>}
              </button>
              {duzenle && (
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 pb-0.5">
                  <button type="button" aria-label="Sola taşı" disabled={i === 0} className="rounded bg-black/50 p-0.5 disabled:opacity-30" onClick={() => kaydet(moveButton(deck, sayfa.id, b.id, -1))}>
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                  <button type="button" aria-label="Sil" className="rounded bg-black/50 p-0.5 text-red-300" onClick={() => kaydet(removeButton(deck, sayfa.id, b.id))}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Sağa taşı"
                    disabled={i === sayfa.buttons.length - 1}
                    className="rounded bg-black/50 p-0.5 disabled:opacity-30"
                    onClick={() => kaydet(moveButton(deck, sayfa.id, b.id, 1))}
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {sayfa.buttons.length === 0 && !duzenle && <p className="col-span-full text-panel-muted">Bu sayfada düğme yok — “Düzenle” ile ekle.</p>}
      </div>

      {duzenlenen ? (
        <DugmeEkle
          key={duzenlenen.id}
          eylemler={eylemler}
          ilk={duzenlenen}
          onEkle={(b) => {
            kaydet(updateButton(deck, sayfa.id, duzenlenen.id, b));
            setDuzenlenen(null);
          }}
          onVazgec={() => setDuzenlenen(null)}
        />
      ) : (
        duzenle && sayfa.buttons.length < DECK_MAX_BUTTONS && <DugmeEkle eylemler={eylemler} onEkle={(b) => kaydet(addButton(deck, sayfa.id, b))} />
      )}
    </div>
  );
}

function DugmeEkle({ eylemler, onEkle, ilk, onVazgec }: { eylemler: ActionInfo[]; onEkle: (b: Omit<DeckButton, "id">) => void; ilk?: DeckButton; onVazgec?: () => void }) {
  const [actionId, setActionId] = useState(ilk?.actionId ?? "");
  const [etiket, setEtiket] = useState(ilk?.label ?? "");
  const [params, setParams] = useState<Record<string, string>>(ilk?.params ?? {});
  const [renk, setRenk] = useState<DeckColor>(ilk?.color ?? "slate");
  const [oneri, setOneri] = useState<Oneriler>({});

  const secili = eylemler.find((a) => a.id === actionId);

  // Parametre önerileri: OBS sahneleri/girişleri ve çoklu yayın hedefleri (bağlı değilse boş kalır, elle yazılabilir)
  useEffect(() => {
    if (!secili?.params.length) return;
    void (async () => {
      const [sc, inp, ms] = await Promise.all([
        obsControl.scenes().catch(() => null),
        obsControl.inputs().catch(() => []),
        multistreamApi.status().catch(() => null),
      ]);
      const sahneler = sc?.scenes || [];
      setOneri({
        scene: sahneler,
        optionalScene: sahneler,
        input: inp.map((i) => i.name),
        destination: (ms?.destinations || []).map((d) => d.id),
      });
    })();
  }, [secili?.id, secili?.params.length]);

  // İsteğe bağlı sahne boş kalabilir (boş = yayındaki sahne)
  const eksik = !!secili && secili.params.some((p) => p.kind !== "optionalScene" && p.kind !== "playlist" && !(params[p.name] || "").trim());

  return (
    <div className="space-y-1.5 rounded-lg border border-white/10 p-2">
      <div className="flex flex-wrap gap-1.5">
        <select
          className="studio-input !py-1 text-xs"
          aria-label="Eylem"
          value={actionId}
          onChange={(e) => {
            setActionId(e.target.value);
            setParams({});
            const a = eylemler.find((x) => x.id === e.target.value);
            if (a && !etiket) setEtiket(a.label);
          }}
        >
          <option value="">Eylem seç…</option>
          {eylemler.map((a) => (
            <option key={a.id} value={a.id}>
              {(CATEGORY_LABEL[a.category] || a.category) + " · " + a.label}
            </option>
          ))}
        </select>
        <input className="studio-input !py-1 text-xs" aria-label="Düğme etiketi" placeholder="Etiket" maxLength={40} value={etiket} onChange={(e) => setEtiket(e.target.value)} />
        <select className="studio-input !py-1 text-xs" aria-label="Renk" value={renk} onChange={(e) => setRenk(e.target.value as DeckColor)}>
          {DECK_COLORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {secili?.params.map((p) => (
        <div key={p.name}>
          <input
            className="studio-input w-full !py-1 text-xs"
            aria-label={p.name}
            placeholder={p.kind === "optionalScene" ? "Sahne (boş = yayındaki)" : p.kind === "db" ? "dB farkı (örn. -3)" : PARAM_LABEL[p.kind]}
            inputMode={p.kind === "db" ? "decimal" : p.kind === "percent" ? "numeric" : undefined}
            list={`deck-oneri-${p.kind}`}
            maxLength={256}
            value={params[p.name] || ""}
            onChange={(e) => setParams((m) => ({ ...m, [p.name]: e.target.value }))}
          />
          <datalist id={`deck-oneri-${p.kind}`}>
            {(oneri[p.kind] || []).map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>
      ))}
      {secili?.confirm && <p className="text-amber-300">Bu eylem çift dokunuşla çalışır (kazara tetiklenmesin).</p>}
      <button
        type="button"
        className="studio-btn-primary !px-2 !py-1"
        disabled={!secili || eksik}
        onClick={() => {
          if (!secili) return;
          onEkle({ label: etiket.trim() || secili.label, actionId: secili.id, params, color: renk });
          setActionId("");
          setEtiket("");
          setParams({});
        }}
      >
        <Plus className="mr-1 inline h-3 w-3" />
        {ilk ? "Kaydet" : "Düğme ekle"}
      </button>
      {onVazgec && (
        <button type="button" className="studio-btn-ghost ml-1.5 !px-2 !py-1" onClick={onVazgec}>
          Vazgeç
        </button>
      )}
    </div>
  );
}
