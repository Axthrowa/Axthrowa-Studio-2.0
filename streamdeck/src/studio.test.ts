import { test } from "node:test";
import assert from "node:assert/strict";
import { desteDugmeleri, OnayKapisi, Studio } from "./studio.ts";

test("deste düz listeye iner, bozuk düğme atlanır", () => {
  const l = desteDugmeleri({
    pages: [
      { name: "Ana", buttons: [{ id: "b1", label: "Tekrar", actionId: "replay.save", params: { x: "1", y: 2 } }, { id: 3 }] },
      { name: "Ses", buttons: [{ id: "b2", label: "", actionId: "audio.toggle", params: { input: "Mic" } }] },
    ],
  });
  assert.deepEqual(l, [
    { id: "b1", label: "Tekrar", actionId: "replay.save", params: { x: "1" }, sayfa: "Ana" },
    { id: "b2", label: "audio.toggle", actionId: "audio.toggle", params: { input: "Mic" }, sayfa: "Ses" },
  ]);
  assert.deepEqual(desteDugmeleri(null), []);
});

test("çalıştır: 200 tamam, 428 onay, diğerleri hata; gövde doğru gider", async () => {
  const giden: unknown[] = [];
  const yanit = [200, 428, 409];
  const s = new Studio("http://127.0.0.1:1", async (_u, init) => {
    giden.push(JSON.parse(init!.body!));
    const status = yanit.shift()!;
    return { ok: status === 200, status, text: async () => (status === 200 ? "{}" : "neden") };
  });
  assert.deepEqual(await s.calistir("stream.start"), { tur: "tamam" });
  assert.deepEqual(await s.calistir("stream.start"), { tur: "onay", mesaj: "neden" });
  assert.deepEqual(await s.calistir("audio.toggle", { input: "Mic" }, true), { tur: "hata", mesaj: "neden" });
  assert.deepEqual(giden[2], { id: "audio.toggle", params: { input: "Mic" }, confirm: true });
});

test("Studio kapalıysa hata döner, atmaz", async () => {
  const s = new Studio("http://127.0.0.1:1", async () => {
    throw new Error("ECONNREFUSED");
  });
  assert.equal((await s.calistir("alert.skip")).tur, "hata");
});

test("onay kapısı: ikinci basış süre içinde onaydır", () => {
  const k = new OnayKapisi(3000);
  assert.equal(k.onaylandi("a", 0), false);
  k.bekle("a", 0);
  assert.equal(k.onaylandi("a", 2000), true);
  assert.equal(k.onaylandi("a", 2100), false);
  k.bekle("a", 0);
  assert.equal(k.onaylandi("a", 5000), false);
});
