/** Studio Moderasyon — bot_filters + blacklist + strike ladder. */

import { useCallback, useEffect, useState } from "react";
import { botaxtApi } from "../../lib/api/botaxt";
import { Btn, Check, Field, Header } from "../panel/botTabs/ui";

type Props = { onToast: (m: string) => void };

function on(v: number | boolean | undefined) {
  return v === true || v === 1;
}

function parseList(raw: unknown): string {
  if (Array.isArray(raw)) return raw.join(", ");
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return j.join(", ");
      return raw;
    } catch {
      return raw;
    }
  }
  return "";
}

export default function StudioModerationPanel({ onToast }: Props) {
  const [caps, setCaps] = useState(true);
  const [capsMin, setCapsMin] = useState(8);
  const [capsRatio, setCapsRatio] = useState(0.7);
  const [links, setLinks] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [symbolsMax, setSymbolsMax] = useState(8);
  const [longMsg, setLongMsg] = useState(false);
  const [longMax, setLongMax] = useState(300);
  const [blacklist, setBlacklist] = useState("");
  const [timeoutSec, setTimeoutSec] = useState(600);
  const [exempt, setExempt] = useState(1000);
  const [windowSec, setWindowSec] = useState(3600);
  const [ladder, setLadder] = useState("warn, timeout, ban");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const f = await botaxtApi.filters();
      setCaps(on(f.caps_enabled as number | boolean));
      if (f.caps_min_len != null) setCapsMin(Number(f.caps_min_len));
      if (f.caps_ratio != null) setCapsRatio(Number(f.caps_ratio));
      setLinks(on(f.links_enabled as number | boolean));
      setSymbols(on(f.symbols_enabled as number | boolean));
      if (f.symbols_max != null) setSymbolsMax(Number(f.symbols_max));
      setLongMsg(on(f.long_msg_enabled as number | boolean));
      if (f.long_msg_max != null) setLongMax(Number(f.long_msg_max));
      setBlacklist(parseList(f.blacklist_json ?? f.blacklist));
      if (f.timeout_sec != null) setTimeoutSec(Number(f.timeout_sec));
      if (f.exempt_level != null) setExempt(Number(f.exempt_level));
      if (f.strike_window_sec != null) setWindowSec(Number(f.strike_window_sec));
      setLadder(parseList(f.strike_ladder_json ?? f.strike_ladder) || "warn, timeout, ban");
    } catch (e) {
      onToast(String((e as Error).message || "Filtreler yüklenemedi"));
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const bl = blacklist
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const lad = ladder
        .split(/[,\n]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      await botaxtApi.putFilters({
        caps_enabled: caps,
        caps_min_len: capsMin,
        caps_ratio: capsRatio,
        links_enabled: links,
        symbols_enabled: symbols,
        symbols_max: symbolsMax,
        long_msg_enabled: longMsg,
        long_msg_max: longMax,
        blacklist: bl,
        timeout_sec: timeoutSec,
        exempt_level: exempt,
        strike_window_sec: windowSec,
        strike_ladder: lad.length ? lad : ["warn", "timeout", "ban"],
      });
      onToast("Moderasyon kaydedildi");
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Kayıt başarısız"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Header
          title="Moderasyon"
          sub="Caps · link · sembol · kara liste · strike zinciri"
        />
        <div className="flex gap-2">
          <Btn tone="ghost" disabled={busy} onClick={() => void load()}>
            Yenile
          </Btn>
          <Btn disabled={busy} onClick={() => void save()}>
            Kaydet
          </Btn>
        </div>
      </div>

      <div className="rounded-xl border border-panel-border/70 bg-panel-elevated/50 p-4 space-y-3">
        <div className="text-sm font-semibold text-white">Filtreler</div>
        <div className="flex flex-wrap gap-4">
          <Check label="Caps Lock" checked={caps} onChange={setCaps} />
          <Check label="Link / URL" checked={links} onChange={setLinks} />
          <Check label="Aşırı sembol" checked={symbols} onChange={setSymbols} />
          <Check label="Uzun mesaj" checked={longMsg} onChange={setLongMsg} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field
            label="Caps min uzunluk"
            type="number"
            value={String(capsMin)}
            onChange={(v) => setCapsMin(Number(v) || 8)}
          />
          <Field
            label="Caps oranı (0–1)"
            type="number"
            value={String(capsRatio)}
            onChange={(v) => setCapsRatio(Number(v) || 0.7)}
          />
          <Field
            label="Max sembol"
            type="number"
            value={String(symbolsMax)}
            onChange={(v) => setSymbolsMax(Number(v) || 8)}
          />
          <Field
            label="Max mesaj uzunluğu"
            type="number"
            value={String(longMax)}
            onChange={(v) => setLongMax(Number(v) || 300)}
          />
          <Field
            label="Timeout (sn)"
            type="number"
            value={String(timeoutSec)}
            onChange={(v) => setTimeoutSec(Number(v) || 600)}
          />
          <Field
            label="Muafiyet seviyesi"
            type="number"
            value={String(exempt)}
            onChange={(v) => setExempt(Number(v) || 1000)}
          />
        </div>
        <p className="text-[11px] text-panel-muted">
          Muafiyet: 0 herkes · 100 abone · 500 VIP · 1000 mod (modlar her zaman
          muaf).
        </p>
      </div>

      <div className="rounded-xl border border-panel-border/70 bg-panel-elevated/50 p-4 space-y-3">
        <div className="text-sm font-semibold text-white">Kara liste</div>
        <Field
          label="Kelimeler (virgül / satır)"
          value={blacklist}
          onChange={setBlacklist}
        />
      </div>

      <div className="rounded-xl border border-panel-border/70 bg-panel-elevated/50 p-4 space-y-3">
        <div className="text-sm font-semibold text-white">Strike zinciri</div>
        <Field
          label="Pencere (sn)"
          type="number"
          value={String(windowSec)}
          onChange={(v) => setWindowSec(Number(v) || 3600)}
        />
        <Field
          label="Merdiven (virgül)"
          value={ladder}
          onChange={setLadder}
        />
        <p className="text-[11px] text-panel-muted">
          Örn: warn, timeout, ban — 1. ihlal uyarı+sil, 2. timeout, 3. ban.
          Eylemler overlay-sync üzerinden paneli/OBS köprüsünü tetikler.
        </p>
      </div>
    </section>
  );
}
