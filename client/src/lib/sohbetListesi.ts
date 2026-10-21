/**
 * Sohbet katmanının ileti listesi: her zaman eskiden yeniye tutulur, gösterim yönü
 * (yeni üstte/altta) yalnız çizimde uygulanır.
 *
 * Eskiden "yeni mesajlar üstte" açıkken liste `[yeni, ...eski]` kurulup `slice(-max)`
 * ile kırpılıyordu: kırpma en YENİ iletiyi atıyordu, çizimde de tekrar ters çevrildiği
 * için ayar hiçbir şey değiştirmiyordu.
 */
export interface SohbetOgesi {
  /** Platformun ileti kimliği (moderatör silince eşleşmek için) */
  kaynakId?: string;
  platform: string;
  /** Küçük harf kullanıcı adı (yasaklanınca iletileri kaldırmak için) */
  kullanici?: string;
}

export function iletiEkle<T>(liste: T[], yeni: T, enCok: number): T[] {
  return [...liste, yeni].slice(-Math.max(1, enCok));
}

/** Silinen ileti(ler)i ya da yasaklanan kullanıcının iletilerini çıkarır. */
export function iletiCikar<T extends SohbetOgesi>(
  liste: T[],
  olay: { platform?: string; id?: string; kullanici?: string }
): T[] {
  const ayniPlatform = (m: T) => !olay.platform || m.platform === olay.platform;
  if (olay.id) return liste.filter((m) => !(ayniPlatform(m) && m.kaynakId === olay.id));
  const k = olay.kullanici?.toLowerCase();
  if (k) return liste.filter((m) => !(ayniPlatform(m) && m.kullanici === k));
  return liste;
}
