import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clapperboard, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createProfileFromCurrent,
  deleteProfileApi,
  loadProfilesState,
  renameProfileApi,
  setProfileSceneApi,
  switchToProfile,
} from "../../lib/settingsProfilesApi";
import { actionsApi } from "../../lib/api/actions";
import { MAX_PROFILES, activeProfile, canDelete, type ProfilesState } from "../../lib/settingsProfiles";

/**
 * Başlıktaki ayar profili menüsü: profil değiştir, oluştur, yeniden adlandır, sil.
 *
 * Profil = Giriş/Çıkış/Mola/Chat ayarları + ses paneli sesleri ve kısayolları.
 * OBS bağlantısı ve hesaplar profile girmez (bkz. lib/settingsProfiles.ts).
 * Profil değişince ayarlar yeniden yüklensin diye sayfa yenilenir.
 */

type Props = { onToast: (msg: string) => void };

export default function ProfileSwitcher({ onToast }: Props) {
  const [state, setState] = useState<ProfilesState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const root = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await loadProfilesState());
    } catch {
      /* sunucu yoksa menü gizli kalır */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!state) return null;
  const active = activeProfile(state);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onToast(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (id: string, name: string) =>
    run(async () => {
      const next = await switchToProfile(id);
      setState(next);
      setOpen(false);
      // Profilin OBS sahnesi (varsa): ayarlarla birlikte sahne de değişir
      const sahne = next.profiles.find((p) => p.id === id)?.obsSahne;
      if (sahne) {
        try {
          await actionsApi.run("scene.switch", { scene: sahne });
        } catch (e) {
          onToast(`OBS sahnesi değiştirilemedi («${sahne}»): ${String((e as Error)?.message || e).slice(0, 120)}`);
        }
      }
      onToast(`«${name}» profiline geçildi${sahne ? ` · OBS: ${sahne}` : ""} — ayarlar yeniden yükleniyor`);
      // Panel bellekteki eski ayarı geri yazmasın: yeniden yükle.
      window.setTimeout(() => window.location.reload(), 500);
    });

  const create = () =>
    run(async () => {
      const next = await createProfileFromCurrent(newName);
      setState(next);
      setNewName("");
      onToast("Profil oluşturuldu (geçerli ayarlardan). Geçmek için listeden seç.");
    });

  const commitRename = (id: string) =>
    run(async () => {
      setState(await renameProfileApi(id, renameVal));
      setRenaming(null);
    });

  const remove = (id: string, name: string) =>
    run(async () => {
      setState(await deleteProfileApi(id));
      onToast(`«${name}» silindi`);
    });

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Ayar profili"
        className="inline-flex h-8 max-w-[12rem] items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-medium text-white/90 transition-all hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
      >
        <span className="truncate">{active.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-panel-muted transition-transform group-hover:text-white" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-[90] w-72 rounded-2xl border border-white/[0.12] bg-ui-bg p-2.5 shadow-glass-elevated"
        >
          <p className="px-2 pb-1.5 text-ui-2 leading-snug text-panel-muted">
            Profil, Giriş/Çıkış/Mola/Chat ayarlarını ve ses panelini saklar. OBS bağlantısı ortaktır.
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {state.profiles.map((p) => {
              const isActive = p.id === state.activeId;
              return (
                <div key={p.id} className="group flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-white/[0.05]">
                  {renaming === p.id ? (
                    <input
                      autoFocus
                      className="studio-input h-7 min-w-0 flex-1 text-xs"
                      value={renameVal}
                      maxLength={40}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitRename(p.id);
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      onBlur={() => void commitRename(p.id)}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => (isActive ? setOpen(false) : void switchTo(p.id, p.name))}
                      className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-xs text-white"
                    >
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                        {isActive && <Check className="h-3.5 w-3.5 text-panel-accent" />}
                      </span>
                      <span className="truncate">{p.name}</span>
                      {isActive && <span className="shrink-0 text-ui-2 text-panel-muted">etkin</span>}
                    </button>
                  )}
                  {renaming !== p.id && (
                    <>
                      <button
                        type="button"
                        title="Yeniden adlandır"
                        aria-label={`${p.name} profilini yeniden adlandır`}
                        className="rounded p-1 text-panel-muted opacity-0 transition hover:text-white focus:opacity-100 group-hover:opacity-100"
                        onClick={() => {
                          setRenaming(p.id);
                          setRenameVal(p.name);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title={p.obsSahne ? `OBS sahnesi: ${p.obsSahne} (değiştir)` : "Bu profile geçince açılacak OBS sahnesi"}
                        aria-label={`${p.name} profilinin OBS sahnesi`}
                        className={"rounded p-1 transition hover:text-white focus:opacity-100 group-hover:opacity-100 " + (p.obsSahne ? "text-cyan-300" : "text-panel-muted opacity-0")}
                        onClick={() => {
                          const yeni = window.prompt("Bu profile geçince açılacak OBS sahnesinin adı (boş = sahne değişmez):", p.obsSahne || "");
                          if (yeni !== null) void run(async () => setState(await setProfileSceneApi(p.id, yeni)));
                        }}
                      >
                        <Clapperboard className="h-3 w-3" />
                      </button>
                      {canDelete(state, p.id) && (
                        <button
                          type="button"
                          title="Profili sil"
                          aria-label={`${p.name} profilini sil`}
                          className="rounded p-1 text-red-300/80 opacity-0 transition hover:text-red-200 focus:opacity-100 group-hover:opacity-100"
                          onClick={() => void remove(p.id, p.name)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-2 border-t border-white/[0.06] pt-2">
            <div className="flex items-center gap-1.5">
              <input
                className="studio-input h-8 min-w-0 flex-1 text-xs"
                placeholder="Yeni profil adı"
                value={newName}
                maxLength={40}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void create()}
              />
              <button
                type="button"
                disabled={busy || state.profiles.length >= MAX_PROFILES}
                onClick={() => void create()}
                title="Geçerli ayarlardan yeni profil oluştur"
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-panel-accent px-2.5 text-xs font-medium text-ui-accent-ink disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Oluştur
              </button>
            </div>
            <p className="mt-1 text-ui-2 text-panel-muted">
              Yeni profil geçerli ayarların kopyasıyla başlar ({state.profiles.length}/{MAX_PROFILES}).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
