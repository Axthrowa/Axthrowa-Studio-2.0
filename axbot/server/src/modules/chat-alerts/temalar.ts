/**
 * AxBoT — temalı sohbet uyarısı mesajları
 * Developed by AxthrowA
 *
 * Her tema her olay için birkaç mesaj içerir; olay her geldiğinde rastgele
 * biri seçilir (aynısı art arda gelmez). Mesajlar Türkçe ve özgündür:
 * eserlere yalnız gönderme yapılır, alıntı/metin kopyalanmaz.
 * Değişkenler: $(sender) kişi, $(v1) olayın değeri (ay, adet, tutar, izleyici),
 * $(title) yayın başlığı, $(platformurl) kanal adresi.
 */
import type { SohbetOlayi } from './chat-alerts.js';
import { KARSILAMALAR } from './karsilamalar.js';

export type TemaKimligi = 'starwars' | 'harrypotter' | 'lotr' | 'got' | 'breakingbad' | 'gta' | 'witcher';

export const TEMA_ADLARI: Record<TemaKimligi | 'yok' | 'karisik', string> = {
  yok: 'Tema yok (kendi şablonların)',
  karisik: 'Karışık (her olayda rastgele tema)',
  starwars: 'Star Wars',
  harrypotter: 'Harry Potter',
  lotr: 'Yüzüklerin Efendisi',
  got: 'Game of Thrones',
  breakingbad: 'Breaking Bad',
  gta: 'GTA',
  witcher: 'The Witcher'
};

type Mesajlar = Record<SohbetOlayi, string[]>;

export const TEMA_MESAJLARI: Record<TemaKimligi, Mesajlar> = {
  starwars: {
    follow: [
      '🌌 $(sender) Asi İttifakı’na katıldı! Güç seninle olsun, genç Padawan.',
      '✨ Güçte bir dalgalanma hissediyorum… $(sender) takibe geçti!',
      '🚀 $(sender) hiper uzaya atlayıp kanala iniş yaptı. Hoş geldin, pilot!'
    ],
    sub: [
      '⚔️ $(sender) ışın kılıcını kuşandı ve Jedi Konseyi’ne katıldı! Teşekkürler!',
      '🌟 $(sender) abone oldu — bu Padawan artık bir Jedi Şövalyesi!',
      '🛸 $(sender) Millennium Falcon’a bilet aldı. Abonelik onaylandı, kaptan!'
    ],
    resub: [
      '🧘 $(sender) $(v1). ayında! Bu kadar sadakat ancak bir Jedi Ustası’nda görülür.',
      '🌠 $(sender) aboneliğini $(v1). kez yeniledi. Güç seninle, hem de her ay!',
      '🏅 $(v1) aydır buradasın $(sender) — Konsey sana koltuk ayırdı.'
    ],
    gift_sub: [
      '🎁 $(sender) galaksiye $(v1) ışın kılıcı dağıttı! Cömertliğin Güç kadar büyük.',
      '🤝 $(sender) $(v1) kişiyi Asi İttifakı’na kattı. Bu bir hediye değil, bir efsane!',
      '🌌 $(sender) $(v1) abonelik hediye etti — İmparatorluk bunu hiç beklemiyordu!'
    ],
    tip: [
      '💰 $(sender) $(v1) bağışladı! Hutt’lar bile bu cömertliği kıskandı.',
      '🪙 $(sender) $(v1) gönderdi — kanal artık Ölüm Yıldızı’na meydan okuyabilir!',
      '🙏 $(v1) için teşekkürler $(sender)! Güç seninle olsun.'
    ],
    kicks: [
      '🟢 $(sender) $(v1) KICKs fırlattı — yeşil ışın kılıcı kadar parlak!',
      '⚡ $(sender) $(v1) KICKs gönderdi. Güç bu kanalda çok güçlü!',
      '🟩 $(v1) KICKs! Yoda olsa “Cömert, bu izleyici” derdi, $(sender).'
    ],
    host: [
      '🛰️ $(sender) $(v1) kişilik filosuyla yörüngemize girdi! Hoş geldiniz!',
      '🌍 $(sender) $(v1) yolcuyla bize host attı. Gemiye hoş geldiniz!',
      '🚀 $(sender) ve $(v1) pilot iniş yaptı — kalkanları indirin, dostlar geldi!'
    ],
    raid: [
      '⚔️ RAİD! $(sender) $(v1) kişilik bir filoyla saldırıya geçti! Hoş geldiniz!',
      '🛸 $(sender) $(v1) X-Wing ile geldi! İttifak güçleniyor!',
      '🌌 $(v1) kişilik raid! $(sender), Güç seninle — ve ordunla!'
    ],
    welcome: [
      '👋 Uzak bir galaksiden yeni bir yolcu: hoş geldin $(sender)!',
      '🌟 $(sender) ilk kez konuştu. Güç seninle olsun, yeni Padawan!',
      '🚀 $(sender) sohbete iniş yaptı. Kanala hoş geldin!'
    ],
    stream_online: [
      '🔴 Yayın başladı! Hiper uzaya atlıyoruz: $(title) — $(platformurl)',
      '🌌 Galaksi uyandı, yayın açık! $(title) — $(platformurl)',
      '⚔️ Işın kılıçları hazır, yayın başladı: $(title) — $(platformurl)'
    ]
  },
  harrypotter: {
    follow: [
      '🦉 $(sender) için Hogwarts mektubu geldi! Takip için teşekkürler!',
      '🧙 Seçmen Şapka karar verdi: $(sender) artık bu kanalın öğrencisi!',
      '✨ $(sender) Peron 9¾’ten geçip kanala ulaştı. Hoş geldin!'
    ],
    sub: [
      '🏰 $(sender) abone oldu — binana 50 puan!',
      '🪄 $(sender) asasını kaldırdı: “Abonelikus!” Teşekkürler!',
      '⚡ $(sender) artık Hogwarts’ın gerçek bir üyesi. Abonelik için teşekkürler!'
    ],
    resub: [
      '📜 $(sender) $(v1). yılını tamamladı! Bu sadakate Dumbledore bile şapka çıkarır.',
      '🏆 $(v1) ay! $(sender), Binalar Kupası senin hakkın.',
      '🦌 $(sender) $(v1). ayında. Patronusun bu kanalın ta kendisi!'
    ],
    gift_sub: [
      '🎁 $(sender) $(v1) kişiye Hogwarts bileti hediye etti!',
      '🧹 $(sender) $(v1) süpürge dağıttı — herkes Quidditch takımına!',
      '✨ $(sender) $(v1) abonelik hediye etti. Bu büyü Bakanlıkça bile onaylandı!'
    ],
    tip: [
      '💰 $(sender) $(v1) bağışladı! Gringotts kasaları bile şaşırdı.',
      '🪙 $(v1) için teşekkürler $(sender)! Galleon’lar yerini buldu.',
      '✨ $(sender) $(v1) gönderdi — bu cömertliğe on puan değil, yüz puan!'
    ],
    kicks: [
      '🟢 $(sender) $(v1) KICKs gönderdi — Slytherin yeşili kadar parlak!',
      '🪄 $(v1) KICKs! $(sender) bunu nasıl yaptı, büyü mü?',
      '⚡ $(sender) $(v1) KICKs fırlattı. Binana puan yağıyor!'
    ],
    host: [
      '🚂 Hogwarts Ekspresi $(sender) ile $(v1) yolcu getirdi! Hoş geldiniz!',
      '🏰 $(sender) $(v1) kişiyle Büyük Salon’a girdi. Ziyafet başlasın!',
      '🦉 $(sender) $(v1) baykuşla haber yolladı: host geldi!'
    ],
    raid: [
      '⚔️ RAİD! $(sender) $(v1) büyücüyle kapıdan girdi! Hoş geldiniz!',
      '🧙 $(v1) kişilik Zümrüdüanka Yoldaşlığı geldi, lideri $(sender)!',
      '✨ $(sender) $(v1) kişiyle cisimlendi! Raid için teşekkürler!'
    ],
    welcome: [
      '🦉 Yeni bir öğrenci: hoş geldin $(sender)! Seçmen Şapka seni bekliyor.',
      '🪄 $(sender) ilk kez konuştu. Büyülü dünyamıza hoş geldin!',
      '🏰 $(sender), Büyük Salon’a hoş geldin!'
    ],
    stream_online: [
      '🔴 Yayın başladı! Hogwarts Ekspresi kalkıyor: $(title) — $(platformurl)',
      '🪄 “Lumos!” Yayın açık: $(title) — $(platformurl)',
      '🦉 Baykuşlar haber getirdi, yayındayız! $(title) — $(platformurl)'
    ]
  },
  lotr: {
    follow: [
      '💍 $(sender) Yüzük Kardeşliği’ne katıldı! Takip için teşekkürler!',
      '🏔️ $(sender) Shire’dan yola çıktı ve kanala vardı. Hoş geldin!',
      '🍃 Bir yolcu daha: $(sender) takibe geçti. Macera başlasın!'
    ],
    sub: [
      '⚔️ $(sender) kılıcını kuşandı ve Kardeşliğe yemin etti! Teşekkürler!',
      '🛡️ $(sender) abone oldu — Rohan süvarileri selam duruyor!',
      '🏰 $(sender) artık Gondor’un muhafızı. Abonelik için teşekkürler!'
    ],
    resub: [
      '🗺️ $(sender) $(v1) aydır bu yolculukta! Mordor bile bu kadar uzak değil.',
      '💍 $(v1). ay! $(sender), sadakatin elf işçiliği kadar sağlam.',
      '🌳 $(sender) $(v1). ayında. Entler bile bu kadar sabırlı değil!'
    ],
    gift_sub: [
      '🎁 $(sender) $(v1) kişiye elf pelerini hediye etti!',
      '🏹 $(sender) $(v1) okçuyu Kardeşliğe kattı. Cömertliğin efsane!',
      '💍 $(sender) $(v1) abonelik dağıttı — Orta Dünya bunu şarkılarla anlatacak!'
    ],
    tip: [
      '💰 $(sender) $(v1) bağışladı! Ejderhanın hazinesi bile kıskandı.',
      '🪙 $(v1) için teşekkürler $(sender)! Shire’da bu gece şenlik var.',
      '🍺 $(sender) $(v1) gönderdi — Hobbitler ikinci kahvaltıyı ona ısmarlıyor!'
    ],
    kicks: [
      '🟢 $(sender) $(v1) KICKs gönderdi — Shire çayırları kadar yeşil!',
      '🌿 $(v1) KICKs! $(sender), bu bir büyücüye yakışır hareket.',
      '⚡ $(sender) $(v1) KICKs fırlattı. Gandalf onaylıyor!'
    ],
    host: [
      '🔥 İşaret ateşleri yandı! $(sender) $(v1) kişiyle yardıma geldi!',
      '🏇 $(sender) $(v1) süvariyle host attı. Rohan geldi!',
      '🏰 $(sender) ve $(v1) yolcu kapıda. Hoş geldiniz!'
    ],
    raid: [
      '⚔️ RAİD! $(sender) $(v1) kişilik bir orduyla geldi! Hoş geldiniz!',
      '🏹 $(v1) kişilik raid! $(sender), Miğfer Dibi’nde zafer bizim!',
      '🔥 $(sender) $(v1) savaşçıyla kapımızda! Kardeşlik büyüyor!'
    ],
    welcome: [
      '🍃 Orta Dünya’ya hoş geldin $(sender)!',
      '💍 $(sender) ilk kez konuştu. Yolculuğa hoş geldin!',
      '🏡 $(sender), Shire’a hoş geldin! Çaylar ocakta.'
    ],
    stream_online: [
      '🔴 Yayın başladı! Macera bizi çağırıyor: $(title) — $(platformurl)',
      '🔥 İşaret ateşleri yandı, yayındayız! $(title) — $(platformurl)',
      '💍 Kardeşlik toplanıyor, yayın açık: $(title) — $(platformurl)'
    ]
  },
  got: {
    follow: [
      '🐺 $(sender) Gece Nöbeti’ne katıldı! Takip için teşekkürler!',
      '👑 $(sender) Yedi Krallık’ın yeni sakini. Hoş geldin!',
      '❄️ Kış geliyor, ama $(sender) çoktan geldi! Takip için teşekkürler!'
    ],
    sub: [
      '⚔️ $(sender) bu Hanedan’a biat etti! Abonelik için teşekkürler!',
      '🐉 $(sender) abone oldu — ejderhalar onu selamlıyor!',
      '🛡️ $(sender) artık Kraliyet Muhafızı. Teşekkürler!'
    ],
    resub: [
      '🏰 $(sender) $(v1) aydır sadık! Bir Lannister bile borcunu bu kadar düzenli ödemez.',
      '👑 $(v1). ay! $(sender), Demir Taht’a bir adım daha yaklaştın.',
      '🐺 $(sender) $(v1). ayında. Kuzey bu sadakati unutmaz!'
    ],
    gift_sub: [
      '🎁 $(sender) $(v1) kişiye lordluk unvanı dağıttı!',
      '🐉 $(sender) $(v1) abonelik hediye etti — bu cömertlik ejderha ateşi kadar sıcak!',
      '⚔️ $(sender) $(v1) kılıç ustasını Hanedan’a kattı!'
    ],
    tip: [
      '💰 $(sender) $(v1) bağışladı! Bir Lannister borcunu her zaman öder — sen de cömertsin!',
      '🪙 $(v1) için teşekkürler $(sender)! Demir Banka not aldı.',
      '👑 $(sender) $(v1) gönderdi. Hazine dolu, ziyafet başlasın!'
    ],
    kicks: [
      '🟢 $(sender) $(v1) KICKs gönderdi — orman ateşi kadar yeşil!',
      '🐉 $(v1) KICKs! $(sender), Yedi Krallık bunu konuşacak.',
      '⚡ $(sender) $(v1) KICKs fırlattı. Taht sallanıyor!'
    ],
    host: [
      '🏰 $(sender) $(v1) sancaktarla kalemize geldi! Hoş geldiniz!',
      '🐺 $(sender) $(v1) kişiyle host attı. Kuzey hatırlıyor!',
      '⚔️ $(sender) ve $(v1) asker sancağımız altında. Hoş geldiniz!'
    ],
    raid: [
      '⚔️ RAİD! $(sender) $(v1) kişilik orduyla Sur’u aştı! Hoş geldiniz!',
      '🐉 $(sender) $(v1) savaşçıyla ejderha sırtında geldi!',
      '❄️ $(v1) kişilik raid! $(sender), kış seninle geldi!'
    ],
    welcome: [
      '👑 Yedi Krallık’a hoş geldin $(sender)!',
      '🐺 $(sender) ilk kez konuştu. Kuzey seni selamlıyor!',
      '🏰 $(sender), kalemize hoş geldin! Ateşin yanında yer var.'
    ],
    stream_online: [
      '🔴 Yayın başladı! Kış geldi, yayın da: $(title) — $(platformurl)',
      '🐉 Ejderhalar uyandı, yayındayız! $(title) — $(platformurl)',
      '👑 Demir Taht boş durmaz, yayın açık: $(title) — $(platformurl)'
    ]
  },
  breakingbad: {
    follow: [
      '🧪 $(sender) laboratuvara katıldı! Takip için teşekkürler!',
      '🚐 $(sender) karavana bindi. Hoş geldin ortak!',
      '⚗️ Kimya tutmuş: $(sender) takibe geçti!'
    ],
    sub: [
      '🧪 $(sender) abone oldu — saflık oranı %99,1!',
      '🎩 $(sender) şapkasını taktı ve ekibe katıldı. Teşekkürler!',
      '⚗️ $(sender) artık bu işin ortağı. Abonelik için teşekkürler!'
    ],
    resub: [
      '🧪 $(sender) $(v1) aydır burada! Bu formül hiç bozulmuyor.',
      '🎩 $(v1). ay! $(sender), artık bu imparatorluğun temel taşısın.',
      '⚗️ $(sender) $(v1). ayında. Tutarlılık = kimya!'
    ],
    gift_sub: [
      '🎁 $(sender) $(v1) kişiye laboratuvar önlüğü dağıttı!',
      '🧪 $(sender) $(v1) abonelik hediye etti — ekip büyüyor!',
      '🚐 $(sender) $(v1) kişiyi karavana aldı. Cömertlik saf kristal!'
    ],
    tip: [
      '💰 $(sender) $(v1) bağışladı! Bu para aklanmaya gerek bile yok.',
      '🧪 $(v1) için teşekkürler $(sender)! Laboratuvar fonları yerinde.',
      '🎩 $(sender) $(v1) gönderdi. Saygı duyulacak bir hamle!'
    ],
    kicks: [
      '🟢 $(sender) $(v1) KICKs gönderdi — kristal kadar parlak!',
      '🧪 $(v1) KICKs! $(sender), bu tepkimeyi kimse durduramaz.',
      '⚗️ $(sender) $(v1) KICKs fırlattı. Formül işliyor!'
    ],
    host: [
      '🚐 $(sender) $(v1) kişiyle çöl ortasından geldi! Hoş geldiniz!',
      '🧪 $(sender) $(v1) kişiyle host attı. Laboratuvar kalabalık!',
      '🎩 $(sender) ve $(v1) misafir kapıda. Kapılar açık!'
    ],
    raid: [
      '⚔️ RAİD! $(sender) $(v1) kişiyle laboratuvara daldı! Hoş geldiniz!',
      '🚐 $(v1) kişilik raid! $(sender) karavanı doldurmuş!',
      '🧪 $(sender) $(v1) kişiyle geldi — tepkime başladı!'
    ],
    welcome: [
      '🧪 Laboratuvara hoş geldin $(sender)! Gözlüklerini tak.',
      '🎩 $(sender) ilk kez konuştu. Ekibe hoş geldin!',
      '🚐 $(sender), karavanda sana da yer var!'
    ],
    stream_online: [
      '🔴 Yayın başladı! Hadi pişirelim: $(title) — $(platformurl)',
      '🧪 Laboratuvar açık, yayındayız! $(title) — $(platformurl)',
      '🎩 Yayın başladı, kim olduğumuzu söyleyin: $(title) — $(platformurl)'
    ]
  },
  gta: {
    follow: [
      '🚗 $(sender) şehre giriş yaptı! Takip için teşekkürler!',
      '🌴 Vice City’den yeni bir yüz: $(sender) takipte!',
      '📱 $(sender) rehbere eklendi. Görev başlasın!'
    ],
    sub: [
      '💸 $(sender) abone oldu — görev tamamlandı! Respect +',
      '🏎️ $(sender) ekibe katıldı. Abonelik için teşekkürler!',
      '⭐ $(sender) abone oldu, aranma seviyesi: efsane!'
    ],
    resub: [
      '🏙️ $(sender) $(v1) aydır bu şehirde! Gerçek bir Los Santos sakini.',
      '💰 $(v1). ay! $(sender), mülk sahibi oldun artık.',
      '🚓 $(sender) $(v1). ayında. Polis bile bu sadakati takip edemiyor!'
    ],
    gift_sub: [
      '🎁 $(sender) $(v1) kişiye süper araba hediye etti!',
      '💸 $(sender) $(v1) abonelik dağıttı — ekip büyüyor!',
      '🏎️ $(sender) $(v1) kişiyi ekibe kattı. Büyük vurgun başarılı!'
    ],
    tip: [
      '💰 $(sender) $(v1) bağışladı! Soygun başarılı, payın hazır.',
      '💸 $(v1) için teşekkürler $(sender)! Bu kasa doldu.',
      '🏦 $(sender) $(v1) gönderdi — banka soygununa gerek kalmadı!'
    ],
    kicks: [
      '🟢 $(sender) $(v1) KICKs gönderdi — para çantası yeşil!',
      '💵 $(v1) KICKs! $(sender), bu hile kodu mu?',
      '⚡ $(sender) $(v1) KICKs fırlattı. Respect +100!'
    ],
    host: [
      '🚁 $(sender) $(v1) kişiyle helikopterden indi! Hoş geldiniz!',
      '🚗 $(sender) $(v1) araçlık konvoyla geldi. Hoş geldiniz!',
      '🌴 $(sender) ve $(v1) kişi şehre giriş yaptı!'
    ],
    raid: [
      '⚔️ RAİD! $(sender) $(v1) kişilik çeteyle geldi! Hoş geldiniz!',
      '🚓 $(v1) kişilik raid! Aranma seviyesi 5 yıldız, lideri $(sender)!',
      '💥 $(sender) $(v1) kişiyle kapıyı kırdı! Büyük vurgun başlıyor!'
    ],
    welcome: [
      '🌴 Şehre hoş geldin $(sender)!',
      '📱 $(sender) ilk mesajını attı. Ekibe hoş geldin!',
      '🚗 $(sender), arabana atla, görev seni bekliyor!'
    ],
    stream_online: [
      '🔴 Yayın başladı! Görev başlıyor: $(title) — $(platformurl)',
      '🚗 Motorlar çalıştı, yayındayız! $(title) — $(platformurl)',
      '🌴 Şehir uyandı, yayın açık: $(title) — $(platformurl)'
    ]
  },
  witcher: {
    follow: [
      '🐺 $(sender) Kurt Okulu’na katıldı! Takip için teşekkürler!',
      '⚔️ $(sender) yola çıktı ve kanala vardı. Hoş geldin, avcı!',
      '🪙 Ozana bir sikke at: $(sender) takipte!'
    ],
    sub: [
      '⚔️ $(sender) gümüş kılıcını kuşandı ve abone oldu! Teşekkürler!',
      '🐺 $(sender) Kaer Morhen’e kabul edildi! Abonelik onaylandı.',
      '🔮 $(sender) abone oldu — madalyon titriyor!'
    ],
    resub: [
      '🐺 $(sender) $(v1) aydır avda! Gerçek bir witcher.',
      '⚔️ $(v1). ay! $(sender), kontratların hiç bitmiyor.',
      '🎻 $(sender) $(v1). ayında. Ozanlar bunun şarkısını yazacak!'
    ],
    gift_sub: [
      '🎁 $(sender) $(v1) kişiye gümüş kılıç hediye etti!',
      '🐺 $(sender) $(v1) abonelik dağıttı — okul büyüyor!',
      '🧪 $(sender) $(v1) kişiye iksir dağıttı. Cömertliğe bak!'
    ],
    tip: [
      '💰 $(sender) $(v1) bağışladı! Bu kontratın ödülü fazlasıyla verildi.',
      '🪙 $(v1) için teşekkürler $(sender)! Ozan bu gece seni anlatacak.',
      '⚔️ $(sender) $(v1) gönderdi. Bir witcher’a para bulunmaz, sen buldun!'
    ],
    kicks: [
      '🟢 $(sender) $(v1) KICKs gönderdi — iksir gibi yeşil!',
      '🔮 $(v1) KICKs! $(sender), madalyon titredi.',
      '⚡ $(sender) $(v1) KICKs fırlattı. Hımm… etkileyici.'
    ],
    host: [
      '🐎 $(sender) $(v1) kişiyle atını bize sürdü! Hoş geldiniz!',
      '🏰 $(sender) $(v1) yolcuyla hana uğradı. Bira bizden!',
      '🐺 $(sender) ve $(v1) avcı geldi. Hoş geldiniz!'
    ],
    raid: [
      '⚔️ RAİD! $(sender) $(v1) kişilik avcı sürüsüyle geldi! Hoş geldiniz!',
      '🐺 $(v1) kişilik raid! Vahşi Av mı bu, $(sender)?',
      '🔥 $(sender) $(v1) kişiyle kapıda! Kılıçlar hazır!'
    ],
    welcome: [
      '🐺 Yola hoş geldin $(sender)!',
      '🎻 $(sender) ilk kez konuştu. Han’a hoş geldin!',
      '⚔️ $(sender), gümüşünü al, av başlıyor!'
    ],
    stream_online: [
      '🔴 Yayın başladı! Yeni bir kontrat var: $(title) — $(platformurl)',
      '🐺 Madalyon titriyor, yayındayız! $(title) — $(platformurl)',
      '🎻 Ozanlar toplansın, yayın açık: $(title) — $(platformurl)'
    ]
  }
};

/** Temadan olay için mesaj adayları ('karisik' = tüm temalar) */
export function temaAdaylari(tema: string, olay: SohbetOlayi): string[] {
  if (tema === 'karisik') return Object.values(TEMA_MESAJLARI).flatMap((m) => m[olay] || []);
  return (TEMA_MESAJLARI as Record<string, Mesajlar>)[tema]?.[olay] || [];
}

/** Yeni takipçi karşılamasında seçilebilen temalar */
export const TAKIP_TEMA_ADLARI: Record<string, string> = {
  harrypotter: 'Harry Potter',
  lotr: 'Yüzüklerin Efendisi',
  starwars: 'Star Wars',
  got: 'Game of Thrones',
  breakingbad: 'Breaking Bad',
  marvel: 'Marvel',
  stranger: 'Stranger Things',
  witcher: 'The Witcher',
  mario: 'Super Mario',
  gta: 'GTA',
  kendi: 'Kendi metinlerim'
};

/** Temanın gömülü karşılamaları (kullanıcı düzenlemesi yoksa bunlar gider) */
export function varsayilanTakipMetinleri(tema: string): string[] {
  return [...((TEMA_MESAJLARI as Record<string, Mesajlar>)[tema]?.follow || []), ...(KARSILAMALAR[tema] || [])];
}

/** Seçili temaların tüm karşılama mesajları; `duzenlenen` temada panelden yazılan liste geçerlidir */
export function takipAdaylari(temalar: string[], duzenlenen: Record<string, string[]> = {}): string[] {
  return temalar.flatMap((t) => duzenlenen[t] ?? varsayilanTakipMetinleri(t));
}

/** Paneldeki düzenlemeler (`takip_karsilama_metinleri`): bilinen tema, satır başına bir metin, en çok 100 × 300 harf */
export function takipMetinleriCoz(ham: unknown): Record<string, string[]> {
  let v: unknown = ham;
  try {
    if (typeof ham === 'string') v = JSON.parse(ham || '{}');
  } catch {
    return {};
  }
  const out: Record<string, string[]> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [tema, liste] of Object.entries(v as Record<string, unknown>)) {
    if (!(tema in TAKIP_TEMA_ADLARI) || !Array.isArray(liste)) continue;
    out[tema] = liste.map((x) => String(x ?? '').trim().slice(0, 300)).filter(Boolean).slice(0, 100);
  }
  return out;
}

/**
 * Kayıtlı seçim. Hiç seçim yapılmadıysa (`ham` boş) ve kullanıcı kendi şablonunu ya da genel temayı
 * ayarlamadıysa bütün temalar karışık gider; bilerek boşaltılan liste kendi şablonuna döner.
 */
export function takipTemalariCoz(ham: string | null | undefined, kendiAyariVar: boolean): string[] {
  if (!ham) return kendiAyariVar ? [] : Object.keys(TAKIP_TEMA_ADLARI);
  try {
    const v = JSON.parse(ham);
    return Array.isArray(v) ? v.filter((t) => typeof t === 'string' && t in TAKIP_TEMA_ADLARI) : [];
  } catch {
    return [];
  }
}

/** Son gönderileni tekrar etmeden rastgele seçim */
export function rastgeleFarkli<T>(liste: T[], son: T | undefined, rastgele: () => number = Math.random): T | undefined {
  if (!liste.length) return undefined;
  if (liste.length === 1) return liste[0];
  const adaylar = liste.filter((x) => x !== son);
  return adaylar[Math.floor(rastgele() * adaylar.length) % adaylar.length];
}
