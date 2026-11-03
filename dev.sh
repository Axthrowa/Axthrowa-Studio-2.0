#!/usr/bin/env bash
# AxthrowA geliştirme ortamı (Linux/macOS): masaüstü uygulaması (Tauri), tanıtım sitesi (Next.js) ve kılavuz
# (Docusaurus) tek terminalde, renkli öneklerle. Ctrl+C hepsini kapatır.
#
#   ./dev.sh               # üçü birden
#   ./dev.sh --tauri-yok   # yalnız site + kılavuz
#
# Site ve kılavuz bu klasörün yanında aranır (../axthrowa-site, ../axthrowa-docs); başka yerdeyse
# AXTHROWA_SITE / AXTHROWA_DOCS ortam değişkenleriyle verin.
#
# Adresler: uygulama paneli http://127.0.0.1:8843 · site http://localhost:3100 · kılavuz http://localhost:3200
set -euo pipefail

kok="$(cd "$(dirname "$0")" && pwd)"
site="${AXTHROWA_SITE:-$kok/../axthrowa-site}"
docs="${AXTHROWA_DOCS:-$kok/../axthrowa-docs}"

adlar=(); renkler=(); komutlar=()

if [[ "${1:-}" != "--tauri-yok" ]]; then
  # Kurulu uygulama açıksa 8843 doludur ve tek-örnek kilidi ikinci kopyayı kapatır: Tauri'yi başlatma
  if (exec 3<>/dev/tcp/127.0.0.1/8843) 2>/dev/null; then
    echo "UYARI: 8843 portu kullanımda (kurulu AxthrowA Studio açık). Tauri atlandı." >&2
  else
    adlar+=(tauri); renkler+=(magenta); komutlar+=("npm run tauri:dev")
  fi
fi

ekle() { # ad yol renk komut
  if [[ ! -f "$2/package.json" ]]; then
    echo "UYARI: $1 bulunamadı: $2 — atlandı" >&2
    return
  fi
  if [[ ! -d "$2/node_modules" ]]; then
    echo "[$1] bağımlılıklar kuruluyor..."
    npm --prefix "$2" install
  fi
  adlar+=("$1"); renkler+=("$3"); komutlar+=("npm --prefix \"$2\" $4")
}
ekle site "$site" cyan "run dev -- --port 3100"
ekle docs "$docs" blue "run start -- --port 3200 --no-open"

if [[ ${#komutlar[@]} -eq 0 ]]; then
  echo "Başlatılacak bir şey yok." >&2
  exit 1
fi

cd "$kok"
birlestir() { local IFS=,; echo "$*"; }
# concurrently: her satırın başına renkli [ad] öneki; biri çökerse diğerleri çalışmaya devam eder
exec npx --no-install concurrently --names "$(birlestir "${adlar[@]}")" --prefix-colors "$(birlestir "${renkler[@]}")" \
  --prefix "[{name}]" "${komutlar[@]}"
