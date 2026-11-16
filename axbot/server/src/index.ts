/**
 * AxBoT — giriş noktası ve gözcü
 * Developed by AxthrowA
 *
 * `node dist/index.js` (AxthrowA Studio da böyle başlatır) önce bir
 * GÖZCÜ süreci açar; asıl bot (app.ts) onun alt sürecidir. Bot beklenmedik
 * biçimde kapanırsa (yakalanmamış hata, bellek, sürücü) gözcü birkaç saniye
 * sonra yeniden başlatır — kullanıcı "bot kendi kendine kapandı" demesin.
 *
 *  • Çıkış kodu 0 (normal kapanış) ya da 2 (başka bir AxBoT zaten
 *    çalışıyor) → yeniden başlatılmaz.
 *  • 10 dk içinde 8'den fazla çökme → vazgeçilir (sonsuz döngü olmasın).
 *  • Gözcü ölürse (pencere kapatıldı, görev yöneticisi) alt süreç IPC
 *    kopmasını görür ve kendisi de kapanır; yetim süreç portu tutmaz.
 *
 * `AXBOT_GOZCU=kapali` gözcüsüz çalıştırır (geliştirme, sınama).
 */
import { fork, type ChildProcess } from 'child_process';
import { gozcuKarari, type CokmeKaydi } from './core/gozcu-karar.js';

const COCUK = process.env.AXBOT_COCUK === '1';
const GOZCUSUZ = String(process.env.AXBOT_GOZCU || '').toLowerCase() === 'kapali';

if (COCUK || GOZCUSUZ) {
  if (COCUK) {
    // Gözcü öldüyse (IPC kapandı) alt süreç de kapanır: portu tutan yetim kalmasın
    process.on('disconnect', () => process.exit(0));
  }
  void import('./app.js');
} else {
  const betik = __filename;
  const cokmeler: CokmeKaydi[] = [];
  let cocuk: ChildProcess | null = null;
  let kapaniyor = false;

  const baslat = () => {
    cocuk = fork(betik, process.argv.slice(2), {
      env: { ...process.env, AXBOT_COCUK: '1' },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      windowsHide: true
    });
    cocuk.on('exit', (kod, sinyal) => {
      cocuk = null;
      if (kapaniyor) return process.exit(0);
      const karar = gozcuKarari(kod, sinyal, cokmeler, Date.now());
      if (karar.tur === 'cik') {
        if (karar.mesaj) console.error(`[Gözcü] ${karar.mesaj}`);
        process.exit(karar.kod);
      }
      cokmeler.push({ zaman: Date.now(), kod });
      console.error(`[Gözcü] Bot beklenmedik şekilde kapandı (kod ${kod ?? sinyal}). ${karar.beklemeMs / 1000} sn sonra yeniden başlatılıyor…`);
      setTimeout(baslat, karar.beklemeMs);
    });
  };

  const kapat = () => {
    kapaniyor = true;
    if (cocuk) cocuk.kill();
    else process.exit(0);
    // Alt süreç 8 sn'de kapanmazsa zorla
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGINT', kapat);
  process.on('SIGTERM', kapat);
  process.on('SIGBREAK', kapat);

  baslat();
}
