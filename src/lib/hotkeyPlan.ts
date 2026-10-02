/**
 * Kısayol planı — sahne ve aksiyon kısayollarını tek listede toplar.
 *
 * Neden ayrı modül: bu mantık `PanelPage` içinde üç `useMemo` gövdesine
 * dağılmıştı ve React'a bağlı olduğu için test edilemiyordu. Çakışma hatası da
 * tam buradaydı, o yüzden saf bir fonksiyona taşındı.
 *
 * ## Düzeltilen üç kusur
 * 1. **Silinemeyen varsayılan.** Sahne kısayollarına `hk.starting || "F1"` gibi
 *    sabit değer veriliyordu; kullanıcı temizlese bile F1-F4 işletim sisteminde
 *    kayıtlı kalıyordu. Artık boş, gerçekten boş.
 * 2. **Normalize edilmemiş tuş metni.** Diskte `"CTRL+F1"`, arayüzde `"Ctrl+F1"`
 *    yazıyordu. Rust ikisini aynı tuşa çözüyor ama ön yüz ham metin
 *    karşılaştırdığı için aynı tuş iki ayrı binding sanılıyor, biri Rust'ta
 *    diğeri WebView'de tetikleniyordu — "sahne değişiyor ve aynı anda ses
 *    çalıyor" şikâyetinin sebebi buydu. Artık çıkışta canonical.
 * 3. **Sessiz düşürme.** Aynı tuşa iki eylem atanınca ikincisi hiçbir uyarı
 *    vermeden yok sayılıyordu. Artık `conflicts` olarak dönüyor.
 */

import { canonicalizeHotkeySpec, type HotkeyBinding } from "./globalHotkeys";
import { actionBindingId, missingField, type ActionRow } from "./obsActions";

export type SfxPadLike = { id: string; name?: string; hotkey?: string };

export type HotkeyConflict = {
  /** Çakışan canonical tuş */
  spec: string;
  /** Kayda giren (öncelikli) binding */
  winnerId: string;
  /** Aynı tuşu isteyip düşenler */
  loserIds: string[];
};

export type HotkeyPlan = {
  /** Rust'a gönderilecek, çakışmasız ve canonical liste */
  bindings: HotkeyBinding[];
  conflicts: HotkeyConflict[];
  /** Geçersiz kombinasyonlar — kullanıcıya gösterilir */
  invalid: { id: string; spec: string }[];
};

type ObsLike = Record<string, any> | null | undefined;

/** Sahne kısayolları — varsayılan ATANMAZ; boşsa boş kalır. */
function sceneRows(obs: Record<string, any>): HotkeyBinding[] {
  const map = obs.sceneMap || {};
  const hk = obs.hotkeys || {};
  const extras: { id: string; scene?: string; hotkey?: string; label?: string }[] = obs.sceneSwitchHotkeys || [];

  const sabit: HotkeyBinding[] = [
    {
      id: "starting",
      label: "Giriş",
      kind: "scene",
      scene: map.starting || obs.startingScene || "",
      spec: hk.starting || "",
    },
    {
      id: "ending",
      label: "Bitiş",
      kind: "scene",
      scene: map.ending || obs.endingScene || "",
      spec: hk.ending || "",
    },
    {
      id: "brb",
      label: "Mola",
      kind: "scene",
      scene: map.brb || obs.brbScene || "",
      spec: hk.brb || "",
    },
    {
      id: "game",
      label: "Oyun",
      kind: "scene",
      scene: map.game || obs.sceneOnEnd || "",
      spec: hk.game || "",
    },
  ];

  const ek: HotkeyBinding[] = extras
    .filter((r) => r.id && String(r.scene || "").trim() && String(r.hotkey || "").trim())
    .map((r) => {
      const scene = String(r.scene).trim();
      return {
        id: `sceneSwitch:${r.id}`,
        label: (r.label || "").trim() || scene,
        kind: "scene",
        scene,
        spec: String(r.hotkey).trim(),
      };
    });

  return [...sabit, ...ek];
}

/** Ses / OBS aksiyon kısayolları. */
function actionRows(obs: Record<string, any>, sfxPads: SfxPadLike[], clearChatHk: string, sfxStopHk: string): HotkeyBinding[] {
  const hk = obs.hotkeys || {};
  const sourceMutes: { id: string; input?: string; hotkey?: string }[] = obs.sourceMuteHotkeys || [];

  const rows: HotkeyBinding[] = [
    { id: "mic", spec: hk.mic || "", kind: "mic", input: obs.micInput || "" },
    { id: "muteAll", spec: hk.muteAll || "", kind: "muteAll" },
    { id: "music", spec: hk.music || "", kind: "music" },
    ...sourceMutes
      .filter((r) => r.id && String(r.hotkey || "").trim())
      .map((r) => ({
        id: `srcMute:${r.id}`,
        spec: String(r.hotkey).trim(),
        kind: "srcMute",
        input: String(r.input || "").trim(),
      })),
    ...sfxPads
      .filter((p) => String(p.hotkey || "").trim())
      .map((p) => ({
        id: `sfx:${p.id}`,
        spec: String(p.hotkey).trim(),
        kind: "sfx",
        label: p.name,
      })),
  ];

  // OBS aksiyonları (kaynak aç/kapa, kayıt, ses seviyesi, filtre, sahne gezme…).
  // Kısayolu boş olan ya da çalışmak için gereken alanı eksik satır plana
  // girmez: eksik alanlı bir kısayolu kaydedip her basışta hata vermek yerine
  // arayüz o satırı uyarıyla gösteriyor.
  const actions: ActionRow[] = Array.isArray(obs.actionHotkeys) ? obs.actionHotkeys : [];
  for (const r of actions) {
    if (!r || !r.id || !String(r.hotkey || "").trim()) continue;
    if (missingField(r)) continue;
    rows.push({
      id: actionBindingId(r.id),
      spec: String(r.hotkey).trim(),
      kind: r.kind,
      label: r.label,
      scene: r.scene || "",
      input: r.input || "",
      source: r.source || "",
      filter: r.filter || "",
      transition: r.transition || "",
      text: r.text || "",
      mode: r.mode || "",
      delta: Number(r.delta) || 0,
      name: r.name || "",
      target: r.target || "",
      confirmed: !!r.confirmed,
    });
  }

  const clear = String(clearChatHk || "").trim();
  if (clear) rows.push({ id: "clearChat", spec: clear, kind: "clearChat" });
  const stop = String(sfxStopHk || "").trim();
  if (stop) rows.push({ id: "sfxStop", spec: stop, kind: "sfxStop" });
  return rows;
}

/**
 * Tüm kısayolları tek planda toplar.
 *
 * Sıra önceliği belirler: sahne kısayolları önce gelir, aynı tuşu isteyen
 * aksiyon `conflicts`'e düşer. Bu, eski davranışın (Rust'ta ilk kazanır)
 * aynısı — ama artık görünür.
 */
export function buildHotkeyPlan(input: {
  obs: ObsLike;
  sfxPads?: SfxPadLike[];
  clearChatHk?: string;
  /** "Tüm sesleri durdur" kısayolu */
  sfxStopHk?: string;
}): HotkeyPlan {
  const obs = input.obs || {};
  const ham = [...sceneRows(obs), ...actionRows(obs, input.sfxPads || [], input.clearChatHk || "", input.sfxStopHk || "")];

  const bindings: HotkeyBinding[] = [];
  const invalid: { id: string; spec: string }[] = [];
  const sahip = new Map<string, string>(); // canonical spec → kazanan id
  const kayip = new Map<string, string[]>(); // canonical spec → düşenler

  for (const b of ham) {
    const ham_spec = String(b.spec || "").trim();
    if (!ham_spec) continue; // boş = kısayol yok, hata değil

    const spec = canonicalizeHotkeySpec(ham_spec);
    if (!spec) {
      invalid.push({ id: b.id, spec: ham_spec });
      continue;
    }

    const onceki = sahip.get(spec);
    if (onceki) {
      kayip.set(spec, [...(kayip.get(spec) || []), b.id]);
      continue;
    }
    sahip.set(spec, b.id);
    bindings.push({ ...b, spec });
  }

  const conflicts: HotkeyConflict[] = [...kayip.entries()].map(([spec, loserIds]) => ({
    spec,
    winnerId: sahip.get(spec) || "",
    loserIds,
  }));

  return { bindings, conflicts, invalid };
}

const SABIT_AD: Record<string, string> = {
  starting: "Giriş sahnesi",
  ending: "Çıkış sahnesi",
  brb: "Mola sahnesi",
  game: "Oyun sahnesi",
  mic: "Mikrofon",
  muteAll: "Tüm sesler",
  music: "Müzik",
  clearChat: "Sohbeti temizle",
  sfxStop: "Tüm sesleri durdur",
};

/** Bir binding kimliğini kullanıcıya okunur adla anar. */
export function bindingName(id: string, bindings: HotkeyBinding[]): string {
  const b = bindings.find((x) => x.id === id);
  const label = (b?.label || "").trim();
  if (SABIT_AD[id]) return SABIT_AD[id];
  if (label) return `«${label}»`;
  if (id.startsWith("sfx:")) return "bir ses efekti";
  if (id.startsWith("act:")) return "bir OBS eylemi";
  if (id.startsWith("srcMute:")) return "bir kaynak sessize alma";
  if (id.startsWith("sceneSwitch:")) return "bir sahne kısayolu";
  return id;
}

/**
 * Plan çakışmalarını Rust'ın `failed` biçimine çevirir.
 *
 * Rust'ın raporu yalnız kayıt denendikten sonra (ve yalnız Tauri'de) gelir;
 * çakışmayı ise plan zaten hesaplıyor. Bu çeviri sayesinde arayüz uyarıyı
 * tarayıcıda da, kayıttan önce de gösterebiliyor.
 */
export function conflictFailures(plan: HotkeyPlan): { id: string; spec: string; reason: string }[] {
  return plan.conflicts.flatMap((c) =>
    c.loserIds.map((id) => ({
      id,
      spec: c.spec,
      reason: `${c.spec} tuşu zaten ${bindingName(c.winnerId, plan.bindings)} için kullanılıyor`,
    }))
  );
}

/**
 * Eskiden sabit kodlanan F1-F4 varsayılanları için tek seferlik göç.
 *
 * Varsayılanlar artık kod içinde atanmıyor; eski kullanıcıların kısayolları
 * kaybolmasın diye bir kez diske yazılır. Yazıldıktan sonra kullanıcı
 * temizlerse gerçekten temizlenmiş olur.
 *
 * @returns uygulanacak yama, gerek yoksa `null`
 */
export function migrateHotkeyDefaults(obs: ObsLike): Record<string, any> | null {
  const cur = obs || {};
  if (cur.hotkeyDefaultsApplied === true) return null;

  const hk = { ...(cur.hotkeys || {}) };
  const varsayilan: Record<string, string> = {
    starting: "F1",
    ending: "F2",
    brb: "F3",
    game: "F4",
  };
  let degisti = false;
  for (const [k, v] of Object.entries(varsayilan)) {
    if (!String(hk[k] || "").trim()) {
      hk[k] = v;
      degisti = true;
    }
  }

  // Bayrak her hâlükârda yazılır: kullanıcı kasten temizlediyse bir daha
  // geri gelmesin.
  return degisti ? { hotkeys: hk, hotkeyDefaultsApplied: true } : { hotkeyDefaultsApplied: true };
}
