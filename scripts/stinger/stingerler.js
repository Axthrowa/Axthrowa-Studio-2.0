/**
 * AxthrowA Studio — stinger geçişleri (tuval çizimi)
 *
 * Her stinger `ciz(ctx, t, W, H, renk)` ile tek kareyi çizer; t 0→1. Ekran `ORTU` aralığında tamamen kapalıdır
 * (OBS sahneyi bu sırada değiştirir: geçiş noktası = `nokta` × süre). Arka plan saydamdır, hiçbir dış görsel
 * kullanılmaz; aynı kod uygulamada canlı önizleme için de çalışır.
 */
(function (kok) {
  const ease = {
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    out: (x) => 1 - Math.pow(1 - x, 3),
    in: (x) => x * x * x,
    outBack: (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2),
    expo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2)
  };
  const kis = (x) => Math.max(0, Math.min(1, x));
  /** t'yi [a, b] aralığında 0→1'e çevirir */
  const ara = (t, a, b) => kis((t - a) / (b - a));
  /** Tekrarlanabilir rastgele (aynı kareler her çizimde aynı) */
  const tohum = (s) => () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const VARSAYILAN_RENK = { zemin: '#0b0d12', vurgu: '#22d3ee', ikinci: '#8b5cf6', parlak: '#ffffff' };

  /** Eğik paralelkenar (sol kenardan x, genişlik w, eğim e px) */
  function egikBar(ctx, x, w, H, e) {
    ctx.beginPath();
    ctx.moveTo(x + e, 0);
    ctx.lineTo(x + w + e, 0);
    ctx.lineTo(x + w, H);
    ctx.lineTo(x, H);
    ctx.closePath();
  }

  const STINGERLER = [
    {
      id: 'neon-supurme',
      ad: 'Neon süpürme',
      aciklama: 'Eğik neon şeritler soldan girip ekranı örter, sağdan çıkar.',
      sure: 1200,
      nokta: 0.5,
      ciz(ctx, t, W, H, r) {
        const e = H * 0.36;
        const katman = [
          { renk: r.ikinci, gecikme: 0.0 },
          { renk: r.vurgu, gecikme: 0.05 },
          { renk: r.zemin, gecikme: 0.1, ana: true }
        ];
        for (const k of katman) {
          const giris = ease.inOut(ara(t, k.gecikme, 0.42 + k.gecikme * 0.3));
          const cikis = ease.inOut(ara(t, 0.56 + k.gecikme * 0.6, 0.96 + k.gecikme * 0.4));
          const gen = W + e * 2 + 40;
          // Başta tamamen solda, girişte eğik sol kenar da ekran dışında (tam örtü), çıkışta tamamen sağda
          const bas = -gen - e;
          const ortu = -e - 10;
          const x = bas + giris * (ortu - bas) + cikis * (W + 10 - ortu);
          ctx.fillStyle = k.renk;
          egikBar(ctx, x, gen, H, e);
          ctx.fill();
          if (k.ana) {
            // Ana şeridin iki kenarında parlayan çizgi
            ctx.save();
            ctx.shadowColor = r.vurgu;
            ctx.shadowBlur = 28;
            ctx.strokeStyle = r.parlak;
            ctx.lineWidth = 6;
            for (const kx of [x, x + gen]) {
              ctx.beginPath();
              ctx.moveTo(kx + e, 0);
              ctx.lineTo(kx, H);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }
    },
    {
      id: 'murekkep',
      ad: 'Mürekkep lekesi',
      aciklama: 'Organik bir leke ortadan yayılıp ekranı kaplar, içten delinerek açılır.',
      sure: 1300,
      nokta: 0.5,
      ciz(ctx, t, W, H, r) {
        const cx = W * 0.5;
        const cy = H * 0.52;
        const enBuyuk = Math.hypot(W, H) * 0.7;
        const sekil = (R, faz, renk) => {
          ctx.beginPath();
          for (let i = 0; i <= 128; i++) {
            const a = (i / 128) * Math.PI * 2;
            const rr = R * (1 + 0.1 * Math.sin(5 * a + faz) + 0.05 * Math.sin(11 * a - faz * 1.7) + 0.03 * Math.sin(17 * a + 2));
            const x = cx + Math.cos(a) * rr;
            const y = cy + Math.sin(a) * rr;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.closePath();
          ctx.fillStyle = renk;
          ctx.fill();
        };
        const buyu = ease.out(ara(t, 0, 0.45));
        if (t < 0.5) {
          sekil(enBuyuk * buyu * 1.06, t * 9, r.ikinci);
          sekil(enBuyuk * ease.out(ara(t, 0.04, 0.46)) * 1.03, t * 7 + 1, r.vurgu);
          sekil(enBuyuk * ease.out(ara(t, 0.08, 0.48)), t * 6 + 2, r.zemin);
          // Sıçrama damlaları
          const rnd = tohum(7);
          for (let i = 0; i < 14; i++) {
            const a = rnd() * Math.PI * 2;
            const d = enBuyuk * (0.3 + rnd() * 0.9) * buyu;
            const rad = (8 + rnd() * 26) * (1 - ara(t, 0.3, 0.5));
            if (rad <= 0) continue;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rad, 0, Math.PI * 2);
            ctx.fillStyle = i % 2 ? r.vurgu : r.ikinci;
            ctx.fill();
          }
        } else {
          ctx.fillStyle = r.zemin;
          ctx.fillRect(0, 0, W, H);
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          sekil(enBuyuk * 1.12 * ease.inOut(ara(t, 0.52, 0.98)), t * 8, '#000');
          ctx.restore();
          // Açılan deliğin kenarında renkli halka
          const k = ease.inOut(ara(t, 0.52, 0.98));
          if (k > 0 && k < 1) {
            ctx.save();
            ctx.lineWidth = 14 * (1 - k) + 4;
            ctx.strokeStyle = r.vurgu;
            ctx.shadowColor = r.vurgu;
            ctx.shadowBlur = 24;
            ctx.beginPath();
            for (let i = 0; i <= 128; i++) {
              const a = (i / 128) * Math.PI * 2;
              const R = enBuyuk * 1.12 * k;
              const rr = R * (1 + 0.1 * Math.sin(5 * a + t * 8) + 0.05 * Math.sin(11 * a - t * 8 * 1.7) + 0.03 * Math.sin(17 * a + 2));
              const x = cx + Math.cos(a) * rr;
              const y = cy + Math.sin(a) * rr;
              i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    },
    {
      id: 'panjur',
      ad: 'Panjur',
      aciklama: 'Dikey paneller sırayla iner, sahne değişince yukarı katlanır.',
      sure: 1200,
      nokta: 0.5,
      ciz(ctx, t, W, H, r) {
        const n = 8;
        const w = W / n;
        for (let i = 0; i < n; i++) {
          const g = i * 0.025;
          const iner = ease.outBack(ara(t, g, 0.27 + g));
          const kalk = ease.in(ara(t, 0.56 + g * 0.9, 0.82 + g * 0.9));
          const y0 = -H + iner * H - kalk * H * 1.05;
          const x = Math.floor(i * w);
          const gen = Math.ceil(w) + 1;
          ctx.fillStyle = r.zemin;
          // Üstten taşma payı: inişteki esneme (outBack) tepede boşluk bırakmasın
          ctx.fillRect(x, y0 - 120, gen, H + 120);
          const cizgi = ctx.createLinearGradient(0, y0 + H - 10, 0, y0 + H);
          cizgi.addColorStop(0, i % 2 ? r.vurgu : r.ikinci);
          cizgi.addColorStop(1, r.parlak);
          ctx.fillStyle = cizgi;
          ctx.fillRect(x, y0 + H - 10, gen, 10);
          ctx.fillStyle = 'rgba(255,255,255,.06)';
          ctx.fillRect(x, y0, 2, H);
        }
      }
    },
    {
      id: 'isik-hizi',
      ad: 'Işık hızı',
      aciklama: 'Ortadan dışa fırlayan ışık çizgileri hızlanır, parlamayla sahne değişir.',
      sure: 1100,
      nokta: 0.5,
      ciz(ctx, t, W, H, r) {
        const cx = W / 2;
        const cy = H / 2;
        const rnd = tohum(42);
        const hiz = ease.in(ara(t, 0, 0.5)) * (1 - ease.out(ara(t, 0.5, 1)) * 0.6) + 0.05;
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < 110; i++) {
          const a = rnd() * Math.PI * 2;
          const baslangic = rnd();
          const renk = i % 3 === 0 ? r.vurgu : i % 3 === 1 ? r.ikinci : r.parlak;
          const d0 = ((baslangic + t * (1.4 + rnd())) % 1) * Math.hypot(W, H) * 0.6;
          const uz = 40 + hiz * 900 * (0.5 + rnd());
          ctx.strokeStyle = renk;
          ctx.globalAlpha = 0.25 + 0.75 * kis(d0 / 300);
          ctx.lineWidth = 3 + rnd() * 5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0);
          ctx.lineTo(cx + Math.cos(a) * (d0 + uz), cy + Math.sin(a) * (d0 + uz));
          ctx.stroke();
        }
        ctx.restore();
        // Parlama: ortada tam örtü, iki yana söner
        const parla = 1 - Math.min(1, Math.abs(t - 0.5) / 0.14);
        if (parla > 0) {
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * 0.6);
          g.addColorStop(0, r.parlak);
          g.addColorStop(0.35, r.vurgu);
          g.addColorStop(1, r.zemin);
          ctx.globalAlpha = Math.min(1, parla * 1.6);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      }
    },
    {
      id: 'glitch',
      ad: 'Glitch',
      aciklama: 'Kayan dijital bloklar ve renk sapmasıyla bozulup sahne değişir.',
      sure: 1000,
      nokta: 0.5,
      ciz(ctx, t, W, H, r) {
        const yogun = t < 0.5 ? ease.in(ara(t, 0, 0.42)) : 1 - ease.out(ara(t, 0.58, 1));
        const kare = Math.floor(t * 60);
        const rnd = tohum(1000 + kare * 13);
        if (t >= 0.42 && t <= 0.58) {
          ctx.fillStyle = r.zemin;
          ctx.fillRect(0, 0, W, H);
        }
        const adet = Math.floor(10 + yogun * 70);
        for (let i = 0; i < adet; i++) {
          const y = Math.floor(rnd() * H);
          const h = 6 + rnd() * 90 * (0.4 + yogun);
          const x = (rnd() - 0.3) * W;
          const w = W * (0.15 + rnd() * 0.9) * (0.4 + yogun);
          const kay = (rnd() - 0.5) * 60 * yogun;
          if (rnd() < yogun * 0.9) {
            ctx.fillStyle = r.zemin;
            ctx.fillRect(x, y, w, h);
          }
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = r.vurgu;
          ctx.fillRect(x + kay, y, w * 0.98, Math.max(2, h * 0.12));
          ctx.fillStyle = r.ikinci;
          ctx.fillRect(x - kay, y + h * 0.88, w * 0.9, Math.max(2, h * 0.12));
          ctx.globalAlpha = 1;
        }
        // Tarama çizgileri
        if (yogun > 0.3) {
          ctx.fillStyle = `rgba(255,255,255,${0.05 * yogun})`;
          for (let y = (kare * 3) % 6; y < H; y += 6) ctx.fillRect(0, y, W, 1);
        }
      }
    },
    {
      id: 'iris',
      ad: 'İris',
      aciklama: 'Halkalar kenardan içe kapanır, sahne değişince ortadan genişleyerek açılır.',
      sure: 1200,
      nokta: 0.5,
      ciz(ctx, t, W, H, r) {
        const cx = W / 2;
        const cy = H / 2;
        const R = Math.hypot(W, H) / 2 + 30;
        ctx.fillStyle = r.zemin;
        ctx.fillRect(0, 0, W, H);
        const delik = t < 0.5 ? R * (1 - ease.inOut(ara(t, 0, 0.46))) : R * ease.inOut(ara(t, 0.54, 1));
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, delik), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (delik > 2 && delik < R) {
          const halkalar = [
            { renk: r.vurgu, k: 1, w: 10 },
            { renk: r.ikinci, k: 1.06, w: 6 },
            { renk: r.parlak, k: 1.12, w: 2 }
          ];
          ctx.save();
          ctx.shadowBlur = 20;
          for (const h of halkalar) {
            ctx.shadowColor = h.renk;
            ctx.strokeStyle = h.renk;
            ctx.lineWidth = h.w;
            ctx.beginPath();
            ctx.arc(cx, cy, delik * h.k + h.w, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    },
    {
      id: 'serit',
      ad: 'Şeritler',
      aciklama: 'Üç yatay şerit karşı yönlerden kayarak birleşir, sonra ayrılır.',
      sure: 1150,
      nokta: 0.5,
      ciz(ctx, t, W, H, r) {
        const satir = 3;
        const h = H / satir;
        const renkler = [r.zemin, r.zemin, r.zemin];
        for (let i = 0; i < satir; i++) {
          const yon = i % 2 ? -1 : 1;
          const g = i * 0.04;
          const giris = ease.out(ara(t, g, 0.4 + g));
          const cikis = ease.in(ara(t, 0.58 + g * 0.6, 0.94 + g * 0.6));
          const uc = h * 0.6;
          const x = yon > 0 ? -W - uc + giris * (W + uc) + cikis * (W + uc * 2) : W + uc - giris * (W + uc) - cikis * (W + uc * 2);
          const y = Math.floor(i * h);
          const hh = Math.ceil(h) + 1;
          ctx.fillStyle = renkler[i];
          ctx.beginPath();
          if (yon > 0) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + W, y);
            ctx.lineTo(x + W + uc, y + hh);
            ctx.lineTo(x, y + hh);
          } else {
            ctx.moveTo(x - uc, y);
            ctx.lineTo(x + W, y);
            ctx.lineTo(x + W, y + hh);
            ctx.lineTo(x, y + hh);
          }
          ctx.closePath();
          ctx.fill();
          // Önden giden renkli kenar
          ctx.save();
          ctx.strokeStyle = i === 1 ? r.ikinci : r.vurgu;
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 18;
          ctx.lineWidth = 7;
          ctx.beginPath();
          if (yon > 0) {
            ctx.moveTo(x + W, y);
            ctx.lineTo(x + W + uc, y + hh);
          } else {
            ctx.moveTo(x - uc, y);
            ctx.lineTo(x, y + hh);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
    },
    {
      id: 'dalga',
      ad: 'Sıvı dalga',
      aciklama: 'Dalgalı bir sıvı aşağıdan yükselip ekranı doldurur, yukarı akıp gider.',
      sure: 1400,
      nokta: 0.5,
      ciz(ctx, t, W, H, r) {
        const katman = (seviye, genlik, faz, renk, ust) => {
          ctx.beginPath();
          const y0 = (x) => seviye + Math.sin(x / W * Math.PI * 3 + faz) * genlik + Math.sin(x / W * Math.PI * 7 - faz * 1.3) * genlik * 0.35;
          if (ust) {
            ctx.moveTo(0, 0);
            ctx.lineTo(W, 0);
            for (let x = W; x >= 0; x -= 16) ctx.lineTo(x, y0(x));
          } else {
            ctx.moveTo(0, H);
            ctx.lineTo(W, H);
            for (let x = W; x >= 0; x -= 16) ctx.lineTo(x, y0(x));
          }
          ctx.closePath();
          ctx.fillStyle = renk;
          ctx.fill();
        };
        const g = 60;
        if (t < 0.5) {
          const k = ease.inOut(ara(t, 0, 0.46));
          katman(H + g - k * (H + g * 3) + 50, g, t * 14, r.ikinci, false);
          katman(H + g - k * (H + g * 3) + 25, g * 0.9, t * 12 + 1.5, r.vurgu, false);
          katman(H + g - k * (H + g * 3), g * 0.8, t * 10 + 3, r.zemin, false);
        } else {
          const k = ease.inOut(ara(t, 0.54, 1));
          // Sıvı yukarı akar: alt yüzeyi dalgalı; renkli kenarlar zeminin hemen altında önden gider
          const seviye = H + g - k * (H + g * 3);
          katman(seviye + 50, g, t * 14, r.ikinci, true);
          katman(seviye + 25, g * 0.9, t * 12 + 1.5, r.vurgu, true);
          katman(seviye, g * 0.8, t * 10 + 3, r.zemin, true);
        }
      }
    },
    {
      id: 'piksel',
      ad: 'Piksel çözülme',
      aciklama: 'Kareler köşeden köşeye çapraz dalgayla belirir, sonra aynı yönde çözülür.',
      sure: 1200,
      nokta: 0.5,
      ciz(ctx, t, W, H, r) {
        const boy = 80;
        const sutun = Math.ceil(W / boy);
        const satir = Math.ceil(H / boy);
        const rnd = tohum(9);
        const enCok = sutun + satir;
        for (let j = 0; j < satir; j++) {
          for (let i = 0; i < sutun; i++) {
            const sira = (i + j) / enCok;
            const oynama = rnd() * 0.08;
            const gir = ease.outBack(ara(t, sira * 0.32 + oynama, sira * 0.32 + oynama + 0.14));
            const cik = ease.in(ara(t, 0.54 + sira * 0.32 + oynama, 0.54 + sira * 0.32 + oynama + 0.12));
            const olcek = Math.max(0, Math.min(1.08, gir) - cik);
            if (olcek <= 0) continue;
            const s = boy * Math.min(1, olcek) + (olcek >= 1 ? 1 : 0);
            const x = i * boy + (boy - s) / 2;
            const y = j * boy + (boy - s) / 2;
            ctx.fillStyle = (i * 7 + j * 3) % 11 === 0 ? r.vurgu : (i * 5 + j) % 13 === 0 ? r.ikinci : r.zemin;
            ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(s) + 1, Math.ceil(s) + 1);
          }
        }
      }
    }
  ];

  kok.STINGERLER = STINGERLER;
  kok.STINGER_RENK = VARSAYILAN_RENK;
})(typeof window !== 'undefined' ? window : globalThis);
