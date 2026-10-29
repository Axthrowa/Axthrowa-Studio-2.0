/**
 * "Discord'u Bağla": Premium lisansı olan yayıncı, AxthrowA Discord sunucusunda Premium Yayıncı rolünü alır.
 * Düğme sitenin Discord sayfasını tarayıcıda açar (Rust `discord_bagla`: lisans anahtarı arayüze hiç gelmez);
 * Discord girişi ve rol sitede tamamlanır. Lisans yoksa ya da derlemede site adresi yoksa kart görünmez.
 */
import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { WidgetCard } from "./WidgetCard";
import { Button } from "./Button";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";

function DiscordIkonu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19.6 5.3A17 17 0 0 0 15.4 4l-.5 1a15.7 15.7 0 0 0-5.8 0L8.6 4a17 17 0 0 0-4.2 1.3C1.7 9.3 1 13.2 1.3 17a17.2 17.2 0 0 0 5.2 2.6l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12.2 12.2 0 0 0 11.4 0l.4.3a11 11 0 0 1-1.7.8l1.1 1.8a17.1 17.1 0 0 0 5.2-2.6c.4-4.4-.7-8.2-3.1-11.7ZM8.5 14.7c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Zm7 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Z" />
    </svg>
  );
}

export default function DiscordKarti() {
  const lisans = useAxthrowaStore((s) => s.lisans);
  const [kullanilabilir, setKullanilabilir] = useState(false);
  const [mesaj, setMesaj] = useState("");

  useEffect(() => {
    if (isTauri()) void invoke<boolean>("discord_kullanilabilir").then(setKullanilabilir).catch(() => {});
  }, []);

  if (!kullanilabilir || !lisans) return null;

  async function bagla() {
    setMesaj("");
    try {
      await invoke("discord_bagla");
      setMesaj("Tarayıcıda açıldı: Discord ile giriş yapın, rolünüz verilecek.");
    } catch (e) {
      setMesaj(String(e));
    }
  }

  return (
    <WidgetCard
      title="Discord topluluğu"
      description="Premium lisansınızla AxthrowA Discord sunucusunda Premium Yayıncı rolünü alın."
      icon={<DiscordIkonu className="h-5 w-5 text-[#5865F2]" />}
      action={
        <Button
          onClick={() => void bagla()}
          className="bg-[#5865F2] shadow-[0_0_20px_rgba(88,101,242,0.45)] hover:brightness-110"
        >
          <DiscordIkonu className="h-4 w-4" />
          Discord'u Bağla
        </Button>
      }
    >
      {mesaj ? <p className="text-xs text-zinc-400">{mesaj}</p> : null}
    </WidgetCard>
  );
}
