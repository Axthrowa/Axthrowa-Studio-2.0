/** Studio Shop — shop_items CRUD + sfx / OBS scene tetikleri. */

import { useCallback, useEffect, useState } from "react";
import { botaxtApi } from "../../lib/api/botaxt";
import { Btn, Check, Field, Header } from "../panel/botTabs/ui";

type Props = { onToast: (m: string) => void };

type Item = {
  id: string;
  name: string;
  cost: number;
  response: string;
  enabled: number | boolean;
  alert: number | boolean;
  stock: number | null;
  cooldown_sec: number;
  trigger_kind: string;
  trigger_json: string;
};

function on(v: number | boolean | undefined) {
  return v === true || v === 1;
}

function parseTrig(raw: string): { path: string; scene: string; volume: number } {
  try {
    const j = JSON.parse(raw || "{}") as Record<string, unknown>;
    return {
      path: String(j.path || j.file || j.media_path || ""),
      scene: String(j.scene || j.sceneName || ""),
      volume: Number(j.volume ?? 1),
    };
  } catch {
    return { path: "", scene: "", volume: 1 };
  }
}

const EMPTY: Item = {
  id: "",
  name: "",
  cost: 100,
  response: "{user} aldı: {item}",
  enabled: true,
  alert: true,
  stock: null,
  cooldown_sec: 0,
  trigger_kind: "chat",
  trigger_json: "{}",
};

export default function StudioShopPanel({ onToast }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [edit, setEdit] = useState<Item | null>(null);
  const [path, setPath] = useState("");
  const [scene, setScene] = useState("");
  const [volume, setVolume] = useState(1);
  const [stockStr, setStockStr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await botaxtApi.shop();
      setItems((r.items || []) as Item[]);
    } catch (e) {
      onToast(String((e as Error).message || "Mağaza yüklenemedi"));
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEdit({ ...EMPTY, id: "" });
    setPath("");
    setScene("");
    setVolume(1);
    setStockStr("");
  };

  const openEdit = (it: Item) => {
    setEdit({ ...it });
    const t = parseTrig(it.trigger_json);
    setPath(t.path);
    setScene(t.scene);
    setVolume(t.volume);
    setStockStr(it.stock == null ? "" : String(it.stock));
  };

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const trigger_json: Record<string, unknown> = {};
      if (edit.trigger_kind === "sfx" || edit.trigger_kind === "sound") {
        trigger_json.path = path;
        trigger_json.volume = volume;
      } else if (edit.trigger_kind === "obs_scene") {
        trigger_json.scene = scene;
      }
      await botaxtApi.upsertShop({
        id: edit.id || undefined,
        name: edit.name,
        cost: edit.cost,
        response: edit.response,
        enabled: on(edit.enabled),
        alert: on(edit.alert),
        stock: stockStr.trim() === "" ? null : Number(stockStr) || 0,
        cooldown_sec: edit.cooldown_sec,
        trigger_kind: edit.trigger_kind,
        trigger_json,
      });
      onToast("Öğe kaydedildi");
      setEdit(null);
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Kayıt başarısız"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await botaxtApi.deleteShop(id);
      onToast("Silindi");
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Silinemedi"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Header
          title="Points Shop"
          sub="!buy &lt;öğe&gt; · sfx / OBS sahne tetikleri"
        />
        <div className="flex gap-2">
          <Btn tone="ghost" disabled={busy} onClick={() => void load()}>
            Yenile
          </Btn>
          <Btn disabled={busy} onClick={openNew}>
            Yeni öğe
          </Btn>
        </div>
      </div>

      {edit && (
        <div className="rounded-xl border border-panel-border/70 bg-panel-elevated/50 p-4 space-y-3">
          <div className="text-sm font-semibold text-white">
            {edit.id ? "Öğeyi düzenle" : "Yeni öğe"}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label="Ad"
              value={edit.name}
              onChange={(v) => setEdit({ ...edit, name: v })}
            />
            <Field
              label="Fiyat (cost)"
              type="number"
              value={String(edit.cost)}
              onChange={(v) => setEdit({ ...edit, cost: Number(v) || 0 })}
            />
            <Field
              label="Stok (boş = sınırsız)"
              value={stockStr}
              onChange={setStockStr}
            />
            <Field
              label="Cooldown (sn)"
              type="number"
              value={String(edit.cooldown_sec)}
              onChange={(v) =>
                setEdit({ ...edit, cooldown_sec: Number(v) || 0 })
              }
            />
          </div>
          <Field
            label="Chat yanıtı"
            value={edit.response}
            onChange={(v) => setEdit({ ...edit, response: v })}
          />
          <label className="block text-xs text-panel-muted">
            Tetikleyici
            <select
              className="yya-input mt-1 w-full"
              value={edit.trigger_kind}
              onChange={(e) =>
                setEdit({ ...edit, trigger_kind: e.target.value })
              }
            >
              <option value="chat">Sadece chat</option>
              <option value="sfx">Ses dosyası (SFX)</option>
              <option value="obs_scene">OBS sahnesi</option>
            </select>
          </label>
          {(edit.trigger_kind === "sfx" || edit.trigger_kind === "sound") && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Ses yolu / URL" value={path} onChange={setPath} />
              <Field
                label="Volume (0–1)"
                type="number"
                value={String(volume)}
                onChange={(v) => setVolume(Number(v) || 1)}
              />
            </div>
          )}
          {edit.trigger_kind === "obs_scene" && (
            <Field
              label="OBS sahne adı"
              value={scene}
              onChange={setScene}
            />
          )}
          <div className="flex flex-wrap gap-3">
            <Check
              label="Açık"
              checked={on(edit.enabled)}
              onChange={(v) => setEdit({ ...edit, enabled: v })}
            />
            <Check
              label="Alert"
              checked={on(edit.alert)}
              onChange={(v) => setEdit({ ...edit, alert: v })}
            />
          </div>
          <div className="flex gap-2">
            <Btn disabled={busy || !edit.name.trim()} onClick={() => void save()}>
              Kaydet
            </Btn>
            <Btn tone="ghost" onClick={() => setEdit(null)}>
              İptal
            </Btn>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-panel-border/70">
        <table className="w-full text-left text-xs">
          <thead className="bg-panel-elevated/80 text-panel-muted">
            <tr>
              <th className="px-3 py-2">Ad</th>
              <th className="px-3 py-2">Fiyat</th>
              <th className="px-3 py-2">Stok</th>
              <th className="px-3 py-2">Tetik</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-panel-border/50">
                <td className="px-3 py-2 text-white">{it.name}</td>
                <td className="px-3 py-2">{it.cost}</td>
                <td className="px-3 py-2">
                  {it.stock == null ? "∞" : it.stock}
                </td>
                <td className="px-3 py-2">{it.trigger_kind}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    type="button"
                    className="text-panel-accent"
                    onClick={() => openEdit(it)}
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    className="text-red-400"
                    onClick={() => void remove(it.id)}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-panel-muted"
                >
                  Henüz öğe yok
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
