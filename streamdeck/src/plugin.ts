/**
 * U12: AxthrowA Studio Stream Deck eklentisi.
 * - Deste düğmesi: Studio destesindeki bir düğmeyi donanım tuşuna atar.
 * - Mikrofon / Yayın / Kayıt: tuş simgesi OBS durumunu gösterir (susturuldu, canlı, kayıtta).
 * Onay isteyen eylemde (yayını başlat/durdur, kaydı durdur) tuşa 3 sn içinde ikinci kez basılır.
 */
import streamDeck, { type KeyAction, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { type Durum, OnayKapisi, Studio } from "./studio.ts";

const studio = new Studio(process.env.STUDIO_ADRES || "http://127.0.0.1:8843");
const onay = new OnayKapisi(3000);
let sonDurum: Durum | null = null;

async function sonucuGoster(a: KeyAction<JsonObject>, id: string, params: Record<string, string>, baslik: string) {
  const anahtar = `${a.id}:${id}`;
  const r = await studio.calistir(id, params, onay.onaylandi(anahtar));
  if (r.tur === "tamam") return a.showOk();
  if (r.tur === "onay") {
    onay.bekle(anahtar);
    await a.setTitle("Onay?\nTekrar bas");
    setTimeout(() => void a.setTitle(baslik), 3000);
    return;
  }
  streamDeck.logger.warn(`${id}: ${r.mesaj}`);
  await a.showAlert();
}

type DesteAyar = { buton?: string };
class DesteEylemi extends SingletonAction<DesteAyar> {
  override readonly manifestId = "com.axthrowa.studio.deste";
  override async onWillAppear(ev: WillAppearEvent<DesteAyar>) {
    const b = (await studio.deste().catch(() => [])).find((x) => x.id === ev.payload.settings.buton);
    if (b && ev.action.isKey()) await ev.action.setTitle(b.label);
  }
  override async onKeyDown(ev: KeyDownEvent<DesteAyar>) {
    const b = (await studio.deste().catch(() => [])).find((x) => x.id === ev.payload.settings.buton);
    if (!b) return ev.action.showAlert();
    await sonucuGoster(ev.action as KeyAction<JsonObject>, b.actionId, b.params, b.label);
  }
}

type SusturAyar = { giris?: string };
class SusturEylemi extends SingletonAction<SusturAyar> {
  override readonly manifestId = "com.axthrowa.studio.sustur";
  override async onWillAppear(ev: WillAppearEvent<SusturAyar>) {
    if (ev.payload.settings.giris && ev.action.isKey()) await ev.action.setTitle(ev.payload.settings.giris);
  }
  override async onKeyDown(ev: KeyDownEvent<SusturAyar>) {
    const giris = ev.payload.settings.giris;
    if (!giris) return ev.action.showAlert();
    await sonucuGoster(ev.action as KeyAction<JsonObject>, "audio.toggle", { input: giris }, giris);
    void yokla();
  }
}

class YayinEylemi extends SingletonAction {
  override readonly manifestId = "com.axthrowa.studio.yayin";
  override async onKeyDown(ev: KeyDownEvent) {
    await sonucuGoster(ev.action as KeyAction<JsonObject>, sonDurum?.streaming ? "stream.stop" : "stream.start", {}, "");
    void yokla();
  }
}

class KayitEylemi extends SingletonAction {
  override readonly manifestId = "com.axthrowa.studio.kayit";
  override async onKeyDown(ev: KeyDownEvent) {
    await sonucuGoster(ev.action as KeyAction<JsonObject>, sonDurum?.recording ? "record.stop" : "record.start", {}, "");
    void yokla();
  }
}

const deste = new DesteEylemi();
const sustur = new SusturEylemi();
const yayin = new YayinEylemi();
const kayit = new KayitEylemi();

/** Durum tuşları görünürken OBS durumunu yoklar ve tuş durumunu (0/1) günceller */
async function yokla() {
  if (![...sustur.actions, ...yayin.actions, ...kayit.actions].length) return;
  sonDurum = await studio.durum().catch(() => null);
  const d = sonDurum;
  for (const a of yayin.actions) if (a.isKey()) await a.setState(d?.streaming ? 1 : 0);
  for (const a of kayit.actions) if (a.isKey()) await a.setState(d?.recording ? 1 : 0);
  for (const a of sustur.actions) {
    if (!a.isKey()) continue;
    const giris = ((await a.getSettings()) as SusturAyar).giris;
    await a.setState(d?.inputs.find((i) => i.name === giris)?.muted ? 1 : 0);
  }
}

// Ayar sayfası düğme ve ses girişi listesini ister
streamDeck.ui.onSendToPlugin(async () => {
  const [dugmeler, durum] = await Promise.all([studio.deste().catch(() => []), studio.durum().catch(() => null)]);
  await streamDeck.ui.sendToPropertyInspector({
    dugmeler: dugmeler.map((b) => ({ id: b.id, ad: b.sayfa ? `${b.sayfa} · ${b.label}` : b.label })),
    girisler: (durum?.inputs ?? []).map((i) => i.name),
    baglanti: durum ? "tamam" : "Studio ya da OBS bağlı değil",
  });
});

streamDeck.actions.registerAction(deste);
streamDeck.actions.registerAction(sustur);
streamDeck.actions.registerAction(yayin);
streamDeck.actions.registerAction(kayit);
setInterval(() => void yokla(), 1500);
void streamDeck.connect();
