//! Sahne ve öğe yönetimi: sahne adı/silme, kaynak adı/çoğaltma, gruplar ve öğe kimlikleri.
//!
//! Öğe kimliği `sahne/kaynak`; aynı kaynak aynı sahneye birden çok kez eklenirse `sahne/kaynak#2`, `#3`… Grup öğesi
//! `sahne/<grup kimliği>` (grup kimliği `kaynaklar`da değil `gruplar`da). libobs grup ekleme aynı sahne öğesini
//! taşır (işaretçi geçerli kalır); grup çözme yeni öğeler oluşturur — eşleme o anda kaynak üzerinden yeniden kurulur.

use crate::motor::{gecerli_kimlik, Motor};
use crate::obs::{api, cs, Ptr};

/// Öğe kimliğinden kaynak (ya da sahne/grup) kimliği: `s/k#2` → `k`
pub fn oge_kaynagi(oge: &str) -> &str {
  let k = oge.rsplit_once('/').map_or(oge, |(_, k)| k);
  k.split_once('#').map_or(k, |(k, _)| k)
}

/// Öğenin sahnesi: `s/k#2` → `s`
pub fn oge_sahnesi(oge: &str) -> &str {
  oge.rsplit_once('/').map_or("", |(s, _)| s)
}

unsafe extern "C" fn topla(_s: Ptr, oge: Ptr, param: Ptr) -> bool {
  if let Some(v) = (param as *mut Vec<Ptr>).as_mut() {
    v.push(oge);
  }
  true
}

pub(crate) fn sahne_ogeleri_ham(sahne: Ptr) -> Vec<Ptr> {
  let mut v: Vec<Ptr> = Vec::new();
  unsafe { (api().obs_scene_enum_items)(sahne, topla, &mut v as *mut Vec<Ptr> as Ptr) };
  v
}

pub(crate) fn grup_ogeleri_ham(grup: Ptr) -> Vec<Ptr> {
  let mut v: Vec<Ptr> = Vec::new();
  unsafe { (api().obs_sceneitem_group_enum_items)(grup, topla, &mut v as *mut Vec<Ptr> as Ptr) };
  v
}

impl Motor {
  /// Sahnede kullanılmamış öğe kimliği
  pub(crate) fn yeni_oge_kimligi(&self, sahne: &str, kaynak: &str) -> String {
    let taban = format!("{sahne}/{kaynak}");
    if !self.ogeler.contains_key(&taban) {
      return taban;
    }
    (2..).map(|n| format!("{taban}#{n}")).find(|k| !self.ogeler.contains_key(k)).unwrap_or(taban)
  }

  /// Kaynağın libobs göstericisi: kaynaklar, sonra sahneler (sahne kaynak olarak), sonra gruplar değil.
  pub(crate) fn kaynak_ya_da_sahne(&self, id: &str) -> Option<Ptr> {
    if let Some(k) = self.kaynaklar.get(id) {
      return Some(*k);
    }
    self.sahneler.get(id).map(|s| unsafe { (api().obs_scene_get_source)(s.ptr) })
  }

  pub fn sahne_adlandir(&mut self, id: &str, ad: &str) -> Result<(), String> {
    let s = self.sahneler.get(id).ok_or_else(|| format!("sahne yok: {id}"))?;
    unsafe { (api().obs_source_set_name)((api().obs_scene_get_source)(s.ptr), cs(ad).as_ptr()) };
    Ok(())
  }

  /// Sahneyi siler. Programdaki ya da Studio Mode önizlemesindeki sahne silinemez (önce başka sahneye geçilir).
  pub fn sahne_sil(&mut self, id: &str) -> Result<(), String> {
    let kanvas = self.sahneler.get(id).ok_or_else(|| format!("sahne yok: {id}"))?.kanvas.clone();
    if self.program_sahnesi(&kanvas).as_deref() == Some(id) {
      return Err("programdaki sahne silinemez; önce başka bir sahneye geçin".into());
    }
    if self.studyo_durumu(&kanvas).flatten().as_deref() == Some(id) {
      return Err("Studio Mode önizlemesindeki sahne silinemez".into());
    }
    // Bu sahnenin öğeleri ve başka sahnelerde bu sahneyi kaynak olarak kullanan öğeler
    let dus: Vec<String> = self
      .ogeler
      .keys()
      .filter(|o| crate::sahne::oge_sahnesi(o) == id || crate::sahne::oge_kaynagi(o) == id)
      .cloned()
      .collect();
    for o in dus {
      if let Some(p) = self.ogeler.remove(&o) {
        if crate::sahne::oge_sahnesi(&o) != id {
          unsafe { (api().obs_sceneitem_remove)(p) };
        }
      }
    }
    // Sahnenin ve gruplarının filtreleri (kaynakları silinmeden önce çıkarılır)
    let gruplar: Vec<String> = self.gruplar.iter().filter(|(_, s)| *s == id).map(|(g, _)| g.clone()).collect();
    for g in &gruplar {
      self.kaynak_filtrelerini_birak(Some(g));
    }
    self.kaynak_filtrelerini_birak(Some(id));
    self.gruplar.retain(|_, sahne| sahne != id);
    let s = self.sahneler.remove(id).unwrap();
    unsafe {
      (api().obs_source_remove)((api().obs_scene_get_source)(s.ptr));
      (api().obs_scene_release)(s.ptr);
    }
    Ok(())
  }

  pub fn kaynak_adlandir(&mut self, id: &str, ad: &str) -> Result<(), String> {
    let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak yok: {id}"))?;
    unsafe { (api().obs_source_set_name)(k, cs(ad).as_ptr()) };
    Ok(())
  }

  /// Kaynağı ayarları ve libobs filtreleriyle çoğaltır (sahneye eklemez).
  pub fn kaynak_cogalt(&mut self, id: &str, yeni: &str, ad: &str) -> Result<(), String> {
    gecerli_kimlik(yeni)?;
    if self.kaynaklar.contains_key(yeni) {
      return Err(format!("kaynak zaten var: {yeni}"));
    }
    let k = *self.kaynaklar.get(id).ok_or_else(|| format!("kaynak yok: {id}"))?;
    let c = unsafe { (api().obs_source_duplicate)(k, cs(ad).as_ptr(), false) };
    if c.is_null() {
      return Err("kaynak çoğaltılamadı".into());
    }
    self.kaynaklar.insert(yeni.into(), c);
    self.olcer_bagla(yeni);
    Ok(())
  }

  /// Seçilen öğeleri yeni bir gruba alır (öğeler aynı sahnede olmalı). Dönüş: grup öğesinin kimliği.
  pub fn grup_olustur(&mut self, sahne: &str, grup: &str, ad: &str, ogeler: &[String]) -> Result<String, String> {
    gecerli_kimlik(grup)?;
    if self.gruplar.contains_key(grup) || self.kaynaklar.contains_key(grup) || self.sahneler.contains_key(grup) {
      return Err(format!("kimlik kullanımda: {grup}"));
    }
    let s = self.sahneler.get(sahne).ok_or_else(|| format!("sahne yok: {sahne}"))?.ptr;
    let mut ptrler = Vec::new();
    for o in ogeler {
      if crate::sahne::oge_sahnesi(o) != sahne {
        return Err(format!("öğe bu sahnede değil: {o}"));
      }
      ptrler.push(*self.ogeler.get(o).ok_or_else(|| format!("öğe yok: {o}"))?);
    }
    let g = unsafe { (api().obs_scene_add_group2)(s, cs(ad).as_ptr(), true) };
    if g.is_null() {
      return Err("grup oluşturulamadı".into());
    }
    for p in ptrler {
      unsafe { (api().obs_sceneitem_group_add_item)(g, p) };
    }
    let oge = format!("{sahne}/{grup}");
    self.ogeler.insert(oge.clone(), g);
    self.gruplar.insert(grup.into(), sahne.into());
    Ok(oge)
  }

  /// Grubu çözer: çocuklar sahneye (grup dönüşümü uygulanmış hâlde) döner, grup kaybolur.
  pub fn grup_coz(&mut self, grup_oge: &str) -> Result<(), String> {
    let g = *self.ogeler.get(grup_oge).ok_or_else(|| format!("öğe yok: {grup_oge}"))?;
    if !unsafe { (api().obs_sceneitem_is_group)(g) } {
      return Err("öğe bir grup değil".into());
    }
    let sahne = crate::sahne::oge_sahnesi(grup_oge).to_string();
    let s = self.sahneler.get(&sahne).ok_or("sahne yok")?.ptr;
    // Çocukların kimlikleri ve kaynakları (sırasıyla)
    let cocuklar: Vec<(String, Ptr)> = grup_ogeleri_ham(g)
      .into_iter()
      .filter_map(|p| {
        let id = self.ogeler.iter().find(|(_, v)| **v == p).map(|(k, _)| k.clone())?;
        Some((id, unsafe { (api().obs_sceneitem_get_source)(p) }))
      })
      .collect();
    let onceki: Vec<Ptr> = sahne_ogeleri_ham(s);
    // Grubun filtreleri grupla birlikte gider (OBS'te de)
    self.kaynak_filtrelerini_birak(Some(crate::sahne::oge_kaynagi(grup_oge)));
    unsafe { (api().obs_sceneitem_group_ungroup2)(g, true) };
    self.ogeler.remove(grup_oge);
    self.gruplar.remove(crate::sahne::oge_kaynagi(grup_oge));
    let mut bekleyen = cocuklar;
    for p in sahne_ogeleri_ham(s) {
      if onceki.contains(&p) {
        continue;
      }
      let kaynak = unsafe { (api().obs_sceneitem_get_source)(p) };
      if let Some(i) = bekleyen.iter().position(|(_, k)| *k == kaynak) {
        let (id, _) = bekleyen.remove(i);
        self.ogeler.insert(id, p);
      }
    }
    // Eşlenemeyen (olmamalı) eski kimlikler düşer; işaretçileri artık geçersiz
    for (id, _) in bekleyen {
      self.ogeler.remove(&id);
    }
    Ok(())
  }

  /// Öğeyi bulunduğu gruptan sahnenin köküne çıkarır.
  pub fn gruptan_cikar(&mut self, oge: &str) -> Result<(), String> {
    let p = *self.ogeler.get(oge).ok_or_else(|| format!("öğe yok: {oge}"))?;
    let sahne = crate::sahne::oge_sahnesi(oge);
    let s = self.sahneler.get(sahne).ok_or("sahne yok")?.ptr;
    let g = unsafe { (api().obs_sceneitem_get_group)(s, p) };
    if g.is_null() {
      return Err("öğe bir grupta değil".into());
    }
    unsafe { (api().obs_sceneitem_group_remove_item)(g, p) };
    Ok(())
  }

  /// Öğeyi var olan bir gruba ekler.
  pub fn gruba_ekle(&mut self, grup_oge: &str, oge: &str) -> Result<(), String> {
    let g = *self.ogeler.get(grup_oge).ok_or_else(|| format!("öğe yok: {grup_oge}"))?;
    let p = *self.ogeler.get(oge).ok_or_else(|| format!("öğe yok: {oge}"))?;
    if crate::sahne::oge_sahnesi(grup_oge) != crate::sahne::oge_sahnesi(oge) {
      return Err("öğe ile grup aynı sahnede olmalı".into());
    }
    unsafe { (api().obs_sceneitem_group_add_item)(g, p) };
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn oge_kimligi_ayristirma() {
    assert_eq!(oge_kaynagi("sahne-ana/k1"), "k1");
    assert_eq!(oge_kaynagi("sahne-ana/k1#3"), "k1");
    assert_eq!(oge_sahnesi("sahne-ana/k1#3"), "sahne-ana");
    assert_eq!(oge_kaynagi("k1"), "k1");
    assert_eq!(oge_sahnesi("k1"), "");
  }
}
