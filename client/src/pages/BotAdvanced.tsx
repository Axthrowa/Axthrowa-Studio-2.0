/**
 * AxBoT — Gelişmiş Bot Ayarları
 * Developed by AxthrowA
 *
 * Bu turda sunucuya eklenen sistemlerin panel karşılığı. Hepsi API uçları
 * hazır olduğu hâlde arayüzsüzdü — kullanıcı için görünmez demekti:
 *   • Seviye / XP sistemi          (/api/levels)
 *   • TTS filtreleri               (/api/tts/filters)
 *   • Sohbet tarafı olay mesajları (/api/chat-alerts)
 *   • Moderasyon ihlal eylemleri   (/api/automod + /api/platforms/capabilities)
 *   • Değişken kataloğu            (/api/variables)
 */
import { useEffect, useState } from 'react';
import { Save, RotateCcw, Play, Search, Trash2 } from 'lucide-react';
import {
  Alan,
  AlanMetni,
  Anahtar,
  Buton,
  BosDurum,
  Girdi,
  HataDurumu,
  Iskelet,
  Kart,
  Secim,
  useOnay,
  useToast
} from '../ui/index.js';

type Sekme = 'levels' | 'stats' | 'tts' | 'chatAlerts' | 'moderation' | 'variables';

const SEKMELER: Array<{ id: Sekme; etiket: string }> = [
  { id: 'levels', etiket: 'Seviye / XP' },
  { id: 'stats', etiket: 'İstatistikler' },
  { id: 'tts', etiket: 'TTS Filtreleri' },
  { id: 'chatAlerts', etiket: 'Sohbet Uyarıları' },
  { id: 'moderation', etiket: 'Moderasyon Eylemleri' },
  { id: 'variables', etiket: 'Değişkenler' }
];

async function al<T>(yol: string): Promise<T> {
  const r = await fetch(yol);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function yolla<T>(yol: string, govde: unknown): Promise<T> {
  const r = await fetch(yol, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(govde)
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// ---------------------------------------------------------------- Seviye ----

function SeviyePaneli() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [a, setA] = useState<any>(null);
  const [siralama, setSiralama] = useState<any[]>([]);
  const [hata, setHata] = useState('');

  const yukle = () => {
    Promise.all([al<any>('/api/levels/settings'), al<any[]>('/api/levels/leaderboard?limit=10')])
      .then(([ayar, liste]) => {
        setA(ayar);
        setSiralama(liste);
        setHata('');
      })
      .catch(() => setHata('Seviye ayarları yüklenemedi.'));
  };
  useEffect(yukle, []);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!a) return <Iskelet satir={5} />;

  const sayi = (k: string) => (v: string) => setA({ ...a, [k]: Math.max(0, Number(v) || 0) });

  return (
    <div className="space-y-3">
      {eleman}
      <Kart
        baslik="Seviye sistemi"
        aciklama="XP puandan ayrıdır: puan harcanır, XP harcanmaz. Böylece mağazadan alışveriş yapan izleyici seviyesini kaybetmez."
        sag={<Anahtar acik={!!a.aktif} onChange={(v) => setA({ ...a, aktif: v })} etiket={a.aktif ? 'Açık' : 'Kapalı'} />}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Alan etiket="Mesaj başına XP" ipucu="Bekleme süresi spam'i engeller">
            <Girdi type="number" value={a.mesajXp} onChange={(e) => sayi('mesajXp')(e.target.value)} />
          </Alan>
          <Alan etiket="Mesaj XP bekleme (sn)">
            <Girdi type="number" value={a.mesajBeklemeSn} onChange={(e) => sayi('mesajBeklemeSn')(e.target.value)} />
          </Alan>
          <Alan etiket="Abone XP">
            <Girdi type="number" value={a.aboneXp} onChange={(e) => sayi('aboneXp')(e.target.value)} />
          </Alan>
          <Alan etiket="Hediye abone XP">
            <Girdi type="number" value={a.hediyeAboneXp} onChange={(e) => sayi('hediyeAboneXp')(e.target.value)} />
          </Alan>
          <Alan etiket="Bağış XP" ipucu={`Her ${a.bagisBirimi} birim için`}>
            <Girdi type="number" value={a.bagisXp} onChange={(e) => sayi('bagisXp')(e.target.value)} />
          </Alan>
          <Alan etiket="Bağış birimi">
            <Girdi type="number" value={a.bagisBirimi} onChange={(e) => sayi('bagisBirimi')(e.target.value)} />
          </Alan>
          <Alan etiket="Seviye 1 maliyeti (XP)">
            <Girdi type="number" value={a.tabanXp} onChange={(e) => sayi('tabanXp')(e.target.value)} />
          </Alan>
          <Alan etiket="Büyüme katsayısı" ipucu="Her seviye bu katla zorlaşır">
            <Girdi
              type="number"
              step="0.05"
              value={a.buyume}
              onChange={(e) => setA({ ...a, buyume: Math.max(1, Number(e.target.value) || 1) })}
            />
          </Alan>
          <Alan etiket="Maksimum seviye">
            <Girdi type="number" value={a.maksSeviye} onChange={(e) => sayi('maksSeviye')(e.target.value)} />
          </Alan>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Buton
            ikon={<Save className="w-3.5 h-3.5" />}
            onClick={() =>
              yolla('/api/levels/settings', a)
                .then(() => toast('Seviye ayarları kaydedildi.', 'basari'))
                .catch(() => toast('Kaydedilemedi.', 'hata'))
            }
          >
            Kaydet
          </Buton>
          <Buton
            ton="tehlike"
            ikon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() =>
              sor(
                'Tüm seviyeler sıfırlansın mı?',
                'Her izleyicinin XP ve seviyesi sıfırlanır. Puanlara dokunulmaz. Bu işlem geri alınamaz.',
                () =>
                  yolla('/api/levels/reset', { neyi: 'xp' })
                    .then((r: any) => {
                      toast(`${r.etkilenen} kullanıcının seviyesi sıfırlandı.`, 'basari');
                      yukle();
                    })
                    .catch(() => toast('Sıfırlanamadı.', 'hata'))
              )
            }
          >
            Seviyeleri sıfırla
          </Buton>
        </div>
      </Kart>

      <Kart baslik="Seviye sıralaması" aciklama="İlk 10">
        {siralama.length === 0 ? (
          <BosDurum baslik="Henüz XP kazanan yok" aciklama="Sohbete mesaj geldikçe burada görünecek." />
        ) : (
          <div className="space-y-1">
            {siralama.map((u, i) => (
              <div key={u.username} className="flex items-center justify-between text-xs text-gray-200">
                <span>
                  {i + 1}. {u.displayName}
                </span>
                <span className="font-mono text-cyan-300">
                  Sv.{u.seviye} · {u.buSeviyedeXp}/{u.sonrakiIcinXp} XP
                </span>
              </div>
            ))}
          </div>
        )}
      </Kart>
    </div>
  );
}

// ------------------------------------------------------------------- TTS ----

function IstatistikPaneli() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [gruplar, setGruplar] = useState<Array<{ id: string; ad: string; aciklama: string; kayit: number }> | null>(null);
  const [hata, setHata] = useState('');

  const yukle = () =>
    al<NonNullable<typeof gruplar>>('/api/istatistikler')
      .then((g) => {
        setGruplar(g);
        setHata('');
      })
      .catch((e) => setHata(String(e?.message || e)));

  useEffect(() => {
    void yukle();
  }, []);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!gruplar) return <Iskelet satir={6} />;

  return (
    <Kart baslik="Tutulan istatistikler" aciklama="Her satır ayrı silinir. Silinen veri geri gelmez.">
      {eleman}
      <div className="space-y-2">
        {gruplar.map((g) => (
          <div key={g.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                {g.ad} <span className="ml-1 font-mono text-xs font-normal text-gray-400">{g.kayit} kayıt</span>
              </p>
              <p className="text-xs text-gray-400">{g.aciklama}</p>
            </div>
            <Buton
              ton="tehlike"
              disabled={g.kayit === 0}
              ikon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() =>
                sor(`${g.ad} silinsin mi?`, `${g.aciklama} Bu işlem geri alınamaz.`, () =>
                  yolla<{ gruplar: NonNullable<typeof gruplar> }>('/api/istatistikler/sil', { grup: g.id })
                    .then((r) => {
                      setGruplar(r.gruplar);
                      toast(`${g.ad} silindi.`, 'basari');
                    })
                    .catch(() => toast('Silinemedi.', 'hata'))
                )
              }
            >
              Sil
            </Buton>
          </div>
        ))}
      </div>
    </Kart>
  );
}

function TtsPaneli() {
  const toast = useToast();
  const [f, setF] = useState<any>(null);
  const [hata, setHata] = useState('');

  const yukle = () =>
    al<any>('/api/tts/filters')
      .then((d) => {
        setF(d);
        setHata('');
      })
      .catch(() => setHata('TTS filtreleri yüklenemedi.'));
  useEffect(() => {
    yukle();
  }, []);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!f) return <Iskelet satir={6} />;

  const anahtar = (k: string, etiket: string, ipucu?: string) => (
    <div className="flex items-start justify-between gap-2 bg-black/20 rounded-lg px-3 py-2">
      <div>
        <div className="text-[11px] font-bold text-gray-200">{etiket}</div>
        {ipucu && <div className="text-[10px] text-gray-500">{ipucu}</div>}
      </div>
      <Anahtar acik={!!f[k]} onChange={(v) => setF({ ...f, [k]: v })} />
    </div>
  );

  return (
    <div className="space-y-3">
      <Kart
        baslik="Neler okunsun?"
        aciklama="Önceden sohbete yazılan her şey olduğu gibi okunuyordu — link ve emoji dahil."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {anahtar('linkleriOku', 'Linkleri oku', 'Kapalıyken adres yerine "bağlantı" denir')}
          {anahtar('emojileriOku', 'Emojileri oku')}
          {anahtar('sayilariOku', 'Sayıları oku')}
          {anahtar('sembolleriOku', 'Sembolleri oku', 'Noktalama her durumda korunur')}
          {anahtar('tekrarlariKisalt', 'Tekrarları kısalt', '"aaaaaa" → "aa"')}
        </div>
      </Kart>

      <Kart baslik="Sınırlar">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Alan etiket="Karakter sınırı" ipucu="0 = sınırsız">
            <Girdi
              type="number"
              value={f.karakterSiniri}
              onChange={(e) => setF({ ...f, karakterSiniri: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Alan>
          <Alan etiket="En kısa mesaj">
            <Girdi
              type="number"
              value={f.minUzunluk}
              onChange={(e) => setF({ ...f, minUzunluk: Math.max(1, Number(e.target.value) || 1) })}
            />
          </Alan>
          <Alan etiket="Bekleme (sn)" ipucu="Kullanıcı başına">
            <Girdi
              type="number"
              value={f.beklemeSn}
              onChange={(e) => setF({ ...f, beklemeSn: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Alan>
          <Alan etiket="Minimum rol">
            <Secim
              value={f.minRol}
              onChange={(e) => setF({ ...f, minRol: e.target.value })}
              secenekler={[
                { value: 'everyone', label: 'Herkes' },
                { value: 'sub', label: 'Abone' },
                { value: 'vip', label: 'VIP' },
                { value: 'og', label: 'OG' },
                { value: 'mod', label: 'Moderatör' },
                { value: 'broadcaster', label: 'Yayıncı' }
              ]}
            />
          </Alan>
        </div>
      </Kart>

      <Kart baslik="Metin ve listeler">
        <Alan etiket="Okuma şablonu" ipucu="{user} ve {message} kullanılabilir">
          <Girdi value={f.sablon} onChange={(e) => setF({ ...f, sablon: e.target.value })} />
        </Alan>
        <Alan etiket="Kara liste" ipucu="Virgülle ayırın; bu kelimeleri içeren mesaj hiç okunmaz">
          <AlanMetni
            value={(f.karaListe || []).join(', ')}
            onChange={(e) => setF({ ...f, karaListe: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
          />
        </Alan>
        <Alan etiket="Engelli kullanıcılar" ipucu="Virgülle ayırın">
          <AlanMetni
            value={(f.engelliKullanicilar || []).join(', ')}
            onChange={(e) =>
              setF({ ...f, engelliKullanicilar: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })
            }
          />
        </Alan>
        <Buton
          ikon={<Save className="w-3.5 h-3.5" />}
          onClick={() =>
            yolla('/api/tts/filters', f)
              .then(() => toast('TTS filtreleri kaydedildi.', 'basari'))
              .catch(() => toast('Kaydedilemedi.', 'hata'))
          }
        >
          Kaydet
        </Buton>
      </Kart>
    </div>
  );
}

// ---------------------------------------------------------- Sohbet uyarı ----

const OLAY_ADLARI: Record<string, string> = {
  follow: 'Takip',
  sub: 'Abonelik',
  resub: 'Yeniden abonelik',
  gift_sub: 'Hediye abonelik',
  tip: 'Bağış',
  kicks: 'KICKs',
  host: 'Host',
  raid: 'Raid',
  welcome: 'Karşılama (ilk kez yazan)',
  stream_online: 'Yayın başladı (sohbete duyuru)'
};

const ESIK_ETIKETI: Record<string, string> = {
  tip: 'Minimum tutar',
  kicks: 'Minimum KICKs',
  host: 'Minimum izleyici',
  raid: 'Minimum izleyici',
  gift_sub: 'Minimum adet',
  resub: 'Minimum ay'
};

/** Temalı mesajlar: Star Wars, Harry Potter… — her olayda farklı mesaj */
function TemaSecici() {
  const toast = useToast();
  const [d, setD] = useState<{ tema: string; temalar: Record<string, string>; ornekler: Record<string, Record<string, string[]>> } | null>(null);
  useEffect(() => {
    al<any>('/api/chat-alerts/tema').then(setD).catch(() => {});
  }, []);
  if (!d) return null;
  const ornek = d.tema !== 'yok' && d.tema !== 'karisik' ? d.ornekler[d.tema] : null;
  return (
    <Kart
      baslik="Temalı eğlenceli mesajlar"
      aciklama="Bir tema seçince her olayda o temadan FARKLI bir mesaj gider (aynısı art arda gelmez). 'Tema yok' seçiliyse aşağıdaki kendi şablonların ve ek mesajların kullanılır. Olayların açık/kapalı ve eşik ayarları her iki durumda da geçerlidir."
    >
      <select
        value={d.tema}
        onChange={(e) =>
          yolla<any>('/api/chat-alerts/tema', { tema: e.target.value })
            .then((r) => {
              setD({ ...d, tema: r.tema });
              toast('Tema kaydedildi.', 'basari');
            })
            .catch(() => toast('Kaydedilemedi.', 'hata'))
        }
        className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-sm"
      >
        {Object.entries(d.temalar).map(([id, ad]) => (
          <option key={id} value={id}>
            {ad}
          </option>
        ))}
      </select>
      {ornek && (
        <div className="mt-3 space-y-1 text-[11px] text-gray-300 max-h-48 overflow-y-auto">
          {Object.entries(OLAY_ADLARI).map(([olay, ad]) => (
            <p key={olay}>
              <b className="text-gray-400">{ad}:</b> {ornek[olay]?.[0]}
            </p>
          ))}
        </div>
      )}
    </Kart>
  );
}

function SohbetUyariPaneli() {
  const toast = useToast();
  const [k, setK] = useState<any>(null);
  const [hata, setHata] = useState('');

  const yukle = () =>
    al<any>('/api/chat-alerts')
      .then((d) => {
        setK(d);
        setHata('');
      })
      .catch(() => setHata('Sohbet uyarıları yüklenemedi.'));
  useEffect(() => {
    yukle();
  }, []);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!k) return <Iskelet satir={6} />;

  return (
    <div className="space-y-3">
      <TemaSecici />
      <Kart
        baslik="Sohbete yazılan olay mesajları"
        aciklama="Görsel overlay'den bağımsızdır: olay olduğunda bot sohbete metin yazar. Şablonlarda tüm değişkenler çalışır."
      >
        <div className="space-y-2">
          {Object.keys(OLAY_ADLARI).map((olay) => {
            const kural = k[olay];
            if (!kural) return null;
            return (
              <div key={olay} className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white">{OLAY_ADLARI[olay]}</span>
                  <Anahtar
                    acik={!!kural.aktif}
                    onChange={(v) => setK({ ...k, [olay]: { ...kural, aktif: v } })}
                    etiket={kural.aktif ? 'Açık' : 'Kapalı'}
                  />
                </div>
                <Girdi
                  value={kural.sablon}
                  onChange={(e) => setK({ ...k, [olay]: { ...kural, sablon: e.target.value } })}
                  placeholder="$(sender) ..."
                />
                <AlanMetni
                  value={(kural.varyantlar || []).join('\n')}
                  onChange={(e) => setK({ ...k, [olay]: { ...kural, varyantlar: e.target.value.split('\n') } })}
                  placeholder="Ek mesajlar (her satıra bir tane) — olay her geldiğinde bunlardan biri rastgele seçilir"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  {ESIK_ETIKETI[olay] && (
                    <Alan etiket={ESIK_ETIKETI[olay]} ipucu="Altındaysa mesaj gönderilmez">
                      <Girdi
                        type="number"
                        value={kural.minDeger}
                        onChange={(e) =>
                          setK({ ...k, [olay]: { ...kural, minDeger: Math.max(0, Number(e.target.value) || 0) } })
                        }
                      />
                    </Alan>
                  )}
                  <Alan etiket="Bekleme (sn)" ipucu="Art arda mesaj yağmasını engeller">
                    <Girdi
                      type="number"
                      value={kural.beklemeSn}
                      onChange={(e) =>
                        setK({ ...k, [olay]: { ...kural, beklemeSn: Math.max(0, Number(e.target.value) || 0) } })
                      }
                    />
                  </Alan>
                </div>
              </div>
            );
          })}
        </div>

        <Buton
          ikon={<Save className="w-3.5 h-3.5" />}
          onClick={() =>
            yolla('/api/chat-alerts', k)
              .then(() => toast('Sohbet uyarıları kaydedildi.', 'basari'))
              .catch(() => toast('Kaydedilemedi.', 'hata'))
          }
        >
          Kaydet
        </Buton>
      </Kart>
    </div>
  );
}

// ------------------------------------------------------------ Moderasyon ----

const KURAL_ADLARI: Record<string, string> = {
  caps: 'Büyük harf koruması',
  emotes: 'Emoji koruması',
  links: 'Link koruması',
  symbols: 'Sembol koruması',
  blacklist: 'Yasaklı kelime',
  repeat: 'Tekrarlanan mesaj'
};

function ModerasyonPaneli() {
  const toast = useToast();
  const [ayar, setAyar] = useState<any>(null);
  const [yetenek, setYetenek] = useState<any>(null);
  const [hata, setHata] = useState('');

  const yukle = () =>
    Promise.all([al<any>('/api/automod'), al<any>('/api/platforms/capabilities')])
      .then(([a, y]) => {
        setAyar(a);
        setYetenek(y);
        setHata('');
      })
      .catch(() => setHata('Moderasyon ayarları yüklenemedi.'));
  useEffect(() => {
    yukle();
  }, []);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!ayar || !yetenek) return <Iskelet satir={6} />;

  // Hangi platformlar gerçekten timeout/silme yapabiliyor?
  const timeoutOlan = Object.entries(yetenek.yetenekler)
    .filter(([, v]: any) => v.moderasyon.timeout)
    .map(([k]) => k);
  const silmeOlan = Object.entries(yetenek.yetenekler)
    .filter(([, v]: any) => v.moderasyon.mesajSil)
    .map(([k]) => k);

  const kaydet = () => {
    const actions: any = {};
    for (const kural of Object.keys(KURAL_ADLARI)) {
      actions[kural] = {
        action: ayar[`${kural}_action`] || 'warn',
        timeout: Number(ayar[`${kural}_timeout`]) || 60,
        message: ayar[`${kural}_message`] || '',
        bypass: JSON.parse(ayar[`${kural}_bypass`] || '["mod","broadcaster"]')
      };
    }
    yolla('/api/automod', { ...ayar, actions })
      .then(() => toast('Moderasyon eylemleri kaydedildi.', 'basari'))
      .catch(() => toast('Kaydedilemedi.', 'hata'));
  };

  return (
    <div className="space-y-3">
      <Kart
        baslik="İhlal eylemleri"
        aciklama="Önceden AutoMod yalnız sohbete uyarı yazıyordu; platformda hiçbir eylem yapmıyordu."
      >
        <div className="text-[10px] text-gray-400 bg-black/25 rounded-lg px-3 py-2">
          Zaman aşımı destekleyen: <strong className="text-emerald-300">{timeoutOlan.join(', ') || 'yok'}</strong> ·
          Mesaj silme destekleyen: <strong className="text-emerald-300">{silmeOlan.join(', ') || 'yok'}</strong>.
          Desteklemeyen platformda uyarıya düşülür ve sebebi sohbette belirtilir.
        </div>

        <div className="space-y-2">
          {Object.entries(KURAL_ADLARI).map(([kural, ad]) => {
            const eylem = ayar[`${kural}_action`] || 'warn';
            const bypass: string[] = (() => {
              try {
                return JSON.parse(ayar[`${kural}_bypass`] || '["mod","broadcaster"]');
              } catch {
                return ['mod', 'broadcaster'];
              }
            })();

            return (
              <div key={kural} className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
                <span className="text-xs font-black text-white">{ad}</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Alan etiket="İhlal eylemi">
                    <Secim
                      value={eylem}
                      onChange={(e) => setAyar({ ...ayar, [`${kural}_action`]: e.target.value })}
                      secenekler={yetenek.eylemSecenekleri}
                    />
                  </Alan>
                  <Alan etiket="Zaman aşımı süresi">
                    <Secim
                      value={String(ayar[`${kural}_timeout`] || 60)}
                      onChange={(e) => setAyar({ ...ayar, [`${kural}_timeout`]: Number(e.target.value) })}
                      secenekler={(yetenek.timeoutKademeleri as number[]).map((sn) => ({
                        value: String(sn),
                        label: sn < 60 ? `${sn} sn` : sn < 3600 ? `${sn / 60} dk` : sn < 86400 ? `${sn / 3600} sa` : `${sn / 86400} g`
                      }))}
                    />
                  </Alan>
                  <Alan etiket="Özel uyarı mesajı" ipucu="Boşsa varsayılan kullanılır">
                    <Girdi
                      value={ayar[`${kural}_message`] || ''}
                      onChange={(e) => setAyar({ ...ayar, [`${kural}_message`]: e.target.value })}
                    />
                  </Alan>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-400">Muaf roller:</span>
                  {['regular', 'sub', 'vip', 'og'].map((rol) => (
                    <Anahtar
                      key={rol}
                      acik={bypass.includes(rol)}
                      etiket={rol === 'sub' ? 'Abone' : rol === 'regular' ? 'Düzenli' : rol.toUpperCase()}
                      onChange={(v) => {
                        const yeni = v ? [...bypass, rol] : bypass.filter((x) => x !== rol);
                        setAyar({ ...ayar, [`${kural}_bypass`]: JSON.stringify([...new Set([...yeni, 'mod', 'broadcaster'])]) });
                      }}
                    />
                  ))}
                  <span className="text-[10px] text-gray-500">Moderatör ve yayıncı her zaman muaftır.</span>
                </div>
              </div>
            );
          })}
        </div>

        <Buton ikon={<Save className="w-3.5 h-3.5" />} onClick={kaydet}>
          Kaydet
        </Buton>
      </Kart>
    </div>
  );
}

// -------------------------------------------------------------- Değişken ----

function DegiskenPaneli() {
  const toast = useToast();
  const [veri, setVeri] = useState<any>(null);
  const [ara, setAra] = useState('');
  const [sablon, setSablon] = useState('Merhaba $(sender)! Puanın: $(points)');
  const [sonuc, setSonuc] = useState('');
  const [hata, setHata] = useState('');

  useEffect(() => {
    al<any>('/api/variables')
      .then(setVeri)
      .catch(() => setHata('Değişken kataloğu yüklenemedi.'));
  }, []);

  if (hata) return <HataDurumu mesaj={hata} />;
  if (!veri) return <Iskelet satir={6} />;

  const q = ara.trim().toLowerCase();

  return (
    <div className="space-y-3">
      <Kart
        baslik="Şablon denemesi"
        aciklama="Test kipinde çalışır: puan ve sayaç DEĞİŞTİRİLMEZ."
      >
        <AlanMetni value={sablon} onChange={(e) => setSablon(e.target.value)} />
        <div className="flex items-center gap-2">
          <Buton
            ikon={<Play className="w-3.5 h-3.5" />}
            onClick={() =>
              yolla<any>('/api/variables/preview', { template: sablon })
                .then((d) => setSonuc(d.sonuc))
                .catch(() => toast('Deneme başarısız.', 'hata'))
            }
          >
            Dene
          </Buton>
          {sonuc && (
            <span className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-1.5">
              {sonuc}
            </span>
          )}
        </div>
      </Kart>

      <Kart baslik={`Değişken kataloğu (${veri.sayi})`} aciklama="Komut yanıtlarında ve sohbet uyarılarında kullanılır.">
        <Alan etiket="Ara">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Girdi value={ara} onChange={(e) => setAra(e.target.value)} className="pl-8" placeholder="points, random, json…" />
          </div>
        </Alan>

        <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
          {Object.entries(veri.gruplar).map(([grup, liste]: any) => {
            const suzulmus = liste.filter(
              (d: any) => !q || d.ad.includes(q) || String(d.aciklama).toLowerCase().includes(q)
            );
            if (!suzulmus.length) return null;
            return (
              <div key={grup}>
                <div className="text-[10px] font-black uppercase tracking-wider text-purple-300 mb-1">{grup}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {suzulmus.map((d: any) => (
                    <button
                      key={d.ad}
                      type="button"
                      onClick={() => {
                        setSablon((s) => `${s} $(${d.ad})`);
                        toast(`$(${d.ad}) şablona eklendi.`);
                      }}
                      className="text-left bg-black/25 hover:bg-black/40 rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <code className="text-[11px] font-mono text-cyan-300">$({d.ad})</code>
                        {d.ag && <span className="text-[9px] text-amber-400">ağ</span>}
                      </div>
                      <div className="text-[10px] text-gray-400">{d.aciklama}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Kart>
    </div>
  );
}

// ------------------------------------------------------------------ Sayfa ----

export function BotAdvanced() {
  const [sekme, setSekme] = useState<Sekme>('levels');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-white">Gelişmiş Bot Ayarları</h1>
        <p className="text-xs text-gray-400">
          Seviye sistemi, TTS filtreleri, sohbet uyarıları, moderasyon eylemleri ve değişken kataloğu.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-2">
        {SEKMELER.map((s) => (
          <button
            key={s.id}
            onClick={() => setSekme(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              sekme === s.id ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            {s.etiket}
          </button>
        ))}
      </div>

      {sekme === 'levels' && <SeviyePaneli />}
      {sekme === 'stats' && <IstatistikPaneli />}
      {sekme === 'tts' && <TtsPaneli />}
      {sekme === 'chatAlerts' && <SohbetUyariPaneli />}
      {sekme === 'moderation' && <ModerasyonPaneli />}
      {sekme === 'variables' && <DegiskenPaneli />}
    </div>
  );
}

export default BotAdvanced;
