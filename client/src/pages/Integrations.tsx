/**
 * StreamAxT — Entegrasyonlar
 * Developed by AxthrowA
 *
 * Üç iş bir arada: dışarı duyuru, dışarıdan içe aktarma, yedek alma.
 *
 *  • Discord duyuruları — BotRix'te `/panel/integrations` bir platform
 *    bağlantısı değil, Discord duyuru otomasyonudur (BOTRIX_UI_INVENTORY §8).
 *  • Nightbot içe aktarma — BotRix `Sohbet Botu > Ekstralar` (§6.4). Yeni
 *    gelen kullanıcı komutlarını kaybetmesin.
 *  • Uyarı yedeği — BotRix'te ayarlar hesapta durur; bizde her şey yerel
 *    SQLite'ta olduğu için makine değişiminde emek kaybolmasın diye
 *    dışa/içe aktarma eklendi.
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Play, Plug, Save, Send, Upload } from 'lucide-react';
import {
  Alan,
  AlanMetni,
  Anahtar,
  Buton,
  Girdi,
  HataDurumu,
  Iskelet,
  Kart,
  Secim,
  useOnay,
  useToast
} from '../ui/index.js';

type Sekme = 'discord' | 'nightbot' | 'yedek';

const SEKMELER: Array<{ id: Sekme; etiket: string }> = [
  { id: 'discord', etiket: 'Discord Duyuruları' },
  { id: 'nightbot', etiket: "Nightbot'tan İçe Aktar" },
  { id: 'yedek', etiket: 'Uyarı Yedeği' }
];

const KAYNAKLAR: Array<{ id: string; etiket: string; renk: string }> = [
  { id: 'kick', etiket: 'Kick', renk: 'text-[#53fc18]' },
  { id: 'twitch', etiket: 'Twitch', renk: 'text-purple-400' },
  { id: 'youtube', etiket: 'YouTube', renk: 'text-red-400' },
  { id: 'tiktok', etiket: 'TikTok', renk: 'text-pink-400' }
];

async function al<T>(yol: string): Promise<T> {
  const r = await fetch(yol);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function yolla<T>(yol: string, govde: unknown): Promise<T> {
  const r = await fetch(yol, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(govde)
  });
  const veri = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String((veri as any)?.hata || (veri as any)?.error || r.status));
  return veri as T;
}

/** Dosya seçtirip metnini okur. */
function dosyaOku(kabul: string): Promise<{ ad: string; metin: string } | null> {
  return new Promise((coz) => {
    const g = document.createElement('input');
    g.type = 'file';
    g.accept = kabul;
    g.onchange = () => {
      const d = g.files?.[0];
      if (!d) return coz(null);
      const okuyucu = new FileReader();
      okuyucu.onload = () => coz({ ad: d.name, metin: String(okuyucu.result || '') });
      okuyucu.onerror = () => coz(null);
      okuyucu.readAsText(d);
    };
    g.click();
  });
}

// ---------------------------------------------------------------- Discord ---

function DiscordPaneli() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [a, setA] = useState<any>(null);
  const [hata, setHata] = useState('');
  const [kanal, setKanal] = useState('');

  const yukle = () =>
    al<any>('/api/integrations/discord')
      .then((x) => {
        setA(x);
        setHata('');
      })
      .catch(() => setHata('Discord ayarları okunamadı.'));

  useEffect(() => {
    yukle();
  }, []);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!a) return <Iskelet satir={6} />;

  const duzenle = (k: string, yama: any) => setA({ ...a, [k]: { ...a[k], ...yama } });

  const kaydet = async () => {
    try {
      // Sunucu maskeli webhook'u "değişmedi" sayar; boş bırakmak mevcut
      // adresi SİLMEZ, korur (yeniSirDegeri).
      const y = await yolla<any>('/api/integrations/discord', a);
      setA(y);
      toast('Discord ayarları kaydedildi.', 'basari');
    } catch (e: any) {
      toast(String(e.message), 'hata');
    }
  };

  const testGonder = (kaynak: string) =>
    sor(
      'Discord’a gerçek bir test mesajı gönderilsin mi?',
      'Sunucunuzdaki kanala görünür bir mesaj düşer ve etiket ayarınız uygulanır. Bekleme süresi atlanır.',
      async () => {
        try {
          const r = await yolla<any>('/api/integrations/discord/test', { kaynak, kanal: kanal || 'kanal' });
          toast(r.ok ? 'Test mesajı gönderildi.' : `Gönderilemedi: ${r.hata}`, r.ok ? 'basari' : 'hata');
        } catch (e: any) {
          toast(String(e.message), 'hata');
        }
      },
      false
    );

  return (
    <div className="space-y-3">
      {eleman}

      <Kart
        baslik="Nasıl çalışır?"
        aciklama="Discord botunu sunucunuza eklemeye gerek yok — kanal ayarlarından bir webhook adresi alıp yapıştırmanız yeterli."
      >
        <ol className="text-[11px] text-gray-400 space-y-1 list-decimal list-inside">
          <li>Discord’da kanal → Ayarlar → Entegrasyonlar → Webhook’lar → Yeni Webhook</li>
          <li>“Webhook URL’sini kopyala” deyin ve aşağıdaki ilgili platforma yapıştırın</li>
          <li>Yayına başlayınca duyuru otomatik gider; test düğmesi beklemeyi atlar</li>
        </ol>
        <Alan etiket="Test için kanal adı" ipucu="$(channel) değişkeni bununla doldurulur">
          <Girdi value={kanal} onChange={(e) => setKanal(e.target.value)} placeholder="kanal_adiniz" />
        </Alan>
      </Kart>

      {KAYNAKLAR.map((k) => {
        const kural = a[k.id] || {};
        return (
          <Kart
            key={k.id}
            baslik={k.etiket}
            aciklama={kural.aktif ? 'Yayına başlayınca duyuru gider.' : 'Kapalı — duyuru gönderilmez.'}
            sag={
              <Anahtar
                acik={!!kural.aktif}
                etiket={kural.aktif ? 'Açık' : 'Kapalı'}
                onChange={(v) => duzenle(k.id, { aktif: v })}
              />
            }
          >
            <Alan
              etiket="Webhook adresi"
              ipucu="Kayıtlı adres maskeli gösterilir; boş bırakırsanız mevcut adres korunur."
            >
              <Girdi
                value={kural.webhook || ''}
                onChange={(e) => duzenle(k.id, { webhook: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                autoComplete="off"
                spellCheck={false}
              />
            </Alan>

            <Alan etiket="Mesaj şablonu" ipucu="Tam değişken motoru çalışır: $(channel), $(platformUrl), $(time)…">
              <AlanMetni value={kural.sablon || ''} onChange={(e) => duzenle(k.id, { sablon: e.target.value })} />
            </Alan>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Alan etiket="Bekleme (dakika)" ipucu="Aynı yayın için tekrar tekrar duyurmasın">
                <Girdi
                  type="number"
                  min={0}
                  value={kural.beklemeDk ?? 60}
                  onChange={(e) => duzenle(k.id, { beklemeDk: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Alan>
              <Alan etiket="Etiket" ipucu="Kapalıyken şablonda @everyone yazsa bile ping ATILMAZ">
                <Secim
                  value={kural.etiket || 'yok'}
                  onChange={(e) => duzenle(k.id, { etiket: e.target.value })}
                  secenekler={[
                    { value: 'yok', label: 'Etiketleme' },
                    { value: 'here', label: '@here' },
                    { value: 'everyone', label: '@everyone' }
                  ]}
                />
              </Alan>
            </div>

            <Buton ton="ikincil" ikon={<Send className="w-3.5 h-3.5" />} onClick={() => testGonder(k.id)}>
              Test duyurusu gönder
            </Buton>
          </Kart>
        );
      })}

      <Buton ikon={<Save className="w-3.5 h-3.5" />} onClick={kaydet}>
        Tümünü kaydet
      </Buton>
    </div>
  );
}

// --------------------------------------------------------------- Nightbot ---

function NightbotPaneli() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [metin, setMetin] = useState('');
  const [dosyaAdi, setDosyaAdi] = useState('');
  const [uzerineYaz, setUzerineYaz] = useState(false);
  const [sonuc, setSonuc] = useState<any>(null);

  const aktar = () => {
    let veri: any;
    try {
      veri = JSON.parse(metin);
    } catch {
      return toast('Geçerli bir JSON değil.', 'hata');
    }

    const calistir = async () => {
      try {
        const r = await yolla<any>('/api/integrations/nightbot/import', { veri, uzerineYaz });
        setSonuc(r);
        toast(`${r.komut.eklenen} komut, ${r.zamanlayici.eklenen} zamanlayıcı aktarıldı.`, 'basari');
      } catch (e: any) {
        toast(String(e.message), 'hata');
      }
    };

    if (uzerineYaz) {
      sor(
        'Aynı adlı komutların üzerine yazılsın mı?',
        'Mevcut komutlarınızın yanıtı, yetki seviyesi ve bekleme süresi Nightbot verisiyle değiştirilir.',
        calistir
      );
    } else {
      void calistir();
    }
  };

  return (
    <div className="space-y-3">
      {eleman}

      <Kart
        baslik="Nightbot verisini içe aktar"
        aciklama="Komutlar ve zamanlayıcılar taşınır. Değişken sözdizimi büyük ölçüde aynıdır; farklı olanlar otomatik çevrilir."
      >
        <div className="flex flex-wrap gap-2">
          <Buton
            ton="ikincil"
            ikon={<Upload className="w-3.5 h-3.5" />}
            onClick={async () => {
              const d = await dosyaOku('application/json,.json');
              if (!d) return;
              setMetin(d.metin);
              setDosyaAdi(d.ad);
            }}
          >
            JSON dosyası seç
          </Buton>
          {dosyaAdi && <span className="text-[11px] text-gray-400 self-center">{dosyaAdi}</span>}
        </div>

        <Alan etiket="Ya da JSON’u buraya yapıştırın" ipucu='Biçim: { "commands": [...], "timers": [...] } veya doğrudan komut dizisi'>
          <AlanMetni
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            className="min-h-[160px] font-mono text-[11px]"
            placeholder='{ "commands": [ { "name": "!merhaba", "message": "Selam $(user)!" } ] }'
            spellCheck={false}
          />
        </Alan>

        <Anahtar
          acik={uzerineYaz}
          etiket="Aynı adlı mevcut komutların üzerine yaz"
          onChange={setUzerineYaz}
        />

        <Buton ikon={<Play className="w-3.5 h-3.5" />} disabled={!metin.trim()} onClick={aktar}>
          İçe aktar
        </Buton>
      </Kart>

      {sonuc && (
        <Kart baslik="Sonuç">
          <ul className="text-xs text-gray-300 space-y-1">
            <li>
              Komut: <b className="text-white">{sonuc.komut.eklenen}</b> aktarıldı ·{' '}
              <b className="text-white">{sonuc.komut.atlanan}</b> atlandı
            </li>
            <li>
              Zamanlayıcı: <b className="text-white">{sonuc.zamanlayici.eklenen}</b> aktarıldı ·{' '}
              <b className="text-white">{sonuc.zamanlayici.atlanan}</b> atlandı
            </li>
          </ul>

          {sonuc.komut.atlananlar?.length > 0 && (
            <p className="text-[11px] text-gray-500">Atlananlar: {sonuc.komut.atlananlar.join(', ')}</p>
          )}

          {sonuc.uyarilar?.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-white/10">
              {sonuc.uyarilar.map((u: string, i: number) => (
                <p key={i} className="text-[11px] text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {u}
                </p>
              ))}
            </div>
          )}
        </Kart>
      )}

      <Kart baslik="Değişken eşlemesi">
        <ul className="text-[11px] text-gray-400 space-y-1">
          <li>
            <code>$(user)</code> → <code className="text-purple-300">$(sender)</code>
          </li>
          <li>
            <code>$(touser)</code> → <code className="text-purple-300">$(toname)</code>
          </li>
          <li>
            <code>$(query)</code> → <code className="text-purple-300">$(variable)</code>
          </li>
          <li>
            <code>$(querystring)</code> → <code className="text-purple-300">$(urlencode $(variable))</code>
          </li>
          <li>
            <code>$(eval …)</code> → <code className="text-purple-300">$(math …)</code>
          </li>
          <li className="text-gray-500">
            Karşılığı olmayanlar (<code>$(weather)</code>, <code>$(twitch)</code>, <code>$(customapi)</code>) sessizce
            bozuk bırakılmaz — sonuç ekranında uyarı olarak listelenir.
          </li>
        </ul>
      </Kart>
    </div>
  );
}

// ------------------------------------------------------------ Uyarı yedeği --

function YedekPaneli() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [sonuc, setSonuc] = useState<any>(null);
  const [uzerineYaz, setUzerineYaz] = useState(false);
  const indirBag = useRef<HTMLAnchorElement | null>(null);

  const disaAktar = async () => {
    try {
      const yedek = await al<any>('/api/alerts/backup');
      const url = URL.createObjectURL(new Blob([JSON.stringify(yedek, null, 2)], { type: 'application/json' }));
      const a = indirBag.current!;
      a.href = url;
      a.download = `streamaxt-uyarilar-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`${yedek.presets.length} uyarı, ${yedek.varyantlar.length} varyant indirildi.`, 'basari');
    } catch {
      toast('Yedek alınamadı.', 'hata');
    }
  };

  const iceAktar = async () => {
    const d = await dosyaOku('application/json,.json');
    if (!d) return;

    let veri: any;
    try {
      veri = JSON.parse(d.metin);
    } catch {
      return toast('Geçerli bir JSON değil.', 'hata');
    }

    sor(
      'Uyarı yedeği geri yüklensin mi?',
      uzerineYaz
        ? 'Aynı olay türündeki mevcut uyarılarınız yedektekiyle DEĞİŞTİRİLİR.'
        : 'Mevcut uyarılarınız korunur, yalnız eksikler eklenir.',
      async () => {
        try {
          const r = await yolla<any>('/api/alerts/backup/import', { veri, uzerineYaz });
          setSonuc(r);
          toast('Yedek geri yüklendi.', 'basari');
        } catch (e: any) {
          toast(String(e.message), 'hata');
        }
      },
      uzerineYaz
    );
  };

  return (
    <div className="space-y-3">
      {eleman}
      {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
      <a ref={indirBag} className="hidden" />

      <Kart
        baslik="Uyarı ayarlarını yedekle"
        aciklama="Alert preset’leri, varyantlar ve Alert Box gelişmiş ayarları tek bir JSON dosyasına yazılır."
      >
        <p className="text-[11px] text-gray-400">
          Dosyanın içinde <b>şifre, token veya webhook adresi bulunmaz</b> — paylaşmak güvenlidir. Yerel medya
          kütüphanesinden gelen görsel ve sesler dosyaya <b>gömülmez</b>; başka bir bilgisayarda onları yeniden
          yüklemeniz gerekir.
        </p>
        <Buton ikon={<Download className="w-3.5 h-3.5" />} onClick={disaAktar}>
          Yedeği indir
        </Buton>
      </Kart>

      <Kart baslik="Yedeği geri yükle">
        <Anahtar
          acik={uzerineYaz}
          etiket="Aynı olaydaki mevcut uyarıların üzerine yaz"
          onChange={setUzerineYaz}
        />
        <p className="text-[11px] text-gray-500">
          Varyantlar her durumda <b>eklenir</b>; geri yükleme mevcut varyantlarınızı silmez.
        </p>
        <Buton ton="ikincil" ikon={<Upload className="w-3.5 h-3.5" />} onClick={iceAktar}>
          Yedek dosyası seç
        </Buton>
      </Kart>

      {sonuc && (
        <Kart baslik="Sonuç">
          <ul className="text-xs text-gray-300 space-y-1">
            <li>
              Uyarı: <b className="text-white">{sonuc.preset.eklenen}</b> eklendi ·{' '}
              <b className="text-white">{sonuc.preset.guncellenen}</b> güncellendi ·{' '}
              <b className="text-white">{sonuc.preset.atlanan}</b> atlandı
            </li>
            <li>
              Varyant: <b className="text-white">{sonuc.varyant.eklenen}</b> eklendi ·{' '}
              <b className="text-white">{sonuc.varyant.atlanan}</b> atlandı
            </li>
            <li>Gelişmiş ayarlar: {sonuc.gelismis ? 'uygulandı' : 'yedekte yoktu'}</li>
          </ul>

          {sonuc.uyarilar?.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-white/10">
              {sonuc.uyarilar.map((u: string, i: number) => (
                <p key={i} className="text-[11px] text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {u}
                </p>
              ))}
            </div>
          )}
        </Kart>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Sayfa ---

export function Integrations() {
  const [sekme, setSekme] = useState<Sekme>('discord');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Plug className="w-6 h-6 text-purple-400" /> Entegrasyonlar
        </h1>
        <p className="text-sm text-gray-400">
          Discord duyuruları, Nightbot’tan taşıma ve uyarı ayarlarının yedeği.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded-xl">
        {SEKMELER.map((s) => (
          <button
            key={s.id}
            onClick={() => setSekme(s.id)}
            className={`px-3 py-2 rounded-lg text-xs font-bold ${
              sekme === s.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {s.etiket}
          </button>
        ))}
      </div>

      {sekme === 'discord' && <DiscordPaneli />}
      {sekme === 'nightbot' && <NightbotPaneli />}
      {sekme === 'yedek' && <YedekPaneli />}
    </div>
  );
}

export default Integrations;
