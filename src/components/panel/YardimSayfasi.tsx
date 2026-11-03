import type { ReactNode } from "react";

/** Çizimler uygulamanın içinden gelir: ekran görüntüsü gibi eskimez, kişisel veri taşımaz. */
function Cizim({ baslik, children, yukseklik = 170 }: { baslik: string; children: ReactNode; yukseklik?: number }) {
  return (
    <svg
      role="img"
      aria-label={baslik}
      viewBox={`0 0 560 ${yukseklik}`}
      className="w-full border-b border-white/[0.06] bg-black/30"
      style={{ fontFamily: "inherit" }}
    >
      {children}
    </svg>
  );
}

const VURGU = "#2dd4bf";
const KUTU = "#1b2330";
const CIZGI = "rgba(255,255,255,.22)";
const SOLUK = "rgba(255,255,255,.62)";

function Kutucuk({ x, y, g, h, metin, alt, vurgulu }: { x: number; y: number; g: number; h: number; metin: string; alt?: string; vurgulu?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={g} height={h} rx={8} fill={vurgulu ? "rgba(45,212,191,.16)" : KUTU} stroke={vurgulu ? VURGU : CIZGI} />
      <text x={x + g / 2} y={y + (alt ? h / 2 - 3 : h / 2 + 4)} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
        {metin}
      </text>
      {alt && (
        <text x={x + g / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize={10} fill={SOLUK}>
          {alt}
        </text>
      )}
    </g>
  );
}

function Ok({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g stroke={VURGU} strokeWidth={2} fill="none">
      <line x1={x1} y1={y} x2={x2 - 6} y2={y} />
      <path d={`M ${x2 - 8} ${y - 5} L ${x2} ${y} L ${x2 - 8} ${y + 5}`} />
    </g>
  );
}

const CizimAkis = () => (
  <Cizim baslik="Ekranı hazırla, adresi kopyala, OBS'e ekle, yayına çık" yukseklik={120}>
    <Kutucuk x={14} y={32} g={118} h={56} metin="1. Ekranı hazırla" alt="Giriş, Mola, Çıkış" />
    <Ok x1={134} x2={156} y={60} />
    <Kutucuk x={158} y={32} g={110} h={56} metin="2. Adresi kopyala" alt="OBS adresi" />
    <Ok x1={270} x2={292} y={60} />
    <Kutucuk x={294} y={32} g={118} h={56} metin="3. OBS'e ekle" alt="Tarayıcı kaynağı" />
    <Ok x1={414} x2={436} y={60} />
    <Kutucuk x={438} y={32} g={108} h={56} metin="4. Yayına çık" alt="Sahne değiştir" vurgulu />
  </Cizim>
);

const CizimTarayici = () => (
  <Cizim baslik="OBS tarayıcı kaynağı penceresi: adres, genişlik 1920, yükseklik 1080">
    <rect x={70} y={14} width={420} height={142} rx={8} fill={KUTU} stroke={CIZGI} />
    <text x={86} y={35} fontSize={12} fontWeight={700} fill="#fff">Tarayıcı kaynağı özellikleri</text>
    <text x={86} y={60} fontSize={11} fill={SOLUK}>URL</text>
    <rect x={160} y={47} width={314} height={22} rx={4} fill="rgba(45,212,191,.12)" stroke={VURGU} />
    <text x={168} y={62} fontSize={11} fill="#fff">http://127.0.0.1:8843/starting?obs=1</text>
    <text x={86} y={92} fontSize={11} fill={SOLUK}>Genişlik</text>
    <rect x={160} y={79} width={90} height={22} rx={4} fill="#0d1219" stroke={VURGU} />
    <text x={168} y={94} fontSize={11} fill="#fff">1920</text>
    <text x={86} y={124} fontSize={11} fill={SOLUK}>Yükseklik</text>
    <rect x={160} y={111} width={90} height={22} rx={4} fill="#0d1219" stroke={VURGU} />
    <text x={168} y={126} fontSize={11} fill="#fff">1080</text>
    <rect x={400} y={122} width={74} height={24} rx={4} fill={VURGU} />
    <text x={437} y={138} textAnchor="middle" fontSize={11} fontWeight={700} fill="#04201c">Tamam</text>
  </Cizim>
);

const CizimWebSocket = () => (
  <Cizim baslik="OBS WebSocket: etkinleştir, port ve parolayı uygulamaya yaz, Bağlan'a bas" yukseklik={130}>
    <Kutucuk x={14} y={26} g={200} h={78} metin="OBS: Araçlar → WebSocket" alt="Etkinleştir, port 4455, parola" />
    <Ok x1={218} x2={256} y={65} />
    <Kutucuk x={260} y={26} g={170} h={78} metin="Uygulama: OBS WebSocket" alt="Port ve parolayı yaz, Bağlan" />
    <Ok x1={434} x2={462} y={65} />
    <circle cx={510} cy={55} r={11} fill="#22c55e" />
    <text x={510} y={86} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">Bağlı</text>
  </Cizim>
);

const CizimEkran = () => (
  <Cizim baslik="Giriş ekranı: başlık, geri sayım, şimdi çalıyor kartı ve şarkı sözleri" yukseklik={190}>
    <rect x={110} y={10} width={340} height={170} rx={6} fill="#10151d" stroke={CIZGI} />
    <text x={280} y={46} textAnchor="middle" fontSize={15} fontWeight={800} fill="#fff">YAYIN BİRAZDAN BAŞLIYOR</text>
    <text x={280} y={78} textAnchor="middle" fontSize={22} fontWeight={800} fill={VURGU}>04:59</text>
    <rect x={165} y={100} width={230} height={32} rx={5} fill="rgba(45,212,191,.12)" stroke={VURGU} strokeDasharray="4 3" />
    <text x={280} y={115} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">Şarkı sözleri</text>
    <text x={280} y={127} textAnchor="middle" fontSize={9} fill={SOLUK}>sürükleyerek taşı, köşesinden büyüt</text>
    <rect x={120} y={142} width={140} height={30} rx={5} fill={KUTU} stroke={CIZGI} />
    <text x={190} y={161} textAnchor="middle" fontSize={11} fill="#fff">Şimdi Çalıyor</text>
  </Cizim>
);

const CizimTekUrl = () => (
  <Cizim baslik="Tek URL: bütün widget'lar tek OBS kaynağında, yalnız seçili widget taşınır" yukseklik={190}>
    <rect x={20} y={10} width={330} height={170} rx={6} fill="#10151d" stroke={CIZGI} />
    <rect x={32} y={80} width={84} height={90} rx={4} fill={KUTU} stroke={CIZGI} />
    <text x={74} y={129} textAnchor="middle" fontSize={11} fill={SOLUK}>Sohbet</text>
    <rect x={140} y={22} width={120} height={52} rx={4} fill="rgba(45,212,191,.14)" stroke={VURGU} strokeWidth={2} />
    <text x={200} y={45} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">Uyarı kutusu</text>
    <text x={200} y={60} textAnchor="middle" fontSize={9} fill={VURGU}>seçili: taşınır</text>
    <rect x={272} y={22} width={68} height={40} rx={4} fill={KUTU} stroke={CIZGI} />
    <text x={306} y={46} textAnchor="middle" fontSize={10} fill={SOLUK}>Subathon</text>
    <circle cx={290} cy={130} r={34} fill={KUTU} stroke={CIZGI} />
    <text x={290} y={134} textAnchor="middle" fontSize={11} fill={SOLUK}>Çark</text>
    <rect x={368} y={10} width={176} height={170} rx={6} fill={KUTU} stroke={CIZGI} />
    <text x={380} y={32} fontSize={11} fontWeight={700} fill="#fff">Düzenlenecek Bileşen</text>
    <rect x={380} y={40} width={152} height={22} rx={4} fill="#0d1219" stroke={VURGU} />
    <text x={388} y={55} fontSize={10} fill="#fff">Uyarı kutusu ▾</text>
    <text x={380} y={84} fontSize={10} fill={SOLUK}>☑ Yayında göster</text>
    <text x={380} y={103} fontSize={10} fill={SOLUK}>☑ Arkasındakileri gizle</text>
    <text x={380} y={122} fontSize={10} fill={SOLUK}>Konum ve boyut</text>
    <text x={380} y={141} fontSize={10} fill={SOLUK}>Widget ayarları</text>
    <text x={380} y={160} fontSize={10} fill={SOLUK}>Test düğmeleri tuvalin üstünde</text>
  </Cizim>
);

const CizimIstek = () => (
  <Cizim baslik="Şarkı isteği: izleyici !sr yazar, istek sıraya girer, çalan şarkı bitince başlar" yukseklik={120}>
    <Kutucuk x={14} y={32} g={122} h={56} metin="!sr şarkı adı" alt="İzleyici sohbete yazar" />
    <Ok x1={138} x2={160} y={60} />
    <Kutucuk x={162} y={32} g={110} h={56} metin="Sıraya girer" alt="Bot cevap verir" />
    <Ok x1={274} x2={296} y={60} />
    <Kutucuk x={298} y={32} g={118} h={56} metin="Çalan şarkı biter" alt="Kesilmez" />
    <Ok x1={418} x2={440} y={60} />
    <Kutucuk x={442} y={32} g={104} h={56} metin="İstek çalar" alt="!sarki ile gör" vurgulu />
  </Cizim>
);

type Konu = { baslik: string; ozet: string; cizim?: ReactNode; adimlar: string[]; not?: string };

const KONULAR: Konu[] = [
  {
    baslik: "İlk kurulum: dört adımda yayına hazır",
    ozet: "Ekranlarını uygulamada hazırlar, adresini OBS'e eklersin. Uygulama açık kaldığı sürece OBS kaynakları çalışır.",
    cizim: <CizimAkis />,
    adimlar: [
      "Soldaki menüden Sahne ve Overlay'i aç, Giriş, Çıkış ya da Mola ekranını seç. Yazıları ve görünümü düzenle, önizleme anında değişir.",
      "Ekranın OBS adresini kopyala.",
      "OBS'te adresi tarayıcı kaynağı olarak ekle (aşağıdaki adımlar).",
      "OBS WebSocket'i bağla: sahne geçişleri ve kısayollar böyle çalışır.",
    ],
  },
  {
    baslik: "OBS'e tarayıcı kaynağı ekleme",
    ozet: "Her ekran ve widget, OBS'te bir tarayıcı kaynağıdır.",
    cizim: <CizimTarayici />,
    adimlar: [
      "OBS'te Kaynaklar bölümünde + düğmesine bas, Tarayıcı'yı seç.",
      "URL alanına kopyaladığın adresi yapıştır.",
      "Genişliği 1920, yüksekliği 1080 yap ve Tamam'a bas.",
    ],
    not: "Kaynak siyah görünüyorsa uygulamanın açık olduğunu denetle, sonra kaynağa sağ tıklayıp Yenile de.",
  },
  {
    baslik: "OBS WebSocket bağlantısı",
    ozet: "Uygulamanın sahne değiştirebilmesi ve ses kontrolü için gerekir.",
    cizim: <CizimWebSocket />,
    adimlar: [
      "OBS'te Araçlar → WebSocket Sunucu Ayarları'nı aç, sunucuyu etkinleştir.",
      "Portu (varsayılan 4455) ve parolayı not et.",
      "Sahne ve Overlay'deki OBS WebSocket bölümüne yazıp Bağlan'a bas. Yeşil gösterge bağlantının kurulduğunu söyler.",
    ],
  },
  {
    baslik: "Giriş, Çıkış ve Mola ekranları",
    ozet: "Başlık, geri sayım, sosyal hesaplar, Şimdi Çalıyor kartı ve şarkı sözleri bu ekranlarda bulunur.",
    cizim: <CizimEkran />,
    adimlar: [
      "Önizlemede bir öğeye tıklayıp sürükle, köşesinden büyüt.",
      "Şarkı sözleri için ayar panelindeki Resonance bölümünde “Bu ekranda şarkı sözlerini göster”i aç.",
      "Söz boyutu, rengi ve zamanlaması Sahne ve Overlay → Müzik'tedir. Aynı ayar üç ekranda da geçerlidir.",
    ],
    not: "Sözler yalnız kaynakta zaman damgalı söz varsa görünür. Yanlış anda yanlış satır göstermemek için aksi hâlde boş kalır.",
  },
  {
    baslik: "AxBoT ve Tek URL",
    ozet: "Bot sekmesindeki Overlay Stüdyo, bütün widget'ları tek OBS kaynağında toplar.",
    cizim: <CizimTekUrl />,
    adimlar: [
      "Bot → Tüm ayarlar → OBS & Uyarılar → Overlay Stüdyo → Tek URL'yi aç, adresi OBS'e bir kez ekle.",
      "Sağdaki “Düzenlenecek Bileşen” listesinden widget'ı seç. Tuvalde yalnız o taşınır; başka bir widget'ı seçmek için listeyi kullan ya da ona çift tıkla.",
      "Ayarları aynı panelde değiştir, kendiliğinden kaydedilir.",
      "Tuvalin üstündeki Test düğmeleriyle widget'ı dene. Sohbete ya da izleyiciye hiçbir şey gitmez.",
    ],
    not: "“Ekrana gelince arkasındakileri gizle” ve “Öne bir şey gelince gizlen” her widget'ta ayrı açılıp kapanır. Uyarı geçince gizlenen widget geri gelir.",
  },
  {
    baslik: "Müzik ve şarkı istekleri",
    ozet: "İzleyiciler sohbetten şarkı ister, istekler sırayla çalar.",
    cizim: <CizimIstek />,
    adimlar: [
      "Sahne ve Overlay → Müzik'ten Spotify veya YouTube Music'i bağla.",
      "İzleyici !sr şarkı adı yazar. Çalan şarkı kesilmez, istek sırasını bekler.",
      "!sarki oynatıcıda gerçekten çalan şarkıyı yazar.",
    ],
    not: "Spotify isteği için yayıncının Premium hesabı ve açık bir Spotify cihazı gerekir.",
  },
  {
    baslik: "Canlı sohbeti bağlama",
    ozet: "Sohbet botu, bağladığın platformları okur ve yanıt verir.",
    adimlar: [
      "Bot → Tüm ayarlar → Platformlar'dan Kick, Twitch ve diğer hesaplarını bağla.",
      "Kick için kendi Client ID ve Secret bilgilerini Kick geliştirici sayfasından alıp girmen gerekir; pakette hazır anahtar yoktur.",
      "Sohbet widget'ını Tek URL'de aç ya da soldaki Etkileşim bölümünden takip et.",
    ],
  },
  {
    baslik: "Ses paneli ve kısayollar",
    ozet: "Sesleri tek tuşla çalar, sahneleri kısayolla değiştirirsin.",
    adimlar: [
      "Sahne ve Overlay → Ses Paneli'nden ses ekle, OBS'e /sfx?obs=1 adresini tarayıcı kaynağı olarak ekle.",
      "Sohbette !sesadı sesi çalar, !seslistesi listeyi yazar.",
      "Kısayollar Ayarlar → Kısayollar'dadır. Dinle'ye bas ve tuş kombinasyonuna dokun; hemen kaydedilir.",
    ],
  },
];

const SORUNLAR: [string, string][] = [
  ["OBS kaynağı siyah ya da boş", "Uygulamanın açık olduğunu denetle, kaynağa sağ tıklayıp Yenile de."],
  ["Widget Tek URL'de görünmüyor", "“Yayında göster” açık mı bak. Olayla çalışan widget'lar olay gelene dek boştur: Test düğmesiyle dene."],
  ["Bağış treni görünmüyor", "Widget ayarlarında “Tren başlamadan gizle”nin kapalı olduğunu denetle."],
  ["Subathon süresi artmıyor", "Sayaç başlatılmış olmalı ve o kaynak (abone, hediye, bağış, KICKs) Subathon ayarlarında açık olmalı."],
  ["Şarkı isteği çalmıyor", "Spotify'ın bir cihazda açık olduğunu denetle. Bot, çalamadığı isteği sohbete yazar."],
  ["Ses gelmiyor", "OBS'te ilgili tarayıcı kaynağının ses ayarını ve Ses Karıştırıcı'yı denetle."],
];

export default function YardimSayfasi() {
  return (
    <div className="space-y-4 text-xs md:text-sm">
      {KONULAR.map((k) => (
        <section key={k.baslik} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-panel-card/60 shadow-glass">
          {k.cizim}
          <div className="space-y-2 p-5">
            <h3 className="font-display text-base font-bold text-white">{k.baslik}</h3>
            <p className="leading-relaxed text-white/80">{k.ozet}</p>
            <ol className="list-decimal space-y-1 pl-5 leading-relaxed text-white/85 marker:font-bold marker:text-panel-accent">
              {k.adimlar.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
            {k.not && <p className="rounded-lg border border-panel-accent/25 bg-panel-accent/10 p-2.5 leading-relaxed text-white/85">{k.not}</p>}
          </div>
        </section>
      ))}
      <section className="rounded-2xl border border-white/[0.07] bg-panel-card/60 p-5 shadow-glass">
        <h3 className="mb-3 font-display text-base font-bold text-white">Sık karşılaşılan sorunlar</h3>
        <dl className="space-y-2.5">
          {SORUNLAR.map(([sorun, cozum]) => (
            <div key={sorun} className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
              <dt className="font-bold text-white">{sorun}</dt>
              <dd className="mt-0.5 leading-relaxed text-white/80">{cozum}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
