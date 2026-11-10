/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // `white` artık temaya bağlı: 450 yerde `text-white` yazılıydı ve skin
        // değişince yazı rengi değişmiyordu. Bu tek satır, `text-white/70`
        // gibi alfalı varyantlar dahil hepsini `--fg-rgb`'ye bağlar; kaynak
        // dosyalarda düzenleme gerekmiyor. Tema dışı kalması gereken sabit
        // beyaz (anahtar topuzu, koyu editör zemini) için `pure-white`.
        white: "rgb(var(--fg-rgb, 255 255 255) / <alpha-value>)",
        "pure-white": "#ffffff",
        // AxthrowA marka renkleri (sol menü, önizleme tuvali). Vurgu yalnız menekşe ve camgöbeği.
        axthrowa: {
          violet: "#8B5CF6",
          cyan: "#06B6D4",
          dark: "#09090B",
          // Zeminden belirgin ayrılsın (zinc-900 / #18181B zemine çok yakındı, derinlik kayboluyordu)
          card: "#1C1C21",
        },
        teal: {
          50: "#e9fdff",
          100: "#cdfaff",
          200: "#a4f7ff",
          300: "#75f2ff",
          // 400 = metin vurgusu, 500 = dolgu vurgusu. Ayrı çünkü açık temada
          // metin koyu, dolgu ise parlak kalmalı.
          400: "rgb(var(--accent-text-rgb, 62 237 254) / <alpha-value>)",
          500: "rgb(var(--accent-rgb, 62 237 254) / <alpha-value>)",
          600: "#25cbd9",
          700: "#1da2ae",
          800: "#197f88",
          900: "#176a72",
          950: "#083f46",
        },
        // Üst şerit (Stüdyo Masası) token'ları; kanal üçlüsü: `bg-ui-accent/15`
        ui: Object.fromEntries(
          ["bg", "s1", "s2", "s3", "line", "line2", "fg", "fg2", "fg3", "accent", "accent-text", "accent-ink",
            "brand", "live", "live-ink", "rec", "ok", "warn", "err", "danger"].map((k) => [
            k,
            `rgb(var(--ui-${k}) / <alpha-value>)`,
          ])
        ),
        panel: {
          bg: "var(--panel-bg)",
          card: "var(--panel-card)",
          elevated: "var(--panel-elevated)",
          border: "var(--panel-border)",
          // Saydamlık eki (`bg-panel-accent/85`, `border-panel-accent/60` …) ancak
          // renk `<alpha-value>` ile tanımlıysa çalışır. Düz `var(--panel-accent)`
          // iken Tailwind bu sınıflar için HİÇ kural üretmiyordu: vurgulu düğmeler
          // zeminsiz kalıp koyu yazıyla okunmaz oluyor, kenarlıklar kayboluyordu.
          // `--accent-rgb` her skin'de tanımlı (tema sözleşmesi testi bunu korur).
          accent: "rgb(var(--accent-rgb) / <alpha-value>)",
          "accent-strong": "var(--panel-accent-strong)",
          cta: "var(--panel-cta)",
          muted: "var(--panel-muted)",
          soft: "var(--panel-soft)",
        },
      },
      // Plus Jakarta Sans 800'e, Inter 900'e kadar var. Tailwind'in `font-black`i
      // 900 ister; gövde yazısında bu ağırlık yoksa tarayıcı "sahte kalın" üretir
      // (glifleri kalınlaştırarak bulanıklaştırır). 800'e sabitliyoruz.
      fontWeight: {
        black: "800",
      },
      fontFamily: {
        sans: ['Inter', "Segoe UI", "system-ui", "sans-serif"],
        display: ['Inter', "Segoe UI", "system-ui", "sans-serif"],
        pixel: ['"Press Start 2P"', "monospace"],
        mono: ['"JetBrains Mono"', "ui-monospace", "Consolas", "monospace"],
        terminal: ['"JetBrains Mono"', "ui-monospace", "Consolas", "monospace"],
        futuristic: ['"Orbitron"', "sans-serif"],
        // DİKKAT: buraya `bold` anahtarı KOYMAYIN. Tailwind ondan `.font-bold`
        // üretiyordu ve bu, kalınlık yardımcısı `.font-bold` ile aynı ada sahip.
        // İkisi farklı özellik yazdığı için birlikte uygulanıyor, sonuçta
        // "kalın" yazan her yer (131 yer) Bebas Neue'ye dönüyordu: yalnız 400
        // ağırlığı olan dar bir başlık yazı tipi, üstüne sahte kalınlaştırma —
        // yazılar bulanık/ezik görünüyordu. Bebas'ı isteyen yerler kendi
        // yığınını yazıyor (src/lib/textStyles.ts, styles/overlay.css).
      },
      fontSize: {
        "ui-1": ["var(--fs-1)", { lineHeight: "16px" }],
        "ui-2": ["var(--fs-2)", { lineHeight: "16px" }],
        "ui-3": ["var(--fs-3)", { lineHeight: "18px" }],
        "ui-4": ["var(--fs-4)", { lineHeight: "20px" }],
        "ui-5": ["var(--fs-5)", { lineHeight: "26px" }],
        "ui-6": ["var(--fs-6)", { lineHeight: "32px" }],
      },
      spacing: {
        ctl: "var(--ctl)",
        row: "var(--row)",
        pad: "var(--pad)",
        hit: "var(--hit)",
      },
      borderRadius: {
        "ui-1": "var(--r-1)",
        "ui-2": "var(--r-2)",
      },
      zIndex: {
        "ui-sticky": "var(--z-sticky)",
        "ui-header": "var(--z-header)",
        "ui-rail": "var(--z-rail)",
        "ui-modal": "var(--z-modal)",
        "ui-popover": "var(--z-popover)",
        "ui-toast": "var(--z-toast)",
      },
      transitionDuration: {
        ui: "var(--ui-dur)",
      },
      transitionTimingFunction: {
        ui: "var(--ui-ease)",
      },
      boxShadow: {
        "ui-float": "var(--ui-shadow-float)",
        panel: "0 8px 24px rgba(0,0,0,.28)",
        glow: "0 0 18px var(--panel-accent-glow)",
        "glow-sm": "0 0 10px var(--panel-accent-glow)",
        "glow-lg": "0 0 30px var(--panel-accent-glow)",
        glass: "0 4px 20px -2px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        "glass-elevated": "0 8px 32px -4px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        // AxthrowA: havada asılı (ipucu, sağ tık menüsü) ve marka parlaması
        "glow-cyan": "0 8px 24px -6px rgba(0, 0, 0, 0.55), 0 0 18px rgba(6, 182, 212, 0.18)",
        float: "0 12px 40px -8px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.3)",
      },
      backgroundImage: {
        "panel-atmosphere":
          "radial-gradient(ellipse 80% 50% at 10% -10%, var(--panel-glow-a), transparent 55%), radial-gradient(ellipse 60% 40% at 95% 110%, var(--panel-glow-b), transparent 50%), linear-gradient(180deg, var(--panel-bg) 0%, var(--panel-bg-deep) 100%)",
      },
      keyframes: {
        "nav-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "none" },
        },
        "card-rise": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        // Pencere / ipucu: soluk + hafif büyüme (çıkışta tersi)
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "zoom-in": { from: { opacity: "0", transform: "scale(.95)" }, to: { opacity: "1", transform: "none" } },
        "zoom-out": { from: { opacity: "1", transform: "none" }, to: { opacity: "0", transform: "scale(.95)" } },
        // Menü simgesi tıklanınca yaylanarak zıplar
        yay: { "0%": { transform: "scale(.7)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "nav-in": "nav-in .35s ease both",
        "card-rise": "card-rise .4s ease both",
        "fade-in": "fade-in .2s ease-out both",
        "fade-out": "fade-out .2s ease-in both",
        "zoom-in": "zoom-in .2s cubic-bezier(.22,1,.36,1) both",
        "zoom-out": "zoom-out .2s ease-in both",
        yay: "yay .45s cubic-bezier(0.34,1.56,0.64,1) both",
      },
    },
  },
  plugins: [],
};
