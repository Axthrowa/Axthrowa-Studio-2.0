# OBS eklenti güvenlik modeli

> Özet: OBS eklentileri **yerel koddur** ve yüklendikleri süreçte, kullanıcının yetkileriyle çalışır. Bu uygulama bir
> sanal alan (sandbox) iddia etmez. Güvenlik; eklentiyi **çalıştırmadan önce** olabildiğince çok şey bilmek, kodu yalnız
> kullanıcının açık eylemiyle çalıştırmak, çöken eklentiyi motordan uzak tutmak ve eklentilere hiçbir sır API'si
> vermemek üzerine kuruludur.

## 1. Tehdit modeli

| Tehdit | Önlem | Kalan risk |
|---|---|---|
| Zararlı eklenti DLL'i | Statik çözümleme kod çalıştırmaz; sınama ve etkinleştirme açık onay ister; imza durumu dürüstçe gösterilir ("İmzasız") | Kullanıcı onaylarsa eklenti kullanıcının yetkileriyle her şeyi yapabilir |
| Kurcalanmış imzalı dosya | WinVerifyTrust `TRUST_E_BAD_DIGEST` → BLOCKED | İptal edilmiş sertifika ağsız doğrulamada yakalanmaz (bilerek: tarama ağa istek göndermez) |
| Zip kaçışı / zip bombası | Yol denetimi (`..`, mutlak, sürücü, ADS), 20 000 girdi, 1 GB, bildirilen boyut sınırı, CRC | — |
| Paketteki kurulum programı | Çalıştırılmaz; kurulum yalnız dosya kopyası | — |
| Ad taklidi (motorun yönettiği modül adıyla sahte DLL) | "Motor yönetir" kuralı yalnız geçerli "OBS Project" imzalı dosyaya uygulanır | — |
| Uzaktan tetikleme | Tarama/kurulum/sınama/etkinleştirme **yalnız yerel** (loopback) | — |
| Çöken eklenti uygulamayı düşürür | Motor ayrı süreç; sınama ayrı süreç; çökme istemi + karantina | Motor süreci içinde çöken eklenti o oturumdaki motor yayınlarını da düşürür |
| Eklentinin yayın anahtarlarını okuması | Eklentiye sır API'si yok (aşağıda) | Motor sürecine yüklenen eklenti, o anda etkin çıktılara verilen anahtarları bellekten okuyabilir |

## 2. Sırlar ve eklentiler

- **SecretStore (Kimlik Yöneticisi) panel sürecindedir**; motor ve eklentiler ona erişemez. Eklentilere açık bir
  `ListCredentials`, `GetStreamKey`, `GetOAuthToken` benzeri API yoktur ve eklenmeyecektir.
- Motor yalnız **başlatılan** çıkışın anahtarını, o çıkışı kurarken stdin'den alır ve libobs servis nesnesine verir;
  hiçbir yanıtta, olayda, günlükte geri yazmaz. Başlatılmamış hedeflerin anahtarları motora hiç gitmez
  (hedef kimlik bilgisi yalıtımı).
- Dürüst sınırlama: yerel kod aynı süreçteki belleği okuyabilir. Etkin bir RTMP çıkışı varken motora yüklenmiş bir
  eklenti o çıkışın anahtarını okuyabilir. Bu yüzden eklenti etkinleştirme açık bir kullanıcı kararıdır ve güvenmediğiniz
  eklentiyi etkinleştirmeyin.
- Eklenti kaynaklarının parola türündeki ayarları koleksiyon dosyasına yazılmaz; Kimlik Yöneticisinde tutulur ve yalnız
  kaynak kurulurken motora verilir. Destek paketinde, denetim kaydında ve günlükte değerleri yoktur.

## 3. Kodun çalıştığı yerler

| Yer | Ne zaman | Yalıtım |
|---|---|---|
| Statik çözümleme (panel) | Tarama, inceleme, içe aktarma | Kod çalışmaz (dosya veri olarak okunur; WinVerifyTrust ve sürüm kaynağı da veri okur) |
| Yalıtılmış yoklama | Kullanıcı "Sına" onayı verince | Ayrı süreç, geçici modül ayar klasörü, 25 sn zaman aşımı, hata penceresi yok; **sanal alan değil** |
| Motor | Etkin eklenti, motor başlarken | Ayrı süreç (panel etkilenmez); işaret dosyasıyla şüpheli tespiti |

## 4. Betik eklentileri

OBS'in Lua/Python betikleri `frontend-tools` üzerinden çalışır; motor bu modülü yüklemez. İleride bir betik/eklenti SDK'sı
yazılırsa sürümlü olacak, yerel eklentilerden **daha az** yetkiyle (sır yok, dosya sistemi sınırlı) çalışacaktır; şimdilik
yoktur (UNVERIFIED hedef).

## 5. Ağ

Eklenti yöneticisi internete istek göndermez: güncelleme aranmaz, dosya indirilmez, imza iptal listesi indirilmez.
Güncelleme, kullanıcının seçtiği yerel paketle yapılır.
