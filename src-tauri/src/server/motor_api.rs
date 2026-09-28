//! Yerel yayın çekirdeği HTTP yüzü (`/api/motor…`). Her uç: izin → yürütme → denetim günlüğü.
//!
//! Yapı: ana tuval ve isteğe bağlı dikey tuval; her tuvalde birden çok sahne (etkin sahne koleksiyonundan). Sahne
//! koleksiyonu (`motor_koleksiyon`) her değişiklikte diske yazılır ve motor açılınca geri kurulur. Sahne/öğe/geçiş/
//! Studio Mode uçları `motor_sahne_api`, ses/filtre/canlı akış uçları `motor_ses_api` içindedir. Hedefler çoklu yayın ayarlarındaki hedeflerdir; anahtar
//! Kimlik Yöneticisinden okunur ve yalnız çekirdeğe gider.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{ConnectInfo, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use super::control_plane::{audit, authorize};
use crate::eklenti::{self as ekl, kayit::Cokme};
use crate::motor_koleksiyon::{self as kol, Donusum, KaynakKaydi, Koleksiyon, OgeTuru, Okuma, SahneOgesi};
use crate::motor_kopru::{self, kaynak_tanimi};
use crate::AppState;

type ApiResult = Result<Json<Value>, (StatusCode, String)>;
pub(crate) type Hata = (StatusCode, String);

pub fn router() -> Router<Arc<AppState>> {
  Router::new()
    .route("/api/motor", get(api_durum))
    .route("/api/motor/baslat", post(api_baslat))
    .route("/api/motor/durdur", post(api_durdur))
    .route("/api/motor/kaynak", post(api_kaynak_ekle))
    .route("/api/motor/kaynak/sil", post(api_kaynak_sil))
    .route("/api/motor/kaynak/izler", post(api_kaynak_izler))
    .route("/api/motor/kaynak/ozellikler", get(api_kaynak_ozellikler))
    .route("/api/motor/kaynak/guncelle", post(api_kaynak_guncelle))
    .route("/api/motor/secenekler", get(api_secenekler))
    .route("/api/motor/sahne", get(api_sahne))
    .route("/api/motor/hedef", post(api_hedef))
    .route("/api/motor/golive", post(api_golive))
    .route("/api/motor/kayit", post(api_kayit))
    .route("/api/motor/tekrar", post(api_tekrar))
    .route("/api/motor/sanal-kamera", post(api_sanal_kamera))
    .route("/api/motor/klasor-ac", post(api_klasor_ac))
    .route("/api/motor/ekran-goruntusu", post(api_ekran_goruntusu))
    .route("/api/motor/gunluk", get(api_gunluk))
    .route("/api/motor/onizleme", get(api_onizleme))
}

pub(crate) fn catisma(e: String) -> Hata {
  (StatusCode::CONFLICT, e)
}

pub(crate) fn gecersiz(e: String) -> Hata {
  (StatusCode::BAD_REQUEST, e)
}

/// Tuval kimliği → (genişlik, yükseklik)
/// Önizleme/canlı kare istenebilecek tuval adı: `ana`, `dikey`, `studyo-<tuval>`, `etkilesim-<kaynak>`
pub(crate) fn onizleme_tuvali_gecerli(t: &str) -> bool {
  if let Some(k) = t.strip_prefix("etkilesim-") {
    return kol::gecerli_kimlik(k);
  }
  tuval_boyutu(t.strip_prefix("studyo-").unwrap_or(t)).is_some()
}

pub(crate) fn tuval_boyutu(tuval: &str) -> Option<(u32, u32)> {
  match tuval {
    "ana" => Some((1920, 1080)),
    "dikey" => Some((1080, 1920)),
    _ => None,
  }
}

pub(crate) fn klasor(state: &AppState) -> PathBuf {
  state.data_dir.join("motor")
}

/// Kayıt ve tekrar dosyalarının klasörü: `YYA_MOTOR_KAYIT_DIR` > `%USERPROFILE%\Videos\Yayin Motoru`.
pub(crate) fn kayit_klasoru() -> PathBuf {
  if let Some(d) = std::env::var_os("YYA_MOTOR_KAYIT_DIR") {
    return PathBuf::from(d);
  }
  let kok = std::env::var_os("USERPROFILE").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
  kok.join("Videos").join("Yayin Motoru")
}

/// Panel türü → (libobs türü, seçenek özelliği) — aygıt/pencere/ekran seçimi için.
fn secenek_ozelligi(tur: &str) -> Option<(&'static str, &'static str)> {
  Some(match tur {
    "ekran" => ("monitor_capture", "monitor_id"),
    "pencere" => ("window_capture", "window"),
    "oyun" => ("game_capture", "window"),
    "uygulama_sesi" => ("wasapi_process_output_capture", "window"),
    "kamera" => ("dshow_input", "video_device_id"),
    "mikrofon" => ("wasapi_input_capture", "device_id"),
    "masaustu" => ("wasapi_output_capture", "device_id"),
    _ => return None,
  })
}

/// Motor çıktısının (h-<hedef>) canlı ya da bağlanıyor olup olmadığı — aynı hedefe iki yayıncı bağlanmasın.
pub fn motor_hedefi_etkin(state: &AppState, hedef: &str) -> bool {
  cikis_etkin(state, &format!("h-{hedef}"))
}

pub(crate) fn cikis_etkin(state: &AppState, cikis: &str) -> bool {
  let o = state.motor.ozet();
  let o = o.lock();
  o.cikislar
    .get(cikis)
    .and_then(|v| v.get("durum").and_then(Value::as_str))
    .is_some_and(|d| matches!(d, "baglaniyor" | "canli" | "yeniden_baglaniyor" | "durduruluyor"))
}

pub(crate) async fn komut(state: &AppState, v: Value) -> Result<Value, Hata> {
  state.motor.komut(v).await.map_err(catisma)
}

// ─── Koleksiyon: kurma ve kaydetme ─────────────────────────────────────────

/// Motordaki güncel öğeleri (sıra, gruplar, dönüşüm) her sahne için koleksiyona işler ve diske yazar.
pub(crate) async fn kaydet(state: &AppState) -> Result<(), Hata> {
  let sahneler: Vec<String> = {
    let o = state.motor.ozet();
    let o = o.lock();
    let tuvaller = o.koleksiyon.tuvaller();
    o.koleksiyon.sahneler.iter().filter(|s| tuvaller.contains(&s.tuval.as_str())).map(|s| s.id.clone()).collect()
  };
  kaydet_sahneler(state, &sahneler).await
}

/// Yalnız verilen sahneleri motordan eşitler ve koleksiyonu diske yazar.
pub(crate) async fn kaydet_sahneler(state: &AppState, sahneler: &[String]) -> Result<(), Hata> {
  let mut okunan = Vec::new();
  for sahne in sahneler {
    let ogeler = komut(state, json!({"komut": "sahne.ogeler", "sahne": sahne})).await?;
    okunan.push((sahne.clone(), ogeler.as_array().cloned().unwrap_or_default()));
  }
  let k = {
    let o = state.motor.ozet();
    let mut o = o.lock();
    for (sahne, ogeler) in &okunan {
      o.koleksiyon.sahneyi_guncelle(sahne, ogeler);
    }
    o.koleksiyon.clone()
  };
  kol::yaz(&klasor(state), &k).map_err(catisma)
}

/// Koleksiyonu (motordan eşitlemeden) diske yazar — kaynak ayarı, ses, filtre gibi panelin kendisinin tuttuğu
/// değişikliklerden sonra.
pub(crate) fn koleksiyonu_yaz(state: &AppState) -> Result<(), Hata> {
  let k = state.motor.ozet().lock().koleksiyon.clone();
  kol::yaz(&klasor(state), &k).map_err(catisma)
}

/// libobs türünün gerektirdiği isteğe bağlı modül grubu
fn modul_grubu(obs_turu: &str) -> Option<&'static str> {
  match obs_turu {
    "monitor_capture" | "window_capture" | "game_capture" | "dshow_input" | "wasapi_input_capture" | "wasapi_output_capture"
    | "wasapi_process_output_capture" => Some("yakalama"),
    "browser_source" => Some("tarayici"),
    _ => None,
  }
}

/// Modül grubunu (yakalama | tarayici) bir kez yükler ve kayıtlı giriş türlerini tazeler.
pub(crate) async fn modul_grubu_yukle(state: &AppState, grup: &str) -> Result<(), Hata> {
  if state.motor.ozet().lock().yuklu_gruplar.contains(grup) {
    return Ok(());
  }
  komut(state, json!({"komut": "moduller.yukle", "grup": grup})).await?;
  let bilgi = komut(state, json!({"komut": "bilgi"})).await?;
  let o = state.motor.ozet();
  let mut o = o.lock();
  o.yuklu_gruplar.insert(grup.to_string());
  o.giris_turleri = bilgi["giris_turleri"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
  Ok(())
}

async fn yakalama_modulleri(state: &AppState) -> Result<(), Hata> {
  modul_grubu_yukle(state, "yakalama").await
}

/// Kaynağı motorda oluşturur; ses özellikleri ve filtreleri uygular. Tür kayıtlı değilse (eklenti yok) `false`
/// döner: kayıt korunur, `eksik` işaretlenir. Kurulamayan filtre (türü yok) kaynağı düşürmez; kaydı korunur.
pub(crate) async fn kaynak_kur(state: &AppState, k: &KaynakKaydi) -> Result<bool, Hata> {
  if let Some(g) = modul_grubu(&k.obs_turu) {
    modul_grubu_yukle(state, g).await?;
  } else if k.tur == "eklenti" {
    yakalama_modulleri(state).await?;
  }
  let kayitli = state.motor.ozet().lock().giris_turleri.iter().any(|t| t == &k.obs_turu);
  if !kayitli {
    return Ok(false);
  }
  // Parola alanları dosyadan değil Kimlik Yöneticisinden gelir (yalnız motora gider)
  let mut ayarlar = k.ayarlar.clone();
  for alan in &k.gizli_alanlar {
    if let Some(deger) = crate::secret_store::get_secret(&gizli_anahtar(&k.id, alan)) {
      if let Some(m) = ayarlar.as_object_mut() {
        m.insert(alan.clone(), json!(deger));
      } else {
        ayarlar = json!({ alan.clone(): deger });
      }
    }
  }
  komut(state, json!({"komut": "kaynak.olustur", "id": k.id, "tur": k.obs_turu, "ad": k.ad, "ayarlar": ayarlar})).await?;
  if k.izler != 0x3F {
    komut(state, json!({"komut": "kaynak.izler", "id": k.id, "maske": k.izler})).await?;
  }
  let s = &k.ses;
  if !s.varsayilan_mi() {
    komut(state, json!({"komut": "kaynak.ses", "id": k.id, "carpan": s.ses})).await?;
    komut(state, json!({"komut": "kaynak.sessiz", "id": k.id, "sessiz": s.sessiz})).await?;
    komut(state, json!({"komut": "kaynak.denge", "id": k.id, "deger": s.denge})).await?;
    komut(state, json!({"komut": "kaynak.mono", "id": k.id, "acik": s.mono})).await?;
    komut(state, json!({"komut": "kaynak.senkron", "id": k.id, "ms": s.senkron_ms})).await?;
    komut(state, json!({"komut": "kaynak.izleme", "id": k.id, "tur": s.izleme})).await?;
  }
  if k.deinterlace != [0, 0] {
    komut(state, json!({"komut": "kaynak.deinterlace", "id": k.id, "kip": k.deinterlace[0], "alan": k.deinterlace[1]})).await?;
  }
  filtreleri_kur(state, &k.id, &k.filtreler).await?;
  Ok(true)
}

/// Filtreleri sahibine (kaynak, sahne ya da grup) kurar; türü olmayan filtre uyarıyla atlanır (kayıt korunur)
pub(crate) async fn filtreleri_kur(state: &AppState, sahip: &str, filtreler: &[kol::FiltreKaydi]) -> Result<(), Hata> {
  for f in filtreler {
    let r = komut(state, json!({"komut": "filtre.ekle", "kaynak": sahip, "id": f.id, "tur": f.tur, "ad": f.ad, "ayarlar": f.ayarlar})).await;
    match r {
      Ok(_) if !f.etkin => {
        komut(state, json!({"komut": "filtre.etkin", "id": f.id, "acik": false})).await?;
      }
      Ok(_) => {}
      Err((_, e)) => crate::yya_warn!("[motor] filtre kurulamadı ({sahip} / {}): {e}", f.tur),
    }
  }
  Ok(())
}

/// Öğenin gösterme/gizleme geçişlerini kurar (tür kayıtlı değilse uyarıyla atlanır)
pub(crate) async fn oge_gecislerini_kur(state: &AppState, oge: &str, o: &SahneOgesi) {
  for (goster, g) in [(true, &o.goster_gecisi), (false, &o.gizle_gecisi)] {
    if let Some(g) = g {
      let istek = json!({"komut": "oge.gecis", "oge": oge, "goster": goster, "tur": g.tur, "sure_ms": g.sure_ms, "ayarlar": g.ayarlar.as_object().cloned().unwrap_or_default()});
      if let Err((_, e)) = komut(state, istek).await {
        crate::yya_warn!("[motor] öğe geçişi kurulamadı ({oge} / {}): {e}", g.tur);
      }
    }
  }
}

/// Sahne öğesini (grupsa çocuklarıyla) motorda kurar. Dönüş: öğe kimliği; eksik kaynağınki `None`.
pub(crate) async fn oge_kur(state: &AppState, sahne: &str, o: &SahneOgesi, eksikler: &std::collections::HashSet<String>) -> Result<Option<String>, Hata> {
  match o.tur {
    OgeTuru::Kaynak | OgeTuru::Sahne => {
      if o.tur == OgeTuru::Kaynak && eksikler.contains(&o.kaynak) {
        return Ok(None);
      }
      let v = komut(state, json!({"komut": "sahne.ekle", "sahne": sahne, "kaynak": o.kaynak, "donusum": o.donusum.motor_json()})).await?;
      let id = v["oge"].as_str().map(String::from);
      if let Some(id) = &id {
        oge_gecislerini_kur(state, id, o).await;
      }
      Ok(id)
    }
    OgeTuru::Grup => {
      let mut cocuklar = Vec::new();
      for c in o.cocuklar.iter().filter(|c| c.tur != OgeTuru::Grup) {
        if let Some(id) = Box::pin(oge_kur(state, sahne, c, eksikler)).await? {
          cocuklar.push((id, c));
        }
      }
      let ids: Vec<&String> = cocuklar.iter().map(|(id, _)| id).collect();
      let v = komut(state, json!({"komut": "grup.olustur", "sahne": sahne, "id": o.kaynak, "ad": o.ad, "ogeler": ids})).await?;
      let grup = v["oge"].as_str().map(String::from);
      // Çocukların dönüşümü grup içi (yerel) koordinatlarda; sonra grubun kendisi
      for (id, c) in &cocuklar {
        komut(state, json!({"komut": "oge.donustur", "oge": id, "donusum": c.donusum.motor_json()})).await?;
      }
      if let Some(g) = &grup {
        komut(state, json!({"komut": "oge.donustur", "oge": g, "donusum": o.donusum.motor_json()})).await?;
        filtreleri_kur(state, &o.kaynak, &o.filtreler).await?;
        oge_gecislerini_kur(state, g, o).await;
      }
      Ok(grup)
    }
  }
}

/// Koleksiyonun sahne grafiğini kurar: etkin tuvallerdeki sahneler, öğeler (gruplar dahil), geçişler, program.
/// Kaynaklar önceden kurulmuş olmalı (`kaynak_kur`).
pub(crate) async fn grafigi_kur(state: &AppState, k: &Koleksiyon) -> Result<(), Hata> {
  let tuvaller = k.tuvaller();
  let sahneler: Vec<&kol::SahneKaydi> = k.sahneler.iter().filter(|s| tuvaller.contains(&s.tuval.as_str())).collect();
  for s in &sahneler {
    komut(state, json!({"komut": "sahne.olustur", "id": s.id, "tuval": s.tuval, "ad": s.ad})).await?;
    filtreleri_kur(state, &s.id, &s.filtreler).await?;
  }
  let eksikler: std::collections::HashSet<String> = k.kaynaklar.iter().filter(|r| r.eksik).map(|r| r.id.clone()).collect();
  // İç içe sahne öğeleri tüm sahneler var olduktan sonra eklenir (sıra: listedeki sahne sırası)
  for s in &sahneler {
    for o in &s.ogeler {
      oge_kur(state, &s.id, o, &eksikler).await?;
    }
  }
  for tv in &tuvaller {
    if let Some(g) = k.gecisler.get(*tv) {
      let mut istek = json!({"komut": "gecis.ayarla", "tuval": tv, "tur": g.tur, "sure_ms": g.sure_ms});
      if g.ayarlar.is_object() {
        istek["ayarlar"] = g.ayarlar.clone();
      }
      if let Err((_, e)) = komut(state, istek).await {
        crate::yya_warn!("[motor] geçiş kurulamadı ({tv} / {}): {e}", g.tur);
      }
    }
    if let Some(p) = k.program.get(*tv) {
      komut(state, json!({"komut": "sahne.etkinlestir", "id": p, "gecis": false})).await?;
    }
  }
  Ok(())
}

/// Kaynakları ve sahne grafiğini kurar; eksik kaynakları işaretler. Dönüş: işaretlenmiş koleksiyon.
pub(crate) async fn koleksiyonu_kur(state: &AppState, mut k: Koleksiyon) -> Result<Koleksiyon, Hata> {
  if k.dikey && !state.motor.ozet().lock().dikey_tuval {
    let (g, y) = state.motor.ozet().lock().profil.tuval_boyutu("dikey");
    komut(state, json!({"komut": "tuval.olustur", "id": "dikey", "ad": "Dikey", "genislik": g, "yukseklik": y})).await?;
    state.motor.ozet().lock().dikey_tuval = true;
  }
  let mut kaynaklar = k.kaynaklar.clone();
  for rec in kaynaklar.iter_mut() {
    rec.eksik = !kaynak_kur(state, rec).await?;
  }
  k.kaynaklar = kaynaklar;
  grafigi_kur(state, &k).await?;
  Ok(k)
}

/// Tuvalin (ya da hedefe özel bit hızının) video kodlayıcısını profilden kurar; aynı kimlik bir kez kurulur
/// (kodlama paylaşımı: aynı tuval + aynı bit hızı → tek kodlayıcı). Dönüş: kodlayıcı kimliği.
async fn video_kodlayici_hazirla(state: &AppState, tuval: &str, bit_hizi: Option<u32>) -> Result<String, Hata> {
  let (id, kbps, tur, anahtar_kare, uzman) = {
    let o = state.motor.ozet();
    let o = o.lock();
    let p = &o.profil;
    let (id, kbps) = p.hedef_kodlayicisi(tuval, bit_hizi);
    if o.kodlayicilar.contains(&id) {
      return Ok(id);
    }
    (id, kbps, p.cikis.kodlayici.clone(), p.cikis.anahtar_kare_sn, p.uzman_ayarlari(&p.cikis.kodlayici))
  };
  komut(state, json!({"komut": "kodlayici.video", "id": id, "tur": tur, "tuval": tuval, "bit_hizi": kbps, "anahtar_kare_sn": anahtar_kare, "ayarlar": uzman})).await?;
  state.motor.ozet().lock().kodlayicilar.insert(id.clone());
  Ok(id)
}

async fn kodlayici_hazirla(state: &AppState, tuval: &str) -> Result<(), Hata> {
  video_kodlayici_hazirla(state, tuval, None).await.map(|_| ())
}

pub(crate) async fn ses_hazirla(state: &AppState, iz: u8) -> Result<(), Hata> {
  if iz > 5 {
    return Err(gecersiz("ses izi 1–6 olmalı".into()));
  }
  if state.motor.ozet().lock().ses_izleri.contains(&iz) {
    return Ok(());
  }
  let bit_hizi = state.motor.ozet().lock().profil.cikis.ses_bit_hizi;
  komut(state, json!({"komut": "kodlayici.ses", "id": format!("ses-{iz}"), "bit_hizi": bit_hizi, "iz": iz})).await?;
  state.motor.ozet().lock().ses_izleri.insert(iz);
  Ok(())
}

/// Profilin çıkış/kayıt ayarı değişince: boştaki (yayında/kayıtta olmayan) çıktılar ve kodlayıcılar bırakılır,
/// bir sonraki başlatmada yeni ayarlarla kurulur. Etkin çıktılar sürer (yeni ayar onlar durunca uygulanır).
pub(crate) async fn kodlayicilari_tazele(state: &AppState) {
  if !state.motor.calisiyor().await {
    return;
  }
  let (hedefler, kayit, tekrar) = {
    let o = state.motor.ozet();
    let o = o.lock();
    (o.hedef_tuval.keys().cloned().collect::<Vec<_>>(), o.kayit_cikisi_var, o.tekrar_cikisi_var)
  };
  for h in hedefler {
    let cikis = format!("h-{h}");
    if !cikis_etkin(state, &cikis) && komut(state, json!({"komut": "cikis.sil", "id": cikis})).await.is_ok() {
      state.motor.ozet().lock().hedef_tuval.remove(&h);
    }
  }
  if kayit && !cikis_etkin(state, "kayit") && komut(state, json!({"komut": "cikis.sil", "id": "kayit"})).await.is_ok() {
    state.motor.ozet().lock().kayit_cikisi_var = false;
  }
  if tekrar && !cikis_etkin(state, "tekrar") && komut(state, json!({"komut": "cikis.sil", "id": "tekrar"})).await.is_ok() {
    state.motor.ozet().lock().tekrar_cikisi_var = false;
  }
  let dikey = state.motor.ozet().lock().tekrar_dikey_var;
  if dikey && !cikis_etkin(state, "tekrar-dikey") && komut(state, json!({"komut": "cikis.sil", "id": "tekrar-dikey"})).await.is_ok() {
    state.motor.ozet().lock().tekrar_dikey_var = false;
  }
  let (videolar, sesler) = {
    let o = state.motor.ozet();
    let o = o.lock();
    (o.kodlayicilar.iter().cloned().collect::<Vec<_>>(), o.ses_izleri.iter().copied().collect::<Vec<_>>())
  };
  for v in videolar {
    if komut(state, json!({"komut": "kodlayici.sil", "id": v})).await.is_ok() {
      state.motor.ozet().lock().kodlayicilar.remove(&v);
    }
  }
  for iz in sesler {
    if komut(state, json!({"komut": "kodlayici.sil", "id": format!("ses-{iz}")})).await.is_ok() {
      state.motor.ozet().lock().ses_izleri.remove(&iz);
    }
  }
}

/// Etkin profili motor özetine yükler (başlatmada ve profil değişince)
pub(crate) fn profili_yukle(state: &AppState) -> crate::motor_profil::Profil {
  let p = crate::motor_profil::etkin(&klasor(state));
  state.motor.ozet().lock().profil = p.clone();
  p
}

/// Profil değişikliğini diske ve (motor çalışıyorsa) özete yazar
pub(crate) fn profil_yaz(state: &AppState, p: &crate::motor_profil::Profil) -> Result<(), Hata> {
  crate::motor_profil::etkin_yaz(&klasor(state), p).map_err(catisma)?;
  state.motor.ozet().lock().profil = p.clone();
  Ok(())
}

// ─── Uçlar ─────────────────────────────────────────────────────────────────

async fn api_durum(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let cokme = cokme_denetle(&state).await;
  let calisiyor = state.motor.calisiyor().await;
  let (istatistik, tuvaller) = if calisiyor {
    (
      state.motor.komut(json!({"komut": "istatistik"})).await.unwrap_or(Value::Null),
      state.motor.komut(json!({"komut": "tuvaller"})).await.unwrap_or(Value::Null),
    )
  } else {
    (Value::Null, Value::Null)
  };
  let kayitli = match kol::oku(&klasor(&state)) {
    Okuma::Tamam(k) => Some(k),
    _ => None,
  };
  let profil = if calisiyor { state.motor.ozet().lock().profil.clone() } else { crate::motor_profil::etkin(&klasor(&state)) };
  let ozet = state.motor.ozet();
  let o = ozet.lock();
  let kol_ = if calisiyor { Some(o.koleksiyon.clone()) } else { kayitli };
  let router_durum: std::collections::HashMap<String, bool> =
    state.multistream.snapshot().destinations.iter().map(|d| (d.id.clone(), d.state.is_active())).collect();
  let hedefler: Vec<Value> = state
    .multistream
    .configs()
    .into_iter()
    .map(|c| {
      let cikis = o.cikislar.get(&format!("h-{}", c.id));
      let atama = profil.hedefler.get(&c.id).cloned();
      json!({
        "id": c.id,
        "ad": c.name,
        "platform": c.platform,
        "etkin": c.enabled,
        "anahtarVar": state.multistream.key_for(&c.id).is_some(),
        "tuval": atama.as_ref().map(|a| a.tuval.clone()),
        "iz": atama.as_ref().map(|a| a.iz),
        "bitHizi": atama.as_ref().and_then(|a| a.bit_hizi),
        "durum": cikis.and_then(|v| v.get("durum")).cloned().unwrap_or(json!("hazir")),
        "kod": cikis.and_then(|v| v.get("kod")).cloned(),
        "yonlendiricideCanli": router_durum.get(&c.id).copied().unwrap_or(false),
      })
    })
    .collect();
  let durum = |id: &str| o.cikislar.get(id).and_then(|v| v.get("durum")).cloned().unwrap_or(json!("hazir"));
  let mut kodlayicilar: Vec<&String> = o.kodlayicilar.iter().collect();
  kodlayicilar.sort();
  Ok(Json(json!({
    "calisiyor": calisiyor,
    "exeVar": motor_kopru::exe_yolu().is_some(),
    "bilgi": o.bilgi,
    "dikey": kol_.as_ref().map(|k| k.dikey).unwrap_or(false),
    "fps": profil.fps,
    "tuvalBoyutlari": {"ana": profil.tuval_boyutu("ana"), "dikey": profil.tuval_boyutu("dikey")},
    "video": profil.video,
    "gpu": crate::gpu::kullanim(if calisiyor { o.motor_pid } else { None }),
    "tuvaller": tuvaller,
    "istatistik": istatistik,
    "kaynaklar": kol_.as_ref().map(|k| json!(k.kaynaklar)).unwrap_or(json!([])),
    "hedefler": hedefler,
    "kayit": {
      "durum": durum("kayit"), "son": o.son_kayit,
      "duraklatildi": istatistik["cikislar"].as_array().and_then(|a| a.iter().find(|c| c["id"] == "kayit")).and_then(|c| c["duraklatildi"].as_bool()).unwrap_or(false),
      "ayriKodlayici": profil.kayit.ayri_kodlayici,
    },
    "tekrar": {"durum": durum("tekrar"), "sureSn": profil.tekrar_sn, "son": o.son_tekrar, "dikey": o.tekrar_dikey_var.then(|| durum("tekrar-dikey"))},
    "sanalKamera": {"durum": durum("sanal-kamera")},
    "profil": {"id": crate::motor_profil::etkin_kimlik(&klasor(&state)), "ad": profil.ad},
    // Kodlama paylaşımı tanısı: kurulu video kodlayıcıları (aynı tuval + bit hızı tek kodlayıcı)
    "kodlayicilar": kodlayicilar,
    "kayitKlasoru": kayit_klasoru(),
    "sonCikisKodu": o.son_cikis_kodu,
    "cokme": cokme,
    "eklentiler": if calisiyor { json!(o.eklenti_sonuclari) } else { json!([]) },
    "guvenliKip": calisiyor && o.guvenli_kip,
  })))
}

#[derive(Deserialize, Default)]
pub(crate) struct BaslatGovdesi {
  #[serde(default)]
  pub(crate) dikey: Option<bool>,
  #[serde(default)]
  pub(crate) fps: Option<u32>,
  /// Önceki çökme için karar: normal | guvenli | devre-disi
  #[serde(default)]
  pub(crate) cokme_karari: Option<String>,
  /// Üçüncü taraf eklentisiz başlat (tek seferlik)
  #[serde(default)]
  pub(crate) guvenli_kip: bool,
}

async fn api_baslat(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<BaslatGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.stream").await?;
  motoru_baslat(&state, &actor, g).await.map(Json)
}

/// Motoru başlatır, etkin koleksiyonu ve profili kurar (çökme kapısı dahil). HTTP ucu ve profil değişimi kullanır.
pub(crate) async fn motoru_baslat(state: &AppState, actor: &super::control_plane::Actor, g: BaslatGovdesi) -> Result<Value, Hata> {
  let dizin = klasor(state);
  let (mut k, not) = match kol::oku(&dizin) {
    Okuma::Yok => (Koleksiyon::default(), None),
    Okuma::Tamam(k) => (k, None),
    Okuma::YeniSurum(s) => return Err(catisma(format!("sahne koleksiyonu daha yeni bir sürümle (v{s}) yazılmış; bu sürüm açamaz"))),
    Okuma::Bozuk(e) => {
      let yedek = kol::bozugu_yedekle(&dizin);
      (Koleksiyon::default(), Some(format!("bozuk koleksiyon kenara alındı ({e}): {yedek:?}")))
    }
  };
  if let Some(d) = g.dikey {
    k.dikey = d;
  }
  let mut profil = crate::motor_profil::etkin(&dizin);
  if let Some(f) = g.fps {
    if !(f == 30 || f == 60) {
      return Err(gecersiz("fps 30 ya da 60 olmalı".into()));
    }
    if f != profil.fps {
      profil.fps = f;
      crate::motor_profil::etkin_yaz(&dizin, &profil).map_err(catisma)?;
    }
  }
  let m = &state.motor;
  if m.calisiyor().await {
    return Err(catisma("motor zaten çalışıyor".into()));
  }
  // Çökme kapısı: üçüncü taraf eklentiyle çalışan önceki oturum düştüyse kullanıcı karar vermeden başlatılmaz
  let bekleyen = cokme_denetle(state).await;
  let mut guvenli = g.guvenli_kip;
  {
    let _kilit = state.eklenti_kilidi.lock().await;
    let (mut d, _) = ekl::kayit::oku(&state.data_dir);
    if let Some(c) = &bekleyen {
      let Some(karar) = g.cokme_karari.as_deref() else {
        let ne = match &c.supheli {
          Some(s) => format!("«{s}» eklentisi yüklenirken"),
          None => "üçüncü taraf eklentilerle çalışırken".into(),
        };
        return Err(catisma(format!("Önceki motor oturumu {ne} kapandı{}; nasıl başlatılacağını seçin", kod_metni(c.cikis_kodu))));
      };
      guvenli |= ekl::kayit::cokme_karari(&mut d, karar).map_err(gecersiz)?;
      ekl::kayit::yaz(&state.data_dir, &d).map_err(catisma)?;
    }
  }
  // Yüklenecek üçüncü taraf eklentiler (etkin + uyumluluk kapısından geçmiş + karantinada değil)
  let eklentiler: Vec<Value> = if guvenli {
    Vec::new()
  } else {
    let (d, _) = ekl::kayit::oku(&state.data_dir);
    d.eklentiler
      .iter()
      .filter(|e| e.yuklenecek())
      .map(|e| json!({"id": e.id, "dll": e.dll, "veri": e.veri.clone().unwrap_or_default()}))
      .collect()
  };
  let kimlikler: Vec<String> = eklentiler.iter().filter_map(|e| e["id"].as_str().map(String::from)).collect();
  ekl::kayit::oturum_baslat(&dizin, &kimlikler);
  let mut istek = json!({"eklentiler": eklentiler, "isaret": ekl::kayit::isaret_dosyasi(&dizin)});
  if let Some(m) = istek.as_object_mut() {
    m.extend(profil.motor_video_ses());
  }
  let bilgi = match m.baslat(istek, &dizin).await {
    Ok(b) => b,
    Err(e) => {
      // Motor kendisi düştüyse (ör. eklentinin obs_module_load'unda) çökme olarak işlenir ve karar istenir
      if m.ozet().lock().beklenmedik_cikis.is_some() {
        if let Some(c) = cokme_denetle(state).await {
          let ne = c.supheli.as_ref().map(|s| format!("«{s}» eklentisini yüklerken")).unwrap_or_else(|| "açılırken".into());
          return Err(catisma(format!("Motor {ne} kapandı{}; nasıl başlatılacağını seçin", kod_metni(c.cikis_kodu))));
        }
      }
      ekl::kayit::oturum_bitti(&dizin);
      return Err(catisma(e));
    }
  };
  let sonuclar: Vec<Value> = bilgi["eklentiler"].as_array().cloned().unwrap_or_default();
  {
    let o = m.ozet();
    let mut o = o.lock();
    o.dikey = k.dikey;
    o.giris_turleri = bilgi["giris_turleri"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
    o.eklenti_sonuclari = sonuclar.clone();
    o.guvenli_kip = guvenli;
    o.profil = profil.clone();
  }
  eklenti_sonuclarini_isle(state, &sonuclar).await;
  // Profilin izleme aygıtı (seçilmişse)
  if let Some(a) = &profil.izleme_aygiti {
    let _ = komut(state, json!({"komut": "izleme.aygit", "id": a.id, "ad": a.ad})).await;
  }
  let kur = async {
    if m.ozet().lock().giris_turleri.is_empty() {
      let b = komut(state, json!({"komut": "bilgi"})).await?;
      m.ozet().lock().giris_turleri = b["giris_turleri"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
    }
    ses_hazirla(state, 0).await?;
    // Dikey tuval açıldıysa sahnesi yoksa oluşturulur (duzelt), sonra kaynaklar (eklenti türü yoksa eksik olarak
    // korunur) ve sahne grafiği
    k.duzelt();
    let kurulan = koleksiyonu_kur(state, k.clone()).await?;
    k = kurulan;
    m.ozet().lock().koleksiyon = k.clone();
    kaydet(state).await
  };
  if let Err(e) = kur.await {
    let _ = m.durdur().await;
    ekl::kayit::oturum_bitti(&dizin);
    return Err((StatusCode::BAD_GATEWAY, e.1));
  }
  let eksik: Vec<String> = m.ozet().lock().koleksiyon.kaynaklar.iter().filter(|r| r.eksik).map(|r| r.ad.clone()).collect();
  let yuklenen = sonuclar.iter().filter(|s| s["sonuc"] == "yuklendi").count();
  audit(
    state,
    actor,
    "MOTOR_START",
    json!({"dikey": k.dikey, "fps": profil.fps, "libobs": bilgi.get("libobs"), "eksikKaynak": eksik.len(), "not": not,
      "eklenti": sonuclar.len(), "eklentiYuklenen": yuklenen, "guvenliKip": guvenli}),
  )
  .await;
  Ok(json!({"ok": true, "bilgi": bilgi, "eksikKaynaklar": eksik, "not": not, "eklentiler": sonuclar, "guvenliKip": guvenli}))
}

/// Motorun gerçek yükleme sonuçları eklenti defterine yoklama gibi işlenir: ilk başarılı yükleme "muhtemelen uyumlu"yu
/// "uyumlu"ya taşır; açılamayan/sürümü tutmayan eklentinin durumu güncellenir.
async fn eklenti_sonuclarini_isle(state: &AppState, sonuclar: &[Value]) {
  if sonuclar.is_empty() {
    return;
  }
  let libobs = state.motor.ozet().lock().bilgi["libobs"].as_str().unwrap_or("").to_string();
  let api = ekl::hizmet::libobs_api(&libobs);
  let baglam = ekl::cozumleme::Baglam::bu_makine();
  let _k = state.eklenti_kilidi.lock().await;
  let (mut d, _) = ekl::kayit::oku(&state.data_dir);
  for s in sonuclar {
    let Some(id) = s["id"].as_str() else { continue };
    let Some(e) = d.eklentiler.iter_mut().find(|e| e.id == id) else { continue };
    let Some(c) = ekl::hizmet::yeniden_cozumle(e, &baglam) else { continue };
    let satir = json!({"libobs": libobs, "yoklama": s}).to_string();
    if let Some(y) = ekl::yoklama::sonucu_oku(&satir) {
      ekl::hizmet::yoklama_isle(e, &c, y, api, "yukleme");
    }
  }
  let _ = ekl::kayit::yaz(&state.data_dir, &d);
}

#[derive(Deserialize)]
struct OnayGovdesi {
  #[serde(default)]
  confirm: bool,
}

async fn api_durdur(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<OnayGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.stream").await?;
  if !g.confirm {
    return Err((StatusCode::PRECONDITION_REQUIRED, "Onay gerekli: motor durdurulunca tüm motor yayınları ve kayıt biter".into()));
  }
  if state.motor.calisiyor().await {
    let _ = kaydet(&state).await;
  }
  state.motor.durdur().await.map_err(catisma)?;
  ekl::kayit::oturum_bitti(&klasor(&state));
  audit(&state, &actor, "MOTOR_STOP", json!({})).await;
  Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
struct KaynakGovdesi {
  tur: String,
  #[serde(default)]
  deger: String,
  #[serde(default)]
  ad: String,
  /// Eski biçim: bu tuvallerin program sahnelerine eklenir
  #[serde(default)]
  tuvaller: Vec<String>,
  /// Eklenecek sahne (verilirse `tuvaller` yok sayılır)
  #[serde(default)]
  sahne: Option<String>,
}

/// Motor kapalıyken önceki oturumun temiz bitip bitmediğine bakar; çökmeyi eklenti defterine işler.
/// Dönüş: kullanıcıya sorulması gereken (çözülmemiş) çökme.
pub(crate) async fn cokme_denetle(state: &AppState) -> Option<Cokme> {
  if state.motor.calisiyor().await {
    return None;
  }
  let kod = state.motor.ozet().lock().beklenmedik_cikis.take();
  let dizin = klasor(state);
  let _k = state.eklenti_kilidi.lock().await;
  let (mut d, _) = ekl::kayit::oku(&state.data_dir);
  if let Some(c) = ekl::kayit::cokme_bul(&dizin, kod, kod.is_some()) {
    ekl::kayit::cokme_isle(&mut d, c);
    let _ = ekl::kayit::yaz(&state.data_dir, &d);
  }
  d.son_cokme.filter(|c| !c.cozuldu)
}

/// Kodlanmış çıkış kodu metni (NTSTATUS onaltılık)
fn kod_metni(k: Option<i64>) -> String {
  k.map(|k| format!(" (0x{:08X})", k as u32)).unwrap_or_default()
}

pub(crate) async fn motor_calisiyor(state: &AppState) -> Result<(), Hata> {
  if state.motor.calisiyor().await {
    Ok(())
  } else {
    Err(catisma("motor çalışmıyor".into()))
  }
}

async fn api_kaynak_ekle(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KaynakGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  // Eklenti türü: yalnız bu oturumda yüklenmiş ÜÇÜNCÜ TARAF eklentinin kaydettiği giriş türleri (birinci taraf
  // türler kendi doğrulamalı yolundan geçer: dosya yolu, aygıt seçimi…)
  let t = if g.tur == "eklenti" {
    let tur = g.deger.trim().to_string();
    let izinli = state.motor.ozet().lock().eklenti_sonuclari.iter().any(|s| {
      s["turler"].as_array().is_some_and(|a| a.iter().any(|x| x["tur"] == "kaynak" && x["id"] == tur.as_str()))
    });
    if !izinli {
      return Err(gecersiz(format!("bu oturumda yüklenmiş bir eklenti kaynak türü değil: {tur}")));
    }
    motor_kopru::KaynakTanimi { obs_turu: tur, ayarlar: json!({}), yakalama: false, ses: false, sigdir: false }
  } else {
    // Renk iki tuvali de kaplasın diye kare (tuvallerin en büyük kenarı)
    let kenar = {
      let o = state.motor.ozet();
      let p = &o.lock().profil;
      let ((a, b), (c, d)) = (p.tuval_boyutu("ana"), p.tuval_boyutu("dikey"));
      a.max(b).max(c).max(d)
    };
    kaynak_tanimi(&g.tur, &g.deger, kenar, kenar).map_err(gecersiz)?
  };
  // Hedef sahneler: verilen sahne ya da verilen tuvallerin program sahneleri
  let (dikey, id, sahneler) = {
    let o = state.motor.ozet();
    let mut o = o.lock();
    let dikey = o.dikey;
    let sahneler: Vec<(String, String)> = match &g.sahne {
      Some(s) => {
        let sk = o.koleksiyon.sahne_ref(s).ok_or_else(|| (StatusCode::NOT_FOUND, format!("sahne yok: {s}")))?;
        vec![(sk.id.clone(), sk.tuval.clone())]
      }
      None => {
        let mut tuvaller: Vec<String> = if g.tuvaller.is_empty() { vec!["ana".into()] } else { g.tuvaller.clone() };
        tuvaller.dedup();
        if t.ses {
          tuvaller = vec!["ana".into()]; // ses bir kez karışır; dikey tuval sesi ana karışımdan alır
        }
        let mut v = Vec::new();
        for tv in &tuvaller {
          if tuval_boyutu(tv).is_none() || (tv == "dikey" && !dikey) {
            return Err(gecersiz(format!("tuval yok: {tv}")));
          }
          let p = o.koleksiyon.program.get(tv).cloned().ok_or_else(|| gecersiz(format!("tuvalin sahnesi yok: {tv}")))?;
          v.push((p, tv.clone()));
        }
        v
      }
    };
    (dikey, o.koleksiyon.yeni_kimlik("k"), sahneler)
  };
  let _ = dikey;
  let ad: String = if g.ad.trim().is_empty() { g.tur.clone() } else { g.ad.chars().take(60).collect() };
  // OBS gibi türün en yeni sürümü (color_source → color_source_v3); eski kayıtlar kendi sürümünde kalır
  let obs_turu = {
    if let Some(grup) = modul_grubu(&t.obs_turu) {
      modul_grubu_yukle(&state, grup).await?;
    }
    let kayitli = state.motor.ozet().lock().giris_turleri.clone();
    crate::motor_obs_ice::en_yeni_surum(&t.obs_turu, &kayitli)
  };
  let rec = KaynakKaydi::yeni(&id, &g.tur, &obs_turu, &ad, t.ayarlar.clone());
  if !kaynak_kur(&state, &rec).await? {
    return Err(catisma(format!("kaynak türü bu motorda yok: {}", rec.obs_turu)));
  }
  state.motor.ozet().lock().koleksiyon.kaynaklar.push(rec.clone());
  for (sahne, tuval) in &sahneler {
    let (gw, gy) = state.motor.ozet().lock().profil.tuval_boyutu(tuval);
    let mut d = Donusum::default();
    if g.tur == "renk" {
      // renk kaynağı tuvali kaplar (boyutu kaynak ayarında)
    } else if t.sigdir {
      d.sinir = Some([gw as f32, gy as f32]);
      d.sinir_turu = 2;
    } else {
      d.konum = [40.0, 40.0];
    }
    komut(&state, json!({"komut": "sahne.ekle", "sahne": sahne, "kaynak": id, "donusum": d.motor_json()})).await?;
  }
  let hedef: Vec<String> = sahneler.iter().map(|(s, _)| s.clone()).collect();
  kaydet_sahneler(&state, &hedef).await?;
  let tuvaller: Vec<&String> = sahneler.iter().map(|(_, t)| t).collect();
  audit(&state, &actor, "MOTOR_SOURCE_ADD", json!({"id": id, "tur": g.tur, "tuvaller": tuvaller, "sahneler": hedef})).await;
  Ok(Json(json!(rec)))
}

#[derive(Deserialize)]
struct IdGovdesi {
  id: String,
}

async fn api_kaynak_sil(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<IdGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  let eksik = state.motor.ozet().lock().koleksiyon.kaynaklar.iter().find(|k| k.id == g.id).map(|k| k.eksik);
  match eksik {
    None => return Err((StatusCode::NOT_FOUND, "kaynak yok".into())),
    Some(false) => {
      komut(&state, json!({"komut": "kaynak.sil", "id": g.id})).await?;
    }
    Some(true) => {} // motorda hiç oluşturulmadı
  }
  let gizliler = {
    let o = state.motor.ozet();
    let mut o = o.lock();
    let gizliler = o.koleksiyon.kaynaklar.iter().find(|k| k.id == g.id).map(|k| k.gizli_alanlar.clone()).unwrap_or_default();
    o.koleksiyon.kaynaklar.retain(|k| k.id != g.id);
    fn cikar(ogeler: &mut Vec<SahneOgesi>, id: &str) {
      ogeler.retain(|x| !(x.tur != OgeTuru::Grup && x.kaynak == id));
      for x in ogeler.iter_mut() {
        cikar(&mut x.cocuklar, id);
      }
    }
    for s in o.koleksiyon.sahneler.iter_mut() {
      cikar(&mut s.ogeler, &g.id);
    }
    gizliler
  };
  for alan in gizliler {
    crate::secret_store::delete_secret(&gizli_anahtar(&g.id, &alan));
  }
  kaydet(&state).await?;
  audit(&state, &actor, "MOTOR_SOURCE_REMOVE", json!({"id": g.id})).await;
  Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
struct IzGovdesi {
  id: String,
  maske: u32,
}

async fn api_kaynak_izler(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<IzGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "audio.control").await?;
  motor_calisiyor(&state).await?;
  if g.maske > 0x3F {
    return Err(gecersiz("iz maskesi 0–63 olmalı".into()));
  }
  komut(&state, json!({"komut": "kaynak.izler", "id": g.id, "maske": g.maske})).await?;
  if let Some(k) = state.motor.ozet().lock().koleksiyon.kaynak(&g.id) {
    k.izler = g.maske;
  }
  kaydet(&state).await?;
  audit(&state, &actor, "MOTOR_SOURCE_TRACKS", json!({"id": g.id, "maske": g.maske})).await;
  Ok(Json(json!({"ok": true})))
}

fn gizli_anahtar(kaynak: &str, alan: &str) -> String {
  format!("motor.kaynak.{kaynak}.{alan}")
}

/// Özellik tanımlarındaki (gruplar dahil) parola türündeki alan adları
fn parola_alanlari(ozellikler: &Value, out: &mut Vec<String>) {
  for o in ozellikler.as_array().into_iter().flatten() {
    if o["tur"] == "text" && o["metinTuru"] == "parola" {
      if let Some(ad) = o["ad"].as_str() {
        out.push(ad.to_string());
      }
    }
    if let Some(g) = o.get("grup") {
      parola_alanlari(g, out);
    }
  }
}

#[derive(Deserialize)]
struct OzellikSorgusu {
  id: String,
}

/// Kaynağın özellik formu tanımı ve güncel ayarları (parola değerleri dönmez; yalnız dolu mu).
async fn api_kaynak_ozellikler(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<OzellikSorgusu>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  let v = komut(&state, json!({"komut": "kaynak.ozellikler", "id": q.id})).await?;
  Ok(Json(v))
}

#[derive(Deserialize)]
struct GuncelleGovdesi {
  id: String,
  ayarlar: serde_json::Map<String, Value>,
}

async fn api_kaynak_guncelle(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<GuncelleGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  if Value::Object(g.ayarlar.clone()).to_string().len() > 64 * 1024 {
    return Err(gecersiz("ayarlar çok büyük".into()));
  }
  // Hangi alanların parola olduğunu motorun kendi tanımından öğren (panel tahmin etmez)
  let tanim = komut(&state, json!({"komut": "kaynak.ozellikler", "id": g.id})).await?;
  let mut parolalar = Vec::new();
  parola_alanlari(&tanim["ozellikler"], &mut parolalar);
  komut(&state, json!({"komut": "kaynak.guncelle", "id": g.id, "ayarlar": g.ayarlar})).await?;
  let mut kalici = g.ayarlar.clone();
  for alan in &parolalar {
    if let Some(v) = kalici.remove(alan) {
      let deger = v.as_str().unwrap_or("").to_string();
      let anahtar = gizli_anahtar(&g.id, alan);
      if deger.is_empty() {
        crate::secret_store::delete_secret(&anahtar);
      } else if !crate::secret_store::set_secret(&anahtar, &deger) {
        return Err(catisma("parola Kimlik Yöneticisine yazılamadı; düz metne yazılmadı".into()));
      }
    }
  }
  {
    let o = state.motor.ozet();
    let mut o = o.lock();
    if let Some(k) = o.koleksiyon.kaynak(&g.id) {
      if !k.ayarlar.is_object() {
        k.ayarlar = json!({});
      }
      if let Some(m) = k.ayarlar.as_object_mut() {
        for (a, v) in kalici {
          m.insert(a, v);
        }
        for alan in &parolalar {
          m.remove(alan);
        }
      }
      for alan in parolalar {
        if !k.gizli_alanlar.contains(&alan) {
          k.gizli_alanlar.push(alan);
        }
      }
    }
  }
  kaydet(&state).await?;
  // Denetime yalnız alan adları (değer yok)
  audit(&state, &actor, "MOTOR_SOURCE_SETTINGS", json!({"id": g.id, "alanlar": g.ayarlar.keys().collect::<Vec<_>>()})).await;
  Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
struct SecenekSorgusu {
  tur: String,
}

async fn api_secenekler(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<SecenekSorgusu>,
) -> ApiResult {
  // Pencere başlıkları ve aygıt adları listelenir → düzenleme yetkisi ister
  authorize(&state, &addr, &headers, "scene.edit").await?;
  motor_calisiyor(&state).await?;
  let (obs_turu, ozellik) = secenek_ozelligi(&q.tur).ok_or_else(|| gecersiz(format!("seçeneği olmayan tür: {}", q.tur)))?;
  yakalama_modulleri(&state).await?;
  let v = komut(&state, json!({"komut": "kaynak.secenekler", "tur": obs_turu, "ozellik": ozellik})).await?;
  Ok(Json(json!({"secenekler": v})))
}

#[derive(Deserialize)]
struct SahneSorgusu {
  #[serde(default)]
  tuval: Option<String>,
  /// Verilirse bu sahne; yoksa tuvalin program sahnesi
  #[serde(default)]
  sahne: Option<String>,
}

async fn api_sahne(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<SahneSorgusu>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  motor_calisiyor(&state).await?;
  let (sahne, tuval) = {
    let o = state.motor.ozet();
    let o = o.lock();
    match &q.sahne {
      Some(s) => {
        let sk = o.koleksiyon.sahne_ref(s).ok_or_else(|| (StatusCode::NOT_FOUND, format!("sahne yok: {s}")))?;
        (sk.id.clone(), sk.tuval.clone())
      }
      None => {
        let tv = q.tuval.clone().unwrap_or_else(|| "ana".into());
        tuval_boyutu(&tv).ok_or_else(|| gecersiz("tuval yok".into()))?;
        (o.koleksiyon.program.get(&tv).cloned().ok_or_else(|| gecersiz("tuvalin sahnesi yok".into()))?, tv)
      }
    }
  };
  let (g_, y_) = state.motor.ozet().lock().profil.tuval_boyutu(&tuval);
  let ogeler = komut(&state, json!({"komut": "sahne.ogeler", "sahne": sahne})).await?;
  let durumlar = komut(&state, json!({"komut": "kaynak.durumlari"})).await.unwrap_or(Value::Null);
  let durum = |id: &str| -> Value {
    durumlar["kaynaklar"].as_array().and_then(|a| a.iter().find(|x| x["id"] == id)).cloned().unwrap_or(Value::Null)
  };
  let o = state.motor.ozet();
  let o = o.lock();
  let mut goruldu: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
  let zengin: Vec<Value> = ogeler
    .as_array()
    .cloned()
    .unwrap_or_default()
    .into_iter()
    .map(|mut x| {
      let id = x.get("kaynak").and_then(Value::as_str).unwrap_or("").to_string();
      let n = goruldu.entry(id.clone()).or_insert(0);
      if let Some(kayit) = o.koleksiyon.oge_bul(&sahne, &id, *n) {
        x["gosterGecisi"] = json!(kayit.goster_gecisi);
        x["gizleGecisi"] = json!(kayit.gizle_gecisi);
        if kayit.tur == OgeTuru::Grup {
          x["filtre"] = json!(kayit.filtreler.len());
        }
      }
      *n += 1;
      if let Some(k) = o.koleksiyon.kaynaklar.iter().find(|r| r.id == id) {
        x["ad"] = json!(k.ad);
        x["tur"] = json!(k.tur);
        x["obsTuru"] = json!(k.obs_turu);
        let d = durum(&id);
        x["durum"] = d["durum"].clone();
        x["ses"] = d["ses"].clone();
        x["etkilesim"] = d["etkilesim"].clone();
        x["filtre"] = json!(k.filtreler.len());
        x["deinterlace"] = json!(k.deinterlace);
      } else if let Some(s) = o.koleksiyon.sahne_ref(&id) {
        x["ad"] = json!(s.ad);
        x["tur"] = json!("sahne");
      } else if x["grup"] == true {
        let ad = o
          .koleksiyon
          .sahne_ref(&sahne)
          .and_then(|s| s.ogeler.iter().find(|g| g.tur == OgeTuru::Grup && g.kaynak == id))
          .map(|g| g.ad.clone())
          .unwrap_or_else(|| id.clone());
        x["ad"] = json!(ad);
        x["tur"] = json!("grup");
      }
      x
    })
    .collect();
  // Motorda kurulamayan (eksik eklenti) öğeler de listelenir ki kullanıcı görsün
  let eksikler: Vec<Value> = o
    .koleksiyon
    .sahne_ref(&sahne)
    .map(|s| {
      s.ogeler
        .iter()
        .filter_map(|x| o.koleksiyon.kaynaklar.iter().find(|k| k.eksik && k.id == x.kaynak))
        .map(|k| json!({"kaynak": k.id, "ad": k.ad, "tur": k.tur, "obsTuru": k.obs_turu, "eksik": true}))
        .collect()
    })
    .unwrap_or_default();
  Ok(Json(json!({"tuval": tuval, "sahne": sahne, "genislik": g_, "yukseklik": y_, "ogeler": zengin, "eksikler": eksikler})))
}

/// Tek hedefi (`h-<id>`) profildeki atamasıyla (ya da verilen tuval/iz ile) başlatır; gerekirse kodlayıcı ve çıktıyı
/// oluşturur. Kodlama paylaşımı: aynı tuval + aynı bit hızı → aynı kodlayıcı.
async fn hedef_baslat(state: &AppState, id: &str, tuval: Option<String>, iz: Option<u8>) -> Result<(String, u8), Hata> {
  let cfg = state
    .multistream
    .configs()
    .into_iter()
    .find(|c| c.id == id)
    .ok_or_else(|| (StatusCode::NOT_FOUND, "hedef yok".to_string()))?;
  if state.multistream.snapshot().destinations.iter().any(|d| d.id == id && d.state.is_active()) {
    return Err(catisma("Bu hedef çoklu yayın yönlendiricisinde canlı; önce orada durdurun".into()));
  }
  let cikis = format!("h-{id}");
  if cikis_etkin(state, &cikis) {
    return Err(catisma("Bu hedef zaten yayında".into()));
  }
  let (dikey, kayitli, eski_kayit, mevcut) = {
    let o = state.motor.ozet();
    let o = o.lock();
    (o.dikey, o.profil.hedefler.get(id).cloned(), o.koleksiyon.hedefler.get(id).cloned(), o.hedef_tuval.get(id).cloned())
  };
  let tuval = tuval.or(kayitli.as_ref().map(|k| k.tuval.clone())).or(eski_kayit.as_ref().map(|k| k.tuval.clone())).unwrap_or_else(|| "ana".into());
  let iz = iz.or(kayitli.as_ref().map(|k| k.iz)).or(eski_kayit.as_ref().map(|k| k.iz)).unwrap_or(0);
  let bit_hizi = kayitli.as_ref().and_then(|k| k.bit_hizi);
  if tuval_boyutu(&tuval).is_none() || (tuval == "dikey" && !dikey) {
    return Err(gecersiz(format!("tuval yok: {tuval}")));
  }
  let video = video_kodlayici_hazirla(state, &tuval, bit_hizi).await?;
  ses_hazirla(state, iz).await?;
  // Tuval, iz ya da kodlayıcı değiştiyse eski çıktı silinip yeniden kurulur (çıktı durmuşken)
  let yeniden = mevcut.as_ref().is_some_and(|(t, i, v)| t != &tuval || *i != iz || v != &video);
  if yeniden {
    komut(state, json!({"komut": "cikis.sil", "id": cikis})).await?;
  }
  if mevcut.is_none() || yeniden {
    let anahtar = state.multistream.key_for(id).ok_or_else(|| catisma("Bu hedefin yayın anahtarı yok".into()))?;
    let ag = serde_json::to_value(&state.motor.ozet().lock().profil.ag).unwrap_or(Value::Null);
    komut(state, json!({"komut": "cikis.rtmp", "id": cikis, "sunucu": cfg.server, "anahtar": anahtar, "video": video, "ses": format!("ses-{iz}"), "ag": ag})).await?;
    state.motor.ozet().lock().hedef_tuval.insert(id.to_string(), (tuval.clone(), iz, video.clone()));
  }
  komut(state, json!({"komut": "cikis.baslat", "id": cikis})).await?;
  // Atama profile yazılır (bit hızı korunur)
  let mut p = state.motor.ozet().lock().profil.clone();
  let onceki = p.hedefler.get(id).cloned();
  let atama = crate::motor_profil::HedefAtamasi { tuval: tuval.clone(), iz, bit_hizi: onceki.and_then(|a| a.bit_hizi) };
  if p.hedefler.get(id) != Some(&atama) {
    p.hedefler.insert(id.to_string(), atama);
    profil_yaz(state, &p)?;
  }
  Ok((tuval, iz))
}

#[derive(Deserialize)]
struct HedefGovdesi {
  id: String,
  eylem: String,
  #[serde(default)]
  tuval: Option<String>,
  /// Ses izi 1–6 (arayüz); motorda 0–5
  #[serde(default)]
  iz: Option<u8>,
}

async fn api_hedef(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<HedefGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.outputs").await?;
  motor_calisiyor(&state).await?;
  match g.eylem.as_str() {
    "durdur" => {
      komut(&state, json!({"komut": "cikis.durdur", "id": format!("h-{}", g.id)})).await?;
      audit(&state, &actor, "MOTOR_DEST_STOP", json!({"id": g.id})).await;
    }
    "baslat" => {
      let iz = match g.iz {
        Some(i @ 1..=6) => Some(i - 1),
        Some(_) => return Err(gecersiz("ses izi 1–6 olmalı".into())),
        None => None,
      };
      let (tuval, iz) = hedef_baslat(&state, &g.id, g.tuval.clone(), iz).await?;
      audit(&state, &actor, "MOTOR_DEST_START", json!({"id": g.id, "tuval": tuval, "iz": iz + 1})).await;
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  }
  Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
struct GoLiveGovdesi {
  eylem: String,
  #[serde(default)]
  confirm: bool,
}

/// Motor GO LIVE: etkin ve anahtarlı her hedefi kayıtlı tuval/iz atamasıyla başlatır; kısmi başarıya izin verir.
/// "durdur" onay ister ve yalnız motor hedeflerini durdurur (kayıt sürer).
async fn api_golive(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<GoLiveGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.stream").await?;
  let sonuc = match g.eylem.as_str() {
    "baslat" => {
      let sonuc = golive_baslat(&state).await?;
      audit(&state, &actor, "MOTOR_GO_LIVE", json!({"hedefler": sonuc.len(), "basarili": basarili(&sonuc)})).await;
      sonuc
    }
    "durdur" => {
      if !g.confirm {
        return Err((StatusCode::PRECONDITION_REQUIRED, "Onay gerekli: tüm motor yayınları durdurulacak".into()));
      }
      let sonuc = golive_durdur(&state).await?;
      audit(&state, &actor, "MOTOR_STOP_ALL", json!({"hedefler": sonuc.len()})).await;
      sonuc
    }
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  };
  Ok(Json(json!({"sonuc": sonuc})))
}

pub(crate) fn basarili(sonuc: &serde_json::Map<String, Value>) -> usize {
  sonuc.values().filter(|v| v["ok"] == true).count()
}

/// GO LIVE'a girecek hedefler: etkin ve yayın anahtarı kayıtlı olanlar.
pub(crate) fn golive_hedefleri(state: &AppState) -> Vec<String> {
  state
    .multistream
    .configs()
    .into_iter()
    .filter(|c| c.enabled && state.multistream.key_for(&c.id).is_some())
    .map(|c| c.id)
    .collect()
}

/// Etkin ve anahtarlı her hedefi kayıtlı tuval/iz atamasıyla başlatır; kısmi başarıya izin verir (hedef → sonuç).
/// HTTP ucu ve eylem kayıt defteri (`engine.goLive`) bunu çağırır; denetim kaydını çağıran yazar.
pub(crate) async fn golive_baslat(state: &AppState) -> Result<serde_json::Map<String, Value>, Hata> {
  motor_calisiyor(state).await?;
  let mut sonuc = serde_json::Map::new();
  for id in golive_hedefleri(state) {
    if motor_hedefi_etkin(state, &id) {
      sonuc.insert(id, json!({"ok": true, "not": "zaten yayında"}));
      continue;
    }
    let r = hedef_baslat(state, &id, None, None).await;
    sonuc.insert(id, match r {
      Ok((t, i)) => json!({"ok": true, "tuval": t, "iz": i + 1}),
      Err((_, e)) => json!({"ok": false, "hata": e}),
    });
  }
  Ok(sonuc)
}

/// Motorun yayındaki hedeflerini durdurur (kayıt ve tekrar arabelleği sürer). Onayı çağıran ister.
pub(crate) async fn golive_durdur(state: &AppState) -> Result<serde_json::Map<String, Value>, Hata> {
  motor_calisiyor(state).await?;
  let mut sonuc = serde_json::Map::new();
  for id in golive_hedefleri(state).into_iter().filter(|id| motor_hedefi_etkin(state, id)) {
    let r = komut(state, json!({"komut": "cikis.durdur", "id": format!("h-{id}")})).await;
    sonuc.insert(id, json!({"ok": r.is_ok()}));
  }
  Ok(sonuc)
}

/// Kaydı başlatır (ana tuval, ana karışım); dosya yolunu döner.
pub(crate) async fn kayit_baslat(state: &AppState) -> Result<PathBuf, Hata> {
  motor_calisiyor(state).await?;
  if cikis_etkin(state, "kayit") {
    return Err(catisma("kayıt zaten sürüyor".into()));
  }
  let ayar = state.motor.ozet().lock().profil.kayit.clone();
  let dizin = ayar.klasor.as_ref().map(PathBuf::from).unwrap_or_else(kayit_klasoru);
  std::fs::create_dir_all(&dizin).map_err(|e| catisma(format!("kayıt klasörü: {e}")))?;
  let uzanti = match ayar.bicim.as_str() {
    "mp4" | "parcali_mp4" | "hibrit_mp4" => "mp4",
    "mov" | "parcali_mov" => "mov",
    _ => "mkv",
  };
  let yol = dizin.join(format!("Kayit {}.{uzanti}", zaman_damgasi()));
  let (video, sesler) = if ayar.ayri_kodlayici {
    kayit_kodlayicilari(state, &ayar.izler).await?
  } else {
    kodlayici_hazirla(state, "ana").await?;
    let mut sesler = Vec::new();
    for iz in &ayar.izler {
      ses_hazirla(state, *iz).await?;
      sesler.push(format!("ses-{iz}"));
    }
    ("v-ana".to_string(), sesler)
  };
  if state.motor.ozet().lock().kayit_cikisi_var {
    komut(state, json!({"komut": "cikis.sil", "id": "kayit"})).await?;
  }
  let bolme = json!({"sure_sn": ayar.bolme_dk * 60, "boyut_mb": ayar.bolme_mb});
  komut(state, json!({"komut": "cikis.kayit", "id": "kayit", "yol": yol, "bicim": ayar.bicim, "video": video, "sesler": sesler, "bolme": bolme})).await?;
  state.motor.ozet().lock().kayit_cikisi_var = true;
  komut(state, json!({"komut": "cikis.baslat", "id": "kayit"})).await?;
  state.motor.ozet().lock().son_kayit = Some(yol.to_string_lossy().into_owned());
  Ok(yol)
}

/// Kayda özel kodlayıcılar (`v-kayit`, `sk-<iz>`): profilin ana tuval ayarlarıyla; yayınla paylaşılmaz
async fn kayit_kodlayicilari(state: &AppState, izler: &[u8]) -> Result<(String, Vec<String>), Hata> {
  let (var, tur, kbps, anahtar_kare, uzman, ses_bh) = {
    let o = state.motor.ozet();
    let o = o.lock();
    let p = &o.profil;
    (o.kodlayicilar.clone(), p.cikis.kodlayici.clone(), p.cikis.bit_hizi_ana, p.cikis.anahtar_kare_sn, p.uzman_ayarlari(&p.cikis.kodlayici), p.cikis.ses_bit_hizi)
  };
  if !var.contains("v-kayit") {
    komut(state, json!({"komut": "kodlayici.video", "id": "v-kayit", "tur": tur, "tuval": "ana", "bit_hizi": kbps, "anahtar_kare_sn": anahtar_kare, "ayarlar": uzman})).await?;
    state.motor.ozet().lock().kodlayicilar.insert("v-kayit".into());
  }
  let mut sesler = Vec::new();
  for iz in izler {
    let id = format!("sk-{iz}");
    if !var.contains(&id) {
      komut(state, json!({"komut": "kodlayici.ses", "id": id, "bit_hizi": ses_bh, "iz": iz})).await?;
      state.motor.ozet().lock().kodlayicilar.insert(id.clone());
    }
    sesler.push(id);
  }
  Ok(("v-kayit".into(), sesler))
}

/// Kaydı duraklatır/sürdürür; `None` = değiştir. Dönüş: yeni durum (duraklatıldı mı)
pub(crate) async fn kayit_duraklat(state: &AppState, duraklat: Option<bool>) -> Result<bool, Hata> {
  motor_calisiyor(state).await?;
  if !cikis_etkin(state, "kayit") {
    return Err(catisma("kayıt sürmüyor".into()));
  }
  let d = match duraklat {
    Some(d) => d,
    None => !kayit_duraklatildi(state).await,
  };
  let v = komut(state, json!({"komut": "kayit.duraklat", "id": "kayit", "duraklat": d})).await?;
  Ok(v["duraklatildi"].as_bool().unwrap_or(d))
}

pub(crate) async fn kayit_duraklatildi(state: &AppState) -> bool {
  let ist = komut(state, json!({"komut": "istatistik"})).await.unwrap_or(Value::Null);
  ist["cikislar"].as_array().and_then(|a| a.iter().find(|c| c["id"] == "kayit")).and_then(|c| c["duraklatildi"].as_bool()).unwrap_or(false)
}

pub(crate) async fn kayit_bol(state: &AppState) -> Result<(), Hata> {
  motor_calisiyor(state).await?;
  if !cikis_etkin(state, "kayit") {
    return Err(catisma("kayıt sürmüyor".into()));
  }
  komut(state, json!({"komut": "kayit.bol", "id": "kayit"})).await?;
  Ok(())
}

/// Sanal kamera: `baslat` | `durdur` | `degistir`. Dönüş: açık mı
pub(crate) async fn sanal_kamera(state: &AppState, eylem: &str, tuval: &str) -> Result<bool, Hata> {
  motor_calisiyor(state).await?;
  let acik = cikis_etkin(state, "sanal-kamera");
  let ac = match eylem {
    "baslat" => true,
    "durdur" => false,
    "degistir" => !acik,
    e => return Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  };
  if ac == acik {
    return Ok(acik);
  }
  if ac {
    if tuval_boyutu(tuval).is_none() || (tuval == "dikey" && !state.motor.ozet().lock().dikey_tuval) {
      return Err(gecersiz(format!("tuval yok: {tuval}")));
    }
    komut(state, json!({"komut": "sanal_kamera.baslat", "tuval": tuval})).await?;
  } else {
    komut(state, json!({"komut": "sanal_kamera.durdur"})).await?;
  }
  Ok(ac)
}

pub(crate) async fn kayit_durdur(state: &AppState) -> Result<Option<String>, Hata> {
  motor_calisiyor(state).await?;
  komut(state, json!({"komut": "cikis.durdur", "id": "kayit"})).await?;
  Ok(state.motor.ozet().lock().son_kayit.clone())
}

/// Tekrar arabelleğini diske yazar; yazılan dosyanın yolunu döner.
pub(crate) async fn tekrar_kaydet(state: &AppState) -> Result<Value, Hata> {
  motor_calisiyor(state).await?;
  if !cikis_etkin(state, "tekrar") {
    return Err(catisma("tekrar arabelleği kapalı".into()));
  }
  let v = komut(state, json!({"komut": "tekrar.kaydet", "id": "tekrar"})).await?;
  let yol = v.get("yol").cloned().unwrap_or(Value::Null);
  state.motor.ozet().lock().son_tekrar = yol.as_str().map(String::from);
  // Dikey tuvalin arabelleği de açıksa o da yazılır (tuval başına tekrar)
  if cikis_etkin(state, "tekrar-dikey") {
    if let Ok(d) = komut(state, json!({"komut": "tekrar.kaydet", "id": "tekrar-dikey"})).await {
      return Ok(json!({"ana": yol, "dikey": d.get("yol").cloned().unwrap_or(Value::Null)}));
    }
  }
  Ok(yol)
}

/// Bir kaynağın bulunduğu tüm tuvallerde görünürlüğünü değiştirir. `kaynak`: kimlik ya da ad (büyük/küçük harf
/// duyarsız, tek eşleşme olmalı). `kip`: show | hide | toggle — toggle ilk öğenin durumunu tersler ve tüm tuvallere
/// aynısını uygular (tuvaller arası tutarsızlık birikmesin). Dönüş: (kaynak adı, yeni görünürlük, öğe sayısı).
pub(crate) async fn kaynak_gorunurlugu(state: &AppState, kaynak: &str, kip: &str) -> Result<(String, bool, usize), Hata> {
  motor_calisiyor(state).await?;
  let (id, ad, dikey) = {
    let o = state.motor.ozet();
    let o = o.lock();
    let k = &o.koleksiyon.kaynaklar;
    let bulunan = match k.iter().find(|r| r.id == kaynak) {
      Some(r) => r,
      None => {
        let adlar: Vec<_> = k.iter().filter(|r| crate::motor_koleksiyon::ad_esit(&r.ad, kaynak)).collect();
        match adlar.as_slice() {
          [r] => *r,
          [] => return Err((StatusCode::NOT_FOUND, format!("«{kaynak}» adlı motor kaynağı yok"))),
          _ => return Err(catisma(format!("«{kaynak}» adını birden çok kaynak taşıyor; kimlikle belirtin"))),
        }
      }
    };
    (bulunan.id.clone(), bulunan.ad.clone(), o.dikey)
  };
  // Programdaki (izleyicinin gördüğü) sahneler
  let sahneler: Vec<String> = {
    let o = state.motor.ozet();
    let o = o.lock();
    let mut tuvaller = vec!["ana"];
    if dikey {
      tuvaller.push("dikey");
    }
    tuvaller.iter().filter_map(|t| o.koleksiyon.program.get(*t).cloned()).collect()
  };
  let mut ogeler = Vec::new();
  for sahne in sahneler {
    let liste = komut(state, json!({"komut": "sahne.ogeler", "sahne": sahne})).await?;
    for x in liste.as_array().cloned().unwrap_or_default() {
      if x.get("kaynak").and_then(Value::as_str) == Some(id.as_str()) {
        if let Some(oge) = x.get("oge").and_then(Value::as_str) {
          ogeler.push((oge.to_string(), x.get("gorunur").and_then(Value::as_bool).unwrap_or(true)));
        }
      }
    }
  }
  let Some((_, ilk)) = ogeler.first() else {
    return Err(catisma(format!("«{ad}» hiçbir tuvale yerleştirilmemiş")));
  };
  let yeni = crate::hotkeys::source_enabled_after(kip, *ilk);
  for (oge, _) in &ogeler {
    komut(state, json!({"komut": "oge.donustur", "oge": oge, "donusum": {"gorunur": yeni}})).await?;
  }
  kaydet(state).await?;
  Ok((ad, yeni, ogeler.len()))
}

/// Kaynak kimliği ya da adıyla (büyük/küçük harf duyarsız, tek eşleşme) → (kimlik, ad, sessiz mi)
pub(crate) async fn motor_ses_kaynagi(state: &AppState, kaynak: &str) -> Result<(String, String, bool), Hata> {
  motor_calisiyor(state).await?;
  let o = state.motor.ozet();
  let o = o.lock();
  let k = &o.koleksiyon.kaynaklar;
  let r = match k.iter().find(|r| r.id == kaynak) {
    Some(r) => r,
    None => {
      let adlar: Vec<_> = k.iter().filter(|r| crate::motor_koleksiyon::ad_esit(&r.ad, kaynak)).collect();
      match adlar.as_slice() {
        [r] => *r,
        [] => return Err((StatusCode::NOT_FOUND, format!("«{kaynak}» adlı motor kaynağı yok"))),
        _ => return Err(catisma(format!("«{kaynak}» adını birden çok kaynak taşıyor; kimlikle belirtin"))),
      }
    }
  };
  if r.eksik {
    return Err(catisma(format!("«{}» kaynağının eklentisi yüklü değil", r.ad)));
  }
  Ok((r.id.clone(), r.ad.clone(), r.ses.sessiz))
}

/// Medya oynat/duraklat: oynuyorsa duraklat, değilse oynat
pub(crate) async fn medya_degistir_eylemi(state: &AppState, id: &str) -> Result<&'static str, Hata> {
  let liste = komut(state, json!({"komut": "ses.listesi"})).await?;
  let durum = liste["kaynaklar"].as_array().and_then(|a| a.iter().find(|x| x["id"] == id)).and_then(|x| x["medya"]["durum"].as_str().map(String::from));
  Ok(if durum.as_deref() == Some("oynuyor") { "duraklat" } else { "oynat" })
}

/// Sahneye geç (kısayol/deste): sahne kimliği ya da adı. Sahnenin tuvalinde Studio Mode açıksa önizlemeye alır
/// (OBS'teki gibi), değilse geçişle programa.
pub(crate) async fn motor_sahnesine_gec(state: &AppState, sahne: &str) -> Result<Value, Hata> {
  motor_calisiyor(state).await?;
  let (id, ad, tuval, studyo) = {
    let o = state.motor.ozet();
    let o = o.lock();
    let s = &o.koleksiyon.sahneler;
    let bulunan = match s.iter().find(|x| x.id == sahne) {
      Some(x) => x,
      None => {
        let adlar: Vec<_> = s.iter().filter(|x| crate::motor_koleksiyon::ad_esit(&x.ad, sahne)).collect();
        match adlar.as_slice() {
          [x] => *x,
          [] => return Err((StatusCode::NOT_FOUND, format!("«{sahne}» adlı motor sahnesi yok"))),
          _ => return Err(catisma(format!("«{sahne}» adını birden çok sahne taşıyor; kimlikle belirtin"))),
        }
      }
    };
    (bulunan.id.clone(), bulunan.ad.clone(), bulunan.tuval.clone(), o.studyo.contains_key(&bulunan.tuval))
  };
  if studyo {
    komut(state, json!({"komut": "studyo.onizleme", "tuval": tuval, "sahne": id})).await?;
    state.motor.ozet().lock().studyo.insert(tuval.clone(), Some(id.clone()));
    Ok(json!({"sahne": ad, "onizleme": true}))
  } else {
    super::motor_sahne_api::programa_al(state, &id, true, None).await?;
    Ok(json!({"sahne": ad, "program": true}))
  }
}

fn zaman_damgasi() -> String {
  chrono::Local::now().format("%Y-%m-%d %H-%M-%S").to_string()
}

async fn api_kayit(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<GoLiveGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.record").await?;
  match g.eylem.as_str() {
    "baslat" => {
      let yol = kayit_baslat(&state).await?;
      audit(&state, &actor, "MOTOR_RECORD_START", json!({})).await;
      Ok(Json(json!({"ok": true, "yol": yol})))
    }
    "durdur" => {
      let yol = kayit_durdur(&state).await?;
      audit(&state, &actor, "MOTOR_RECORD_STOP", json!({})).await;
      Ok(Json(json!({"ok": true, "yol": yol})))
    }
    "duraklat" | "surdur" => {
      let d = kayit_duraklat(&state, Some(g.eylem == "duraklat")).await?;
      audit(&state, &actor, "MOTOR_RECORD_PAUSE", json!({"duraklatildi": d})).await;
      Ok(Json(json!({"ok": true, "duraklatildi": d})))
    }
    "bol" => {
      kayit_bol(&state).await?;
      audit(&state, &actor, "MOTOR_RECORD_SPLIT", json!({})).await;
      Ok(Json(json!({"ok": true})))
    }
    e => Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  }
}

#[derive(Deserialize)]
struct EkranGoruntusuGovdesi {
  /// ana | dikey | studyo-ana | studyo-dikey (Studio Mode önizlemesi)
  #[serde(default)]
  tuval: Option<String>,
}

/// Dosya › Ekran görüntüsü (Çıkış): tuvalin tam çözünürlükte tek karesi, kayıt klasörüne
/// `Ekran Goruntusu <zaman>.png` adıyla. Dosya adı sunucuda üretilir (serbest yol yok).
async fn api_ekran_goruntusu(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<EkranGoruntusuGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.record").await?;
  motor_calisiyor(&state).await?;
  let tuval = g.tuval.unwrap_or_else(|| "ana".into());
  if tuval.starts_with("etkilesim-") || !onizleme_tuvali_gecerli(&tuval) {
    return Err(gecersiz(format!("bilinmeyen tuval: {tuval}")));
  }
  let klasor_yolu = crate::motor_profil::etkin(&klasor(&state)).kayit.klasor.map(PathBuf::from).unwrap_or_else(kayit_klasoru);
  std::fs::create_dir_all(&klasor_yolu).map_err(|e| catisma(format!("klasör: {e}")))?;
  let mut yol = klasor_yolu.join(format!("Ekran Goruntusu {}.png", zaman_damgasi()));
  let mut n = 2;
  while yol.exists() {
    yol = klasor_yolu.join(format!("Ekran Goruntusu {} ({n}).png", zaman_damgasi()));
    n += 1;
  }
  let r = komut(&state, json!({"komut": "ekran_goruntusu", "tuval": tuval, "yol": yol})).await?;
  audit(&state, &actor, "MOTOR_SCREENSHOT", json!({"tuval": tuval})).await;
  Ok(Json(json!({"ok": true, "yol": yol, "genislik": r["genislik"], "yukseklik": r["yukseklik"]})))
}

#[derive(Deserialize)]
struct KlasorGovdesi {
  /// kayit | gunluk | ayarlar — yalnız bilinen klasörler (serbest yol yok)
  tur: String,
}

/// Dosya › Kayıtları göster / Ayarlar klasörü, Yardım › Günlük klasörü: Gezgin'de açar. Yalnız bu bilgisayardan.
async fn api_klasor_ac(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<KlasorGovdesi>,
) -> ApiResult {
  if !addr.ip().is_loopback() {
    return Err((StatusCode::FORBIDDEN, "yalnız bu bilgisayardan".into()));
  }
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let yol = match g.tur.as_str() {
    "kayit" => crate::motor_profil::etkin(&klasor(&state)).kayit.klasor.map(PathBuf::from).unwrap_or_else(kayit_klasoru),
    "gunluk" | "ayarlar" => klasor(&state),
    e => return Err(gecersiz(format!("bilinmeyen klasör: {e}"))),
  };
  std::fs::create_dir_all(&yol).map_err(|e| catisma(format!("klasör: {e}")))?;
  #[cfg(windows)]
  std::process::Command::new("explorer.exe").arg(&yol).spawn().map_err(|e| catisma(format!("Gezgin açılamadı: {e}")))?;
  Ok(Json(json!({"ok": true, "yol": yol})))
}

#[derive(Deserialize)]
struct GunlukSorgusu {
  #[serde(default)]
  satir: Option<usize>,
}

/// Yardım › Son günlüğü görüntüle: motorun libobs günlüğünün son satırları, yayın anahtarları ve kullanıcı klasörü
/// ayıklanmış olarak (destek paketiyle aynı gizleyici).
async fn api_gunluk(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<GunlukSorgusu>,
) -> ApiResult {
  authorize(&state, &addr, &headers, "admin.support").await?;
  let n = q.satir.unwrap_or(400).clamp(10, 5000);
  let satirlar = crate::destek::son_satirlar(&klasor(&state).join("motor-libobs.log"), n);
  let sirlar: Vec<String> = state.multistream.configs().iter().filter_map(|c| state.multistream.key_for(&c.id)).collect();
  let mut g = crate::destek::Gizleyici::new(sirlar, std::env::var("USERPROFILE").ok());
  let temiz: Vec<String> = satirlar.iter().map(|s| g.metin(s)).collect();
  Ok(Json(json!({"satirlar": temiz, "gizlenen": g.sayac})))
}

#[derive(Deserialize)]
struct SanalKameraGovdesi {
  eylem: String,
  #[serde(default)]
  tuval: Option<String>,
}

async fn api_sanal_kamera(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<SanalKameraGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.outputs").await?;
  let acik = sanal_kamera(&state, &g.eylem, g.tuval.as_deref().unwrap_or("ana")).await?;
  audit(&state, &actor, "MOTOR_VIRTUALCAM", json!({"acik": acik, "tuval": g.tuval})).await;
  Ok(Json(json!({"ok": true, "acik": acik})))
}

#[derive(Deserialize)]
struct TekrarGovdesi {
  eylem: String,
  #[serde(default)]
  sure_sn: Option<u32>,
}

/// Tekrar arabelleğini açar (ana tuval; profilde seçiliyse dikey de). `sure_sn` yoksa profildeki süre. Açıksa dokunmaz.
pub(crate) async fn tekrar_ac(state: &AppState, g_sure: Option<u32>) -> Result<u32, Hata> {
  motor_calisiyor(state).await?;
  if cikis_etkin(state, "tekrar") {
    return Ok(state.motor.ozet().lock().profil.tekrar_sn);
  }
  let sure = match g_sure {
    Some(s) if (5..=600).contains(&s) => s,
    Some(_) => return Err(gecersiz("tekrar süresi 5–600 sn olmalı".into())),
    None => state.motor.ozet().lock().profil.tekrar_sn,
  };
  // OBS gibi tekrar da kayıt yoluna yazılır (profilde klasör yoksa varsayılan kayıt klasörü)
  let dizin = state.motor.ozet().lock().profil.kayit.klasor.as_ref().map(PathBuf::from).unwrap_or_else(kayit_klasoru);
  std::fs::create_dir_all(&dizin).map_err(|e| catisma(format!("kayıt klasörü: {e}")))?;
  kodlayici_hazirla(state, "ana").await?;
  ses_hazirla(state, 0).await?;
  if state.motor.ozet().lock().tekrar_cikisi_var {
    komut(state, json!({"komut": "cikis.sil", "id": "tekrar"})).await?;
  }
  komut(state, json!({"komut": "cikis.tekrar", "id": "tekrar", "klasor": dizin, "sure_sn": sure, "video": "v-ana", "sesler": ["ses-0"]})).await?;
  state.motor.ozet().lock().tekrar_cikisi_var = true;
  komut(state, json!({"komut": "cikis.baslat", "id": "tekrar"})).await?;
  // Dikey tuval için de (profil seçeneği ve dikey tuval açıksa)
  let (dikey_iste, dikey_var, dikey_eski) = {
    let o = state.motor.ozet();
    let o = o.lock();
    (o.profil.tekrar_dikey, o.dikey_tuval, o.tekrar_dikey_var)
  };
  if dikey_iste && dikey_var {
    kodlayici_hazirla(state, "dikey").await?;
    if dikey_eski {
      komut(state, json!({"komut": "cikis.sil", "id": "tekrar-dikey"})).await?;
    }
    let d = dizin.join("Dikey");
    std::fs::create_dir_all(&d).map_err(|e| catisma(format!("kayıt klasörü: {e}")))?;
    komut(state, json!({"komut": "cikis.tekrar", "id": "tekrar-dikey", "klasor": d, "sure_sn": sure, "video": "v-dikey", "sesler": ["ses-0"]})).await?;
    state.motor.ozet().lock().tekrar_dikey_var = true;
    komut(state, json!({"komut": "cikis.baslat", "id": "tekrar-dikey"})).await?;
  }
  let mut p = state.motor.ozet().lock().profil.clone();
  if p.tekrar_sn != sure {
    p.tekrar_sn = sure;
    profil_yaz(state, &p)?;
  }
  Ok(sure)
}

/// Tekrar arabelleğini (ve dikeyini) durdurur
pub(crate) async fn tekrar_kapat(state: &AppState) -> Result<(), Hata> {
  motor_calisiyor(state).await?;
  komut(state, json!({"komut": "cikis.durdur", "id": "tekrar"})).await?;
  if state.motor.ozet().lock().tekrar_dikey_var {
    let _ = komut(state, json!({"komut": "cikis.durdur", "id": "tekrar-dikey"})).await;
  }
  Ok(())
}

async fn api_tekrar(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(g): Json<TekrarGovdesi>,
) -> ApiResult {
  let actor = authorize(&state, &addr, &headers, "broadcast.replay").await?;
  motor_calisiyor(&state).await?;
  match g.eylem.as_str() {
    "ac" => {
      let sure = tekrar_ac(&state, g.sure_sn).await?;
      audit(&state, &actor, "MOTOR_REPLAY_ON", json!({"sureSn": sure})).await;
      Ok(Json(json!({"ok": true})))
    }
    "kapat" => {
      tekrar_kapat(&state).await?;
      audit(&state, &actor, "MOTOR_REPLAY_OFF", json!({})).await;
      Ok(Json(json!({"ok": true})))
    }
    "kaydet" => {
      let yol = tekrar_kaydet(&state).await?;
      audit(&state, &actor, "MOTOR_REPLAY_SAVE", json!({})).await;
      Ok(Json(json!({"ok": true, "yol": yol})))
    }
    e => Err(gecersiz(format!("bilinmeyen eylem: {e}"))),
  }
}

#[derive(Deserialize)]
struct OnizlemeSorgusu {
  #[serde(default)]
  tuval: Option<String>,
  #[serde(default)]
  genislik: Option<u32>,
}

async fn api_onizleme(
  State(state): State<Arc<AppState>>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Query(q): Query<OnizlemeSorgusu>,
) -> Result<Response, Hata> {
  authorize(&state, &addr, &headers, "broadcast.read").await?;
  let tuval = q.tuval.unwrap_or_else(|| "ana".into());
  // Studio Mode önizlemesi ("studyo-ana") ve etkileşim penceresi ("etkilesim-<kaynak>") de istenebilir
  if !onizleme_tuvali_gecerli(&tuval) {
    return Err(gecersiz("tuval yok".into()));
  }
  let v = komut(&state, json!({"komut": "onizleme", "tuval": tuval, "genislik": q.genislik.unwrap_or(480).clamp(64, 960)})).await?;
  let Some(b64) = v.get("png").and_then(Value::as_str) else {
    return Ok(StatusCode::NO_CONTENT.into_response());
  };
  use base64::Engine as _;
  let png = base64::engine::general_purpose::STANDARD.decode(b64).map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
  Ok(
    Response::builder()
      .header(header::CONTENT_TYPE, "image/png")
      .header(header::CACHE_CONTROL, "no-store")
      .body(Body::from(png))
      .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response()),
  )
}
