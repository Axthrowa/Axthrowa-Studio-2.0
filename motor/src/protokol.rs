//! `hizmet` kipi: stdin'den JSON satırı komut, stdout'a JSON satırı yanıt/olay (prompt §26 "Typed IPC").
//!
//! İstek:  `{"no": 3, "komut": "cikis.baslat", "id": "twitch"}`
//! Yanıt:  `{"no": 3, "tamam": true, "sonuc": …}` ya da `{"no": 3, "tamam": false, "hata": "…"}`
//! Olay:   `{"olay": "cikis", "id": "twitch", "durum": "canli"}`
//!
//! Motor ağda hiçbir port açmaz; yalnız onu başlatan süreçle konuşur. Yayın anahtarı yalnız `cikis.rtmp` isteğinde
//! gelir, servis nesnesine verilir ve hiçbir yanıtta, olayda ya da günlükte geri yazılmaz.

use std::io::{BufRead, Write};
use std::path::PathBuf;
use std::sync::mpsc;

use serde_json::{json, Value};

use crate::motor::{Donusum, KodlayiciAyari, Motor, MotorAyari, Olay, TARAYICI_MODULLERI, TEMEL_MODULLER, YAKALAMA_MODULLERI};
use crate::obs::Vec2;

fn yaz(satir: &Value) {
  yaz_metin(&satir.to_string());
}

fn yaz_metin(satir: &str) {
  let mut out = std::io::stdout().lock();
  let _ = writeln!(out, "{satir}");
  let _ = out.flush();
}

/// `baslat` isteğinden video/ses ayarları (verilmeyen alan varsayılan)
fn motor_ayari(istek: &Value) -> Result<MotorAyari, String> {
  use crate::motor::{ada_gore, HOPARLORLER, OLCEK_FILTRELERI, RENK_ARALIKLARI, RENK_BICIMLERI, RENK_UZAYLARI};
  let g = sayi(istek, "genislik", Some(1920))? as u32;
  let y = sayi(istek, "yukseklik", Some(1080))? as u32;
  let mut a = MotorAyari::yeni(g, y, sayi(istek, "fps", Some(60))? as u32);
  a.cikis_genislik = sayi(istek, "cikis_genislik", Some(g as u64))? as u32;
  a.cikis_yukseklik = sayi(istek, "cikis_yukseklik", Some(y as u64))? as u32;
  let ad = |alan: &str| istek.get(alan).and_then(Value::as_str);
  if let Some(x) = ad("olcek_filtresi") {
    a.olcek = ada_gore(&OLCEK_FILTRELERI, x, "ölçek filtresi")?;
  }
  if let Some(x) = ad("renk_bicimi") {
    a.bicim = ada_gore(&RENK_BICIMLERI, x, "renk biçimi")?;
  }
  if let Some(x) = ad("renk_uzayi") {
    a.renk_uzayi = ada_gore(&RENK_UZAYLARI, x, "renk uzayı")?;
  }
  if let Some(x) = ad("renk_araligi") {
    a.aralik = ada_gore(&RENK_ARALIKLARI, x, "renk aralığı")?;
  }
  if let Some(x) = ad("hoparlor") {
    a.hoparlor = ada_gore(&HOPARLORLER, x, "hoparlör düzeni")?;
  }
  a.ornekleme = sayi(istek, "ornekleme", Some(48_000))? as u32;
  Ok(a)
}

fn metin<'a>(v: &'a Value, ad: &str) -> Result<&'a str, String> {
  v.get(ad).and_then(Value::as_str).ok_or_else(|| format!("'{ad}' alanı gerekli"))
}

fn sayi(v: &Value, ad: &str, varsayilan: Option<u64>) -> Result<u64, String> {
  match v.get(ad) {
    Some(x) => x.as_u64().ok_or_else(|| format!("'{ad}' pozitif tamsayı olmalı")),
    None => varsayilan.ok_or_else(|| format!("'{ad}' alanı gerekli")),
  }
}

fn cift(v: &Value) -> Option<Vec2> {
  let a = v.as_array()?;
  (a.len() == 2).then(|| Vec2 { x: a[0].as_f64().unwrap_or(0.0) as f32, y: a[1].as_f64().unwrap_or(0.0) as f32 })
}

/// `{"konum":[x,y], "olcek":[x,y], "sinir":[g,y], "aci": d, "gorunur": b}`
pub fn donusum(v: Option<&Value>) -> Donusum {
  let Some(v) = v else { return Donusum::default() };
  let tam = |ad: &str| v.get(ad).and_then(Value::as_i64);
  Donusum {
    konum: v.get("konum").and_then(cift),
    olcek: v.get("olcek").and_then(cift),
    sinir: v.get("sinir").and_then(cift),
    aci: v.get("aci").and_then(Value::as_f64).map(|a| a as f32),
    gorunur: v.get("gorunur").and_then(Value::as_bool),
    hizalama: tam("hizalama").map(|x| x.clamp(0, 15) as u32),
    sinir_turu: tam("sinir_turu").map(|x| x.clamp(0, 6) as i32),
    sinir_hizalama: tam("sinir_hizalama").map(|x| x.clamp(0, 15) as u32),
    kirp: v.get("kirp").and_then(Value::as_array).filter(|a| a.len() == 4).map(|a| {
      let n = |i: usize| a[i].as_i64().unwrap_or(0).clamp(0, 16_384) as i32;
      crate::obs::Kirp { sol: n(0), ust: n(1), sag: n(2), alt: n(3) }
    }),
    kilit: v.get("kilit").and_then(Value::as_bool),
    olcek_filtresi: tam("olcek_filtresi").map(|x| x.clamp(0, 6) as i32),
    karistirma: tam("karistirma").map(|x| x.clamp(0, 6) as i32),
    karistirma_yontemi: tam("karistirma_yontemi").map(|x| x.clamp(0, 1) as i32),
  }
}

/// Tek bir komutu yürütür. `motor` yoksa yalnız `baslat` kabul edilir.
fn yurut(motor: &mut Option<Motor>, istek: &Value, olay: &mpsc::Sender<Olay>) -> Result<Value, String> {
  let komut = metin(istek, "komut")?;
  if komut == "baslat" {
    if motor.is_some() {
      return Err("motor zaten çalışıyor".into());
    }
    let ayar = motor_ayari(istek)?;
    let gunluk: Box<dyn Write + Send> = match istek.get("gunluk").and_then(Value::as_str) {
      Some(yol) => Box::new(std::fs::File::create(yol).map_err(|e| format!("günlük dosyası: {e}"))?),
      None => Box::new(std::io::stderr()),
    };
    let mut m = Motor::baslat(ayar, olay.clone(), gunluk)?;
    // Etkinleştirilmiş üçüncü taraf eklentiler (panel kayıt defterinden, uyumluluk kapısından geçmiş olanlar)
    let istekler: Vec<crate::eklenti::EklentiIstegi> =
      istek.get("eklentiler").cloned().map(serde_json::from_value).transpose().map_err(|e| format!("eklentiler: {e}"))?.unwrap_or_default();
    let isaret = istek.get("isaret").and_then(Value::as_str).map(PathBuf::from);
    let eklentiler = m.eklentileri_yukle(&istekler, isaret.as_deref());
    let sonuc = json!({
      "libobs": m.surum(), "moduller": m.moduller(), "video_kodlayicilari": m.video_kodlayicilari(),
      "eklentiler": eklentiler, "giris_turleri": m.giris_turleri(), "video": m.video_ayari(),
    });
    *motor = Some(m);
    return Ok(sonuc);
  }
  let m = motor.as_mut().ok_or("motor başlatılmadı ('baslat' komutu önce gönderilmeli)")?;
  let id = || metin(istek, "id");
  Ok(match komut {
    "bilgi" => json!({
      "libobs": m.surum(), "moduller": m.moduller(),
      "video_kodlayicilari": m.video_kodlayicilari(), "giris_turleri": m.giris_turleri(),
      "kaynaklar": m.kaynak_listesi(),
    }),
    "moduller.yukle" => {
      let grup = match metin(istek, "grup")? {
        "temel" => TEMEL_MODULLER,
        "yakalama" => YAKALAMA_MODULLERI,
        "tarayici" => TARAYICI_MODULLERI,
        g => return Err(format!("bilinmeyen modül grubu: {g}")),
      };
      json!({ "yuklenen": m.modulleri_yukle(grup)? })
    }
    "tuval.olustur" => {
      m.tuval_olustur(id()?, metin(istek, "ad").unwrap_or(id()?), sayi(istek, "genislik", None)? as u32, sayi(istek, "yukseklik", None)? as u32)?;
      json!({})
    }
    "sahne.olustur" => {
      m.sahne_olustur(id()?, metin(istek, "tuval").unwrap_or("ana"), metin(istek, "ad").unwrap_or(id()?))?;
      json!({})
    }
    "sahne.etkinlestir" => {
      let gecis = istek.get("gecis").and_then(Value::as_bool).unwrap_or(false);
      let sure = istek.get("sure_ms").and_then(Value::as_u64).map(|x| x as u32);
      m.sahneye_gec(id()?, gecis, sure)?;
      json!({})
    }
    "sahne.adlandir" => {
      m.sahne_adlandir(id()?, metin(istek, "ad")?)?;
      json!({})
    }
    "sahne.sil" => {
      m.sahne_sil(id()?)?;
      json!({})
    }
    "program" => json!({ "sahne": m.program_sahnesi(metin(istek, "tuval")?) }),
    "kaynak.adlandir" => {
      m.kaynak_adlandir(id()?, metin(istek, "ad")?)?;
      json!({})
    }
    "kaynak.cogalt" => {
      m.kaynak_cogalt(id()?, metin(istek, "yeni")?, metin(istek, "ad")?)?;
      json!({})
    }
    "grup.olustur" => {
      let ogeler: Vec<String> = istek
        .get("ogeler")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
        .unwrap_or_default();
      json!({ "oge": m.grup_olustur(metin(istek, "sahne")?, id()?, metin(istek, "ad").unwrap_or("Grup"), &ogeler)? })
    }
    "grup.coz" => {
      m.grup_coz(metin(istek, "oge")?)?;
      json!({})
    }
    "grup.ekle" => {
      m.gruba_ekle(metin(istek, "grup")?, metin(istek, "oge")?)?;
      json!({})
    }
    "grup.cikar" => {
      m.gruptan_cikar(metin(istek, "oge")?)?;
      json!({})
    }
    "gecis.turleri" => json!({ "turler": crate::gecis::gecis_turleri() }),
    "gecis.ayarla" => {
      let sure = istek.get("sure_ms").and_then(Value::as_u64).map(|x| x as u32);
      m.gecis_ayarla(metin(istek, "tuval")?, istek.get("tur").and_then(Value::as_str), sure, istek.get("ayarlar").and_then(Value::as_object))?;
      json!({})
    }
    "gecis.bilgi" => {
      let t = metin(istek, "tuval")?;
      let (tur, sure) = m.gecis_bilgisi(t).unwrap_or((crate::gecis::VARSAYILAN_GECIS.into(), crate::gecis::VARSAYILAN_SURE_MS));
      json!({ "tur": tur, "sure_ms": sure, "program": m.program_sahnesi(t), "studyo": m.studyo_durumu(t) })
    }
    "gecis.ozellikler" => m.gecis_ozellikleri(metin(istek, "tuval")?)?,
    "gecis.guncelle" => {
      let ayarlar = istek.get("ayarlar").and_then(Value::as_object).ok_or("'ayarlar' nesnesi gerekli")?;
      m.gecis_guncelle(metin(istek, "tuval")?, ayarlar)?;
      json!({})
    }
    "studyo.ac" => {
      m.studyo_ac(metin(istek, "tuval")?)?;
      json!({})
    }
    "studyo.kapat" => {
      m.studyo_kapat(metin(istek, "tuval")?)?;
      json!({})
    }
    "studyo.onizleme" => {
      m.studyo_onizleme(metin(istek, "tuval")?, metin(istek, "sahne")?)?;
      json!({})
    }
    "multiview.ac" => {
      let sahneler: Vec<String> = istek.get("sahneler").and_then(Value::as_array).map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
      m.multiview_ac(metin(istek, "tuval")?, &sahneler)?
    }
    "kaynak_tuvali.ac" => m.kaynak_tuvali_ac(id()?)?,
    "kaynak_tuvali.kapat" => {
      m.kaynak_tuvali_kapat(id()?);
      json!({})
    }
    "multiview.kapat" => {
      m.multiview_kapat(metin(istek, "tuval")?);
      json!({})
    }
    "studyo.tbar" => {
      let konum = istek.get("konum").and_then(Value::as_f64).ok_or("konum (0–1) gerekli")? as f32;
      let etkin = m.studyo_tbar(metin(istek, "tuval")?, konum, istek.get("birak").and_then(Value::as_bool).unwrap_or(false))?;
      json!({ "etkin": etkin, "program": m.program_sahnesi(metin(istek, "tuval")?) })
    }
    "studyo.gecis" => {
      let sure = istek.get("sure_ms").and_then(Value::as_u64).map(|x| x as u32);
      m.studyo_gecis(metin(istek, "tuval")?, istek.get("takas").and_then(Value::as_bool).unwrap_or(false), sure)?;
      json!({})
    }
    "filtre.turleri" => json!({ "turler": crate::filtre::filtre_turleri() }),
    "filtre.ekle" => {
      let ayarlar = istek.get("ayarlar").and_then(Value::as_object).cloned().unwrap_or_default();
      m.filtre_ekle(metin(istek, "kaynak")?, id()?, metin(istek, "tur")?, metin(istek, "ad").unwrap_or(id()?), &ayarlar)?;
      json!({})
    }
    "filtre.sil" => {
      m.filtre_sil(id()?)?;
      json!({})
    }
    "filtre.sira" => {
      m.filtre_sira(id()?, metin(istek, "yon")?)?;
      json!({})
    }
    "filtre.etkin" => {
      m.filtre_etkin(id()?, istek.get("acik").and_then(Value::as_bool).ok_or("'acik' gerekli")?)?;
      json!({})
    }
    "filtre.adlandir" => {
      m.filtre_adlandir(id()?, metin(istek, "ad")?)?;
      json!({})
    }
    "filtre.listesi" => json!({ "filtreler": m.filtre_listesi(metin(istek, "kaynak")?)? }),
    "filtre.ozellikler" => m.filtre_ozellikleri(id()?)?,
    "filtre.guncelle" => {
      let ayarlar = istek.get("ayarlar").and_then(Value::as_object).ok_or("'ayarlar' nesnesi gerekli")?;
      m.filtre_guncelle(id()?, ayarlar)?;
      json!({})
    }
    "ses.listesi" => json!({ "kaynaklar": m.ses_listesi() }),
    "olcer.tepe_tipi" => {
      let gercek = istek.get("gercek").and_then(Value::as_bool).ok_or("'gercek' (true/false) gerekli")?;
      m.tepe_tipi_ayarla(gercek);
      json!({ "gercek": gercek })
    }
    "seviye.abone" => {
      m.seviye_abone(istek.get("acik").and_then(Value::as_bool).unwrap_or(false));
      json!({})
    }
    "seviyeler" => json!({ "seviyeler": m.seviyeler() }),
    "kaynak.denge" => {
      m.kaynak_denge(id()?, istek.get("deger").and_then(Value::as_f64).ok_or("'deger' gerekli")? as f32)?;
      json!({})
    }
    "kaynak.mono" => {
      m.kaynak_mono(id()?, istek.get("acik").and_then(Value::as_bool).ok_or("'acik' gerekli")?)?;
      json!({})
    }
    "kaynak.senkron" => {
      m.kaynak_senkron(id()?, istek.get("ms").and_then(Value::as_i64).ok_or("'ms' gerekli")?)?;
      json!({})
    }
    "kaynak.izleme" => {
      m.kaynak_izleme(id()?, istek.get("tur").and_then(Value::as_i64).ok_or("'tur' gerekli")? as i32)?;
      json!({})
    }
    "izleme.aygitlari" => {
      let (liste, secili) = m.izleme_aygitlari();
      json!({ "aygitlar": liste, "secili": secili })
    }
    "izleme.aygit" => {
      m.izleme_aygiti(metin(istek, "ad")?, id()?)?;
      json!({})
    }
    "medya" => {
      m.medya(id()?, metin(istek, "eylem")?)?;
      json!({})
    }
    "akis.baslat" => {
      m.akis_baslat(metin(istek, "tuval")?, sayi(istek, "genislik", Some(640))? as u32, sayi(istek, "fps", Some(10))? as u32)?;
      json!({})
    }
    "akis.durdur" => {
      m.akis_durdur(metin(istek, "tuval")?);
      json!({})
    }
    "kaynak.durumlari" => json!({ "kaynaklar": m.kaynak_durumlari() }),
    "ekran_goruntusu" => {
      let yol = PathBuf::from(metin(istek, "yol")?);
      let (g, y) = match metin(istek, "kaynak") {
        Ok(k) => m.kaynak_ekran_goruntusu(k, &yol)?,
        Err(_) => m.ekran_goruntusu(metin(istek, "tuval").unwrap_or("ana"), &yol)?,
      };
      json!({ "genislik": g, "yukseklik": y })
    }
    "kaynak.deinterlace" => {
      if istek.get("kip").is_some() {
        m.kaynak_deinterlace(id()?, sayi(istek, "kip", None)? as i32, sayi(istek, "alan", Some(0))? as i32)?;
      }
      let (k, a) = m.kaynak_deinterlace_oku(id()?)?;
      json!({ "kip": k, "alan": a })
    }
    "etkilesim" => {
      let olay = istek.get("olay").ok_or("'olay' gerekli")?;
      m.etkilesim(metin(istek, "kaynak")?, olay)?;
      json!({})
    }
    "etkilesim.ac" => m.etkilesim_ac(metin(istek, "kaynak")?)?,
    "etkilesim.kapat" => {
      m.etkilesim_kapat(metin(istek, "kaynak")?);
      json!({})
    }
    "oge.gecis" => {
      let ayarlar = istek.get("ayarlar").and_then(Value::as_object).cloned().unwrap_or_default();
      let goster = istek.get("goster").and_then(Value::as_bool).ok_or("'goster' (bool) gerekli")?;
      let tur = istek.get("tur").and_then(Value::as_str);
      let sure = sayi(istek, "sure_ms", Some(300))? as u32;
      m.oge_gecisi(metin(istek, "oge")?, goster, tur, sure, &ayarlar)?;
      json!({})
    }
    "oge.gecisleri" => m.oge_gecisleri(metin(istek, "oge")?)?,
    "kaynak.tur_ozellikleri" => crate::eklenti::kaynak_turu_ozellikleri(metin(istek, "tur")?)?,
    "kayit.bicimleri" => json!({ "bicimler": crate::motor::kayit_bicimleri() }),
    "kodlayici.ozellikleri" => crate::eklenti::kodlayici_ozellikleri(metin(istek, "tur")?)?,
    "cikis.tur_ozellikleri" => crate::eklenti::cikis_turu_ozellikleri(metin(istek, "tur")?)?,
    "video.ayari" => m.video_ayari(),
    "kaynak.olustur" => {
      let ayarlar = istek.get("ayarlar").and_then(Value::as_object).cloned().unwrap_or_default();
      m.kaynak_olustur(id()?, metin(istek, "tur")?, metin(istek, "ad").unwrap_or(id()?), &ayarlar)?;
      json!({})
    }
    "kaynak.ozellikler" => m.kaynak_ozellikleri(id()?)?,
    "kaynak.varsayilanlar" => {
      m.kaynak_varsayilanlar(id()?)?;
      json!({})
    }
    "kaynak.guncelle" => {
      let ayarlar = istek.get("ayarlar").and_then(Value::as_object).ok_or("'ayarlar' nesnesi gerekli")?;
      m.kaynak_guncelle(id()?, ayarlar)?;
      json!({})
    }
    "eklentiler" => json!({ "eklentiler": m.ucuncu_taraf() }),
    "kaynak.sil" => {
      m.kaynak_sil(id()?)?;
      json!({})
    }
    "kaynak.sessiz" => {
      m.kaynak_sessiz(id()?, istek.get("sessiz").and_then(Value::as_bool).ok_or("'sessiz' gerekli")?)?;
      json!({})
    }
    "kaynak.ses" => {
      m.kaynak_ses_seviyesi(id()?, istek.get("carpan").and_then(Value::as_f64).ok_or("'carpan' gerekli")? as f32)?;
      json!({})
    }
    "sahne.ekle" => {
      let oge = m.sahneye_ekle(metin(istek, "sahne")?, metin(istek, "kaynak")?, &donusum(istek.get("donusum")))?;
      json!({ "oge": oge })
    }
    "oge.donustur" => {
      m.donustur(metin(istek, "oge")?, &donusum(istek.get("donusum")))?;
      json!({})
    }
    "kodlayici.video" => {
      let ayar = KodlayiciAyari {
        bit_hizi_kbps: sayi(istek, "bit_hizi", Some(6000))?.clamp(200, 100_000) as u32,
        anahtar_kare_sn: sayi(istek, "anahtar_kare_sn", Some(2))?.clamp(1, 10) as u32,
      };
      let tur = m.video_kodlayici_ek(id()?, metin(istek, "tur").unwrap_or("otomatik"), metin(istek, "tuval").unwrap_or("ana"), &ayar, &istek.get("ayarlar").and_then(Value::as_object).cloned().unwrap_or_default())?;
      json!({ "tur": tur })
    }
    "kodlayici.sil" => {
      m.kodlayici_sil(id()?)?;
      json!({})
    }
    "kodlayici.ses" => {
      m.ses_kodlayici(id()?, sayi(istek, "bit_hizi", Some(160))?.clamp(32, 512) as u32, sayi(istek, "iz", Some(0))? as usize)?;
      json!({})
    }
    "cikis.rtmp" => {
      let ag: crate::motor::AgAyari =
        istek.get("ag").cloned().map(serde_json::from_value).transpose().map_err(|e| format!("ag: {e}"))?.unwrap_or_default();
      m.rtmp_cikisi(id()?, metin(istek, "sunucu")?, metin(istek, "anahtar").unwrap_or(""), metin(istek, "video")?, metin(istek, "ses")?, &ag)?;
      json!({})
    }
    "cikis.kayit" => {
      let sesler: Vec<&str> = istek.get("sesler").and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).collect()).unwrap_or_default();
      let bicim = istek.get("bicim").and_then(Value::as_str);
      let bolme: crate::motor::KayitBolme =
        istek.get("bolme").cloned().map(serde_json::from_value).transpose().map_err(|e| format!("bolme: {e}"))?.unwrap_or_default();
      m.kayit_cikisi_bolmeli(id()?, &PathBuf::from(metin(istek, "yol")?), bicim, metin(istek, "video")?, &sesler, &bolme)?;
      json!({})
    }
    "kayit.duraklat" => {
      let d = istek.get("duraklat").and_then(Value::as_bool).ok_or("'duraklat' (bool) gerekli")?;
      json!({ "duraklatildi": m.kayit_duraklat(id()?, d)? })
    }
    "sanal_kamera.baslat" => {
      m.sanal_kamera_baslat(metin(istek, "tuval").unwrap_or("ana"))?;
      json!({})
    }
    "sanal_kamera.durdur" => {
      m.sanal_kamera_durdur()?;
      json!({})
    }
    "kayit.bol" => {
      m.kayit_bol(id()?)?;
      json!({})
    }
    "cikis.baslat" => {
      m.cikis_baslat(id()?)?;
      json!({})
    }
    "cikis.sil" => {
      m.cikis_sil(id()?)?;
      json!({})
    }
    "cikis.durdur" => {
      m.cikis_durdur(id()?)?;
      json!({})
    }
    "istatistik" => serde_json::to_value(m.istatistik()).map_err(|e| e.to_string())?,
    "sahne.ogeler" => serde_json::to_value(m.sahne_ogeleri(metin(istek, "sahne")?)?).map_err(|e| e.to_string())?,
    "oge.sira" => {
      match istek.get("konum").and_then(Value::as_u64) {
        Some(k) => m.oge_sira_konumu(metin(istek, "oge")?, k as usize)?,
        None => m.oge_sira(metin(istek, "oge")?, metin(istek, "yon")?)?,
      }
      json!({})
    }
    "temizle" => {
      m.sahne_grafigini_temizle();
      json!({})
    }
    "oge.kaldir" => {
      m.oge_kaldir(metin(istek, "oge")?)?;
      json!({})
    }
    "kaynak.izler" => {
      m.kaynak_izleri(id()?, sayi(istek, "maske", None)? as u32)?;
      json!({ "maske": m.kaynak_izleri_oku(id()?) })
    }
    "kaynak.secenekler" => serde_json::to_value(m.ozellik_secenekleri(metin(istek, "tur")?, metin(istek, "ozellik")?)?)
      .map_err(|e| e.to_string())?,
    "cikis.tekrar" => {
      let sesler: Vec<&str> = istek.get("sesler").and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).collect()).unwrap_or_default();
      let sure = sayi(istek, "sure_sn", Some(30))? as u32;
      m.tekrar_cikisi(id()?, &PathBuf::from(metin(istek, "klasor")?), sure, metin(istek, "video")?, &sesler)?;
      json!({})
    }
    "tekrar.kaydet" => json!({ "yol": m.tekrar_kaydet(id()?)? }),
    "tuvaller" => serde_json::to_value(m.tuvaller()).map_err(|e| e.to_string())?,
    "onizleme" => {
      use base64::Engine as _;
      let en_fazla = sayi(istek, "genislik", Some(480))? as u32;
      match m.onizleme_png(metin(istek, "tuval").unwrap_or("ana"), en_fazla)? {
        Some(png) => json!({ "png": base64::engine::general_purpose::STANDARD.encode(png) }),
        None => json!({ "png": null, "hazirlaniyor": true }),
      }
    }
    k => return Err(format!("bilinmeyen komut: {k}")),
  })
}

/// Stdin kapanana ya da `kapat` gelene kadar komut işler. Olaylar ayrı iş parçacığından yazılır.
pub fn hizmet() -> Result<(), String> {
  let (olay_tx, olay_rx) = mpsc::channel::<Olay>();
  std::thread::spawn(move || {
    for o in olay_rx {
      // Doğrudan metne: alan sırası korunur (`{"olay":"kare","tuval":…`), panel büyük kare satırlarını
      // ayrıştırmadan önekle yönlendirir
      if let Ok(satir) = serde_json::to_string(&o) {
        yaz_metin(&satir);
      }
    }
  });
  yaz(&json!({ "olay": "hazir", "surum": env!("CARGO_PKG_VERSION") }));
  let mut motor: Option<Motor> = None;
  for satir in std::io::stdin().lock().lines() {
    let satir = satir.map_err(|e| e.to_string())?;
    if satir.trim().is_empty() {
      continue;
    }
    let istek: Value = match serde_json::from_str(&satir) {
      Ok(v) => v,
      Err(e) => {
        yaz(&json!({ "tamam": false, "hata": format!("geçersiz JSON: {e}") }));
        continue;
      }
    };
    let no = istek.get("no").cloned().unwrap_or(Value::Null);
    if istek.get("komut").and_then(Value::as_str) == Some("kapat") {
      if let Some(m) = motor.take() {
        m.kapat();
      }
      yaz(&json!({ "no": no, "tamam": true, "sonuc": {} }));
      return Ok(());
    }
    match yurut(&mut motor, &istek, &olay_tx) {
      Ok(sonuc) => yaz(&json!({ "no": no, "tamam": true, "sonuc": sonuc })),
      Err(hata) => yaz(&json!({ "no": no, "tamam": false, "hata": crate::obs::gizle(&hata) })),
    }
  }
  // Ebeveyn süreç kapandı: yayınları düzgün kapat
  if let Some(m) = motor.take() {
    m.kapat();
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn donusum_ayrisir_ve_bozuk_alan_yok_sayilir() {
    let d = donusum(Some(&json!({"konum": [10, 20.5], "olcek": [1, 2, 3], "sinir": [1080, 608], "aci": 90, "gorunur": false})));
    assert_eq!((d.konum.unwrap().x, d.konum.unwrap().y), (10.0, 20.5));
    assert!(d.olcek.is_none(), "üç elemanlı ölçek geçersiz");
    assert_eq!(d.sinir.unwrap().x, 1080.0);
    assert_eq!(d.aci, Some(90.0));
    assert_eq!(d.gorunur, Some(false));
    assert!(donusum(None).konum.is_none());
  }

  #[test]
  fn motor_baslamadan_komut_reddedilir() {
    let (tx, _rx) = mpsc::channel();
    let mut m = None;
    let e = yurut(&mut m, &json!({"komut": "istatistik"}), &tx).unwrap_err();
    assert!(e.contains("baslat"), "{e}");
    let e = yurut(&mut m, &json!({"no": 1}), &tx).unwrap_err();
    assert!(e.contains("komut"), "{e}");
  }

  #[test]
  fn alan_dogrulamasi() {
    assert!(sayi(&json!({"g": -1}), "g", None).is_err());
    assert_eq!(sayi(&json!({}), "g", Some(7)).unwrap(), 7);
    assert!(sayi(&json!({}), "g", None).is_err());
    assert!(metin(&json!({"a": 1}), "a").is_err());
  }

  #[test]
  fn video_ses_ayari_ayristirma() {
    // Verilmeyen alanlar OBS varsayılanı; çıkış = taban
    let v = motor_ayari(&json!({"genislik": 2560, "yukseklik": 1440})).unwrap();
    assert_eq!((v.cikis_genislik, v.cikis_yukseklik, v.ornekleme), (2560, 1440, 48_000));
    assert_eq!(v, MotorAyari { genislik: 2560, yukseklik: 1440, cikis_genislik: 2560, cikis_yukseklik: 1440, ..MotorAyari::yeni(2560, 1440, 60) });
    let o = motor_ayari(&json!({
      "cikis_genislik": 1280, "cikis_yukseklik": 720, "olcek_filtresi": "lanczos", "renk_bicimi": "p010",
      "renk_uzayi": "2100pq", "renk_araligi": "tam", "ornekleme": 44100, "hoparlor": "5.1"
    }))
    .unwrap();
    assert_eq!((o.cikis_genislik, o.olcek, o.bicim, o.renk_uzayi, o.aralik, o.ornekleme, o.hoparlor), (1280, 4, 18, 4, 2, 44_100, 6));
    let e = motor_ayari(&json!({"renk_bicimi": "yuv9"})).unwrap_err();
    assert!(e.contains("nv12"), "{e}");
    assert!(crate::motor::renk_denetimi(2, 4).is_err());
    assert!(crate::motor::renk_denetimi(18, 2).is_ok());
  }

  #[test]
  fn ag_ayari_dogrulama() {
    let v: crate::motor::AgAyari = serde_json::from_value(json!({"dusuk_gecikme": true})).unwrap();
    assert!(v.dusuk_gecikme && v.yeniden_baglan && v.bagla_ip == "default" && v.en_cok_deneme == 25);
    assert!(v.denetle().is_ok());
    for kotu in [json!({"bagla_ip": "eth0"}), json!({"ip_ailesi": "IPv5"}), json!({"deneme_gecikmesi_sn": 0}), json!({"en_cok_deneme": 99999})] {
      let a: crate::motor::AgAyari = serde_json::from_value(kotu.clone()).unwrap();
      assert!(a.denetle().is_err(), "{kotu}");
    }
    let ip6: crate::motor::AgAyari = serde_json::from_value(json!({"bagla_ip": "::1"})).unwrap();
    assert!(ip6.denetle().is_ok());
  }

  #[test]
  fn olay_satiri_alan_sirasini_korur() {
    // Panel kare ve seviye satırlarını ayrıştırmadan bu öneklerle yönlendirir
    let k = serde_json::to_string(&Olay::Kare { tuval: "ana".into(), jpeg: "QQ==".into() }).unwrap();
    assert!(k.starts_with(r#"{"olay":"kare","tuval":"ana""#), "{k}");
    let s = serde_json::to_string(&Olay::Seviyeler { seviyeler: vec![] }).unwrap();
    assert!(s.starts_with(r#"{"olay":"seviyeler""#), "{s}");
  }
}
