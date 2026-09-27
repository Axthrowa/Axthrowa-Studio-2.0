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
      boxShadow: {
        panel: "0 8px 24px rgba(0,0,0,.28)",
        glow: "0 0 18px var(--panel-accent-glow)",
        "glow-sm": "0 0 10px var(--panel-accent-glow)",
        "glow-lg": "0 0 30px var(--panel-accent-glow)",
        glass: "0 4px 20px -2px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        "glass-elevated": "0 8px 32px -4px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
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
      },
      animation: {
        "nav-in": "nav-in .35s ease both",
        "card-rise": "card-rise .4s ease both",
      },
    },
  },
  plugins: [],
};
