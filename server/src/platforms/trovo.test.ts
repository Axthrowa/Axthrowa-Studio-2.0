/**
 * StreamAxT — Trovo eşleme testleri
 * Developed by AxthrowA
 *
 * Örnekler resmi belgedeki "Chat Message Types and Samples" tablosundan
 * BİREBİR alındı (CONFIRMED_IN_PUBLIC_DOCS). Amaç: tür kodlarının yanlış
 * olaya bağlanması gibi sessiz bir hatayı kalıcı olarak engellemek.
 */
import { describe, it, expect } from 'vitest';
import {
  SOHBET_TURLERI,
  hediyeAboneAlici,
  hediyeCoz,
  kalpAtisiAraligi,
  raidSayisi,
  rolleriCoz,
  sohbetOlayi,
  yenidenBaglanmaGecikmesi
} from './trovo-map.js';

describe('rolleriCoz', () => {
  it('yayıncıyı tanır', () => {
    const r = rolleriCoz(['streamer', 'subscriber'], ['creator', 'sub_L2']);
    expect(r.isBroadcaster).toBe(true);
    expect(r.isSub).toBe(true);
    expect(r.rozetler).toEqual(['creator', 'sub_L2']);
  });

  it('mod ve supermod moderatör sayılır', () => {
    expect(rolleriCoz(['mod'], []).isMod).toBe(true);
    expect(rolleriCoz(['supermod'], []).isMod).toBe(true);
    expect(rolleriCoz(['admin'], []).isMod).toBe(true);
    expect(rolleriCoz(['warden'], []).isMod).toBe(true);
  });

  it('yalnız takipçi hiçbir ayrıcalık almaz', () => {
    const r = rolleriCoz(['follower'], []);
    expect(r.isMod).toBe(false);
    expect(r.isSub).toBe(false);
    expect(r.isVip).toBe(false);
    expect(r.isBroadcaster).toBe(false);
  });

  it('Trovo üyeliği (ace) kanal rolü DEĞİLDİR — VIP yapmaz', () => {
    // Uydurma eşleme yapılmadığının kilidi
    expect(rolleriCoz(['ace+'], []).isVip).toBe(false);
  });

  it('editor kanal ayrıcalığıdır, VIP sayılır', () => {
    expect(rolleriCoz(['editor'], []).isVip).toBe(true);
  });

  it('bozuk girdide çökmez', () => {
    expect(rolleriCoz(null, undefined).isMod).toBe(false);
    expect(rolleriCoz('mod', 5).rozetler).toEqual([]);
  });
});

describe('hediyeCoz', () => {
  it('belgedeki spell örneğini çözer', () => {
    expect(hediyeCoz('{"gift":"Winner", "num":1}')).toEqual({ hediye: 'Winner', adet: 1 });
  });

  it('özel spell (sid alanlı) örneğini çözer', () => {
    expect(hediyeCoz('{"gift":"GiftName", "num":1, "sid":1000001}')).toEqual({ hediye: 'GiftName', adet: 1 });
  });

  it('bozuk JSON’da uydurma değer üretmez', () => {
    expect(hediyeCoz('düz metin')).toEqual({ hediye: '', adet: 0 });
    expect(hediyeCoz(undefined)).toEqual({ hediye: '', adet: 0 });
  });
});

describe('hediyeAboneAlici', () => {
  it('"uid,kullanıcı" biçiminden alıcıyı çıkarır', () => {
    expect(hediyeAboneAlici('100000252,CatKing')).toBe('CatKing');
  });

  it('virgül yoksa boş döner', () => {
    expect(hediyeAboneAlici('2')).toBe('');
  });
});

describe('raidSayisi', () => {
  it('raid mesajındaki sayıyı bulur', () => {
    expect(raidSayisi('leaf is carrying 42 raiders to this channel. Welcome!')).toBe(42);
  });

  it('sayı yoksa 0', () => {
    expect(raidSayisi('is carrying raiders')).toBe(0);
  });
});

describe('sohbetOlayi — belgedeki tür tablosu', () => {
  it('tür 0 düz sohbettir', () => {
    expect(sohbetOlayi({ type: 0, content: 'Good game!' }).tur).toBe('chat');
  });

  it('magic chat türleri (6,7,8,9) da sohbettir', () => {
    for (const t of [6, 7, 8, 9]) {
      expect(sohbetOlayi({ type: t, content: 'x' }).tur).toBe('chat');
      expect(SOHBET_TURLERI.has(t)).toBe(true);
    }
  });

  it('5 = spell → hediye', () => {
    const o = sohbetOlayi({ type: 5, content: '{"gift":"Winner","num":3}' });
    expect(o.tur).toBe('gift');
    expect(o.hedef).toBe('Winner');
    expect(o.adet).toBe(3);
  });

  it('5009 = özel spell → hediye', () => {
    expect(sohbetOlayi({ type: 5009, content: '{"gift":"G","num":1}' }).tur).toBe('gift');
  });

  it('5001 = abonelik', () => {
    const o = sohbetOlayi({ type: 5001, content: 'has subscribed to the channel!' });
    expect(o.tur).toBe('sub');
    expect(o.adet).toBe(1);
  });

  it('5003 = takip', () => {
    expect(sohbetOlayi({ type: 5003, content: 'just followed channel!' }).tur).toBe('follow');
  });

  it('5005 = rastgele hediye abone, içerik ADETTİR', () => {
    const o = sohbetOlayi({ type: 5005, content: '2' });
    expect(o.tur).toBe('gift_sub');
    expect(o.adet).toBe(2);
    expect(o.hedef).toBe('');
  });

  it('5006 = belirli kişiye hediye abone', () => {
    const o = sohbetOlayi({ type: 5006, content: '100000252,CatKing' });
    expect(o.tur).toBe('gift_sub');
    expect(o.adet).toBe(1);
    expect(o.hedef).toBe('CatKing');
  });

  it('5008 = raid karşılaması', () => {
    const o = sohbetOlayi({ type: 5008, content: 'leaf is carrying 7 raiders to this channel. Welcome!' });
    expect(o.tur).toBe('raid');
    expect(o.adet).toBe(7);
  });

  it('5012 = yayın açıldı / kapandı', () => {
    expect(sohbetOlayi({ type: 5012, content: 'stream_on' }).tur).toBe('stream_online');
    expect(sohbetOlayi({ type: 5012, content: 'stream_off' }).tur).toBe('stream_offline');
  });

  it('karşılığı olmayan türler SESSİZCE yok sayılır', () => {
    // 5002 sistem, 5004 giriş, 5007 platform etkinliği, 5013 takibi bırakma
    for (const t of [5002, 5004, 5007, 5013]) {
      expect(sohbetOlayi({ type: t, content: 'x' }).tur).toBe('yoksay');
    }
  });

  it('BİLİNMEYEN tür uydurma olaya çevrilmez', () => {
    expect(sohbetOlayi({ type: 99999, content: 'x' }).tur).toBe('yoksay');
    expect(sohbetOlayi({}).tur).toBe('yoksay');
  });
});

describe('kalpAtisiAraligi', () => {
  it('PONG’daki gap saniyesini ms’ye çevirir', () => {
    expect(kalpAtisiAraligi({ type: 'PONG', data: { gap: 45 } })).toBe(45_000);
  });

  it('gap yoksa 30 sn varsayılanı', () => {
    expect(kalpAtisiAraligi({})).toBe(30_000);
    expect(kalpAtisiAraligi({ data: { gap: 'abc' } })).toBe(30_000);
  });

  it('saçma değerleri makul sınıra çeker', () => {
    // 0 sn dönseydi sunucuyu saniyede yüzlerce PING ile döverdik
    expect(kalpAtisiAraligi({ data: { gap: 0 } })).toBe(30_000);
    expect(kalpAtisiAraligi({ data: { gap: 1 } })).toBe(5_000);
    expect(kalpAtisiAraligi({ data: { gap: 99999 } })).toBe(120_000);
  });
});

describe('yenidenBaglanmaGecikmesi', () => {
  it('üstel artar ve 30 sn’de durur', () => {
    expect(yenidenBaglanmaGecikmesi(0)).toBe(1000);
    expect(yenidenBaglanmaGecikmesi(1)).toBe(2000);
    expect(yenidenBaglanmaGecikmesi(3)).toBe(8000);
    expect(yenidenBaglanmaGecikmesi(5)).toBe(30_000);
    expect(yenidenBaglanmaGecikmesi(50)).toBe(30_000);
  });

  it('negatif denemede ilk gecikmeye döner', () => {
    expect(yenidenBaglanmaGecikmesi(-3)).toBe(1000);
  });
});
