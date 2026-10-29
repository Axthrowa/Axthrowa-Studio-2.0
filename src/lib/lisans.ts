/**
 * Premium lisans köprüsü (Rust `lisans.rs`). Doğrulama ve saklama Rust'ta; arayüz yalnız sonucu tutar
 * (`useAxthrowaStore.lisans`). Tauri dışında (tarayıcı, OBS) lisans yoktur.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useAxthrowaStore } from "../store/useAxthrowaStore";

export type Lisans = { kime: string; plan: string; verildi: string; bitis: string | null };

/** Kayıtlı lisansı okur; kayıtlı ama geçersizse (süresi dolmuş) hatayı döndürür */
export async function lisansYukle(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const lisans = await invoke<Lisans | null>("lisans_durumu");
    useAxthrowaStore.setState({ lisans });
    return null;
  } catch (e) {
    useAxthrowaStore.setState({ lisans: null });
    return String(e);
  }
}

export async function lisansEtkinlestir(anahtar: string): Promise<Lisans> {
  const lisans = await invoke<Lisans>("lisans_etkinlestir", { anahtar });
  useAxthrowaStore.setState({ lisans });
  return lisans;
}

export async function lisansKaldir(): Promise<void> {
  await invoke("lisans_kaldir");
  useAxthrowaStore.setState({ lisans: null });
}
