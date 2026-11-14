/**
 * Y13: Whisper konuşma tanıma işçisi (transformers.js). Model ilk kullanımda Hugging Face'ten indirilir ve
 * tarayıcı önbelleğinde kalır; ONNX çalışma zamanı dosyaları uygulamanın kendi paketinden gelir (CDN yok).
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import ortMjs from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import ortWasm from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";

export type IsciGiden =
  | { tur: "yukle"; model: string }
  | { tur: "cevir"; id: number; ses: Float32Array; kesin: boolean };
export type IsciGelen =
  | { tur: "ilerleme"; yuklenen: number; toplam: number }
  | { tur: "hazir"; aygit: "webgpu" | "wasm" }
  | { tur: "metin"; id: number; metin: string; kesin: boolean }
  | { tur: "hata"; mesaj: string };

env.allowLocalModels = false;
const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown } };
if (onnx.wasm) onnx.wasm.wasmPaths = { mjs: ortMjs, wasm: ortWasm };

let asr: AutomaticSpeechRecognitionPipeline | null = null;
const gonder = (m: IsciGelen) => postMessage(m);

async function yukle(model: string) {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  const adaptor = gpu ? await gpu.requestAdapter().catch(() => null) : null;
  const webgpu = !!adaptor;
  // fp16 ekran kartında yaklaşık iki kat hızlı ve daha küçük (RTX 5070: 5,8 sn ses ~1 sn); desteklemeyen kart fp32 + q4 kullanır
  const f16 = !!adaptor?.features.has("shader-f16");
  const dosyalar = new Map<string, [number, number]>();
  asr = (await pipeline("automatic-speech-recognition", model, {
    device: webgpu ? "webgpu" : "wasm",
    dtype: !webgpu ? "q8" : f16 ? { encoder_model: "fp16", decoder_model_merged: "fp16" } : { encoder_model: "fp32", decoder_model_merged: "q4" },
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== "progress" || !p.file) return;
      dosyalar.set(p.file, [p.loaded ?? 0, p.total ?? 0]);
      let y = 0;
      let t = 0;
      for (const [a, b] of dosyalar.values()) (y += a), (t += b);
      gonder({ tur: "ilerleme", yuklenen: y, toplam: t });
    },
  })) as AutomaticSpeechRecognitionPipeline;
  gonder({ tur: "hazir", aygit: webgpu ? "webgpu" : "wasm" });
}

onmessage = async (e: MessageEvent<IsciGiden>) => {
  const m = e.data;
  try {
    if (m.tur === "yukle") await yukle(m.model);
    else if (asr) {
      // 8 sn konuşma ~60 belirteç: sınır, Whisper'ın tekrar döngüsünü (aynı kelimeyi yüzlerce kez yazma) saniyeler sürmeden keser
      const r = (await asr(m.ses, { language: "turkish", task: "transcribe", max_new_tokens: 96, no_repeat_ngram_size: 4 } as never)) as { text: string };
      gonder({ tur: "metin", id: m.id, metin: r.text, kesin: m.kesin });
    }
  } catch (err) {
    gonder({ tur: "hata", mesaj: String((err as Error)?.message || err).slice(0, 300) });
  }
};
