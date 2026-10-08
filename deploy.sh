#!/bin/bash
# ============================================================
#  deploy.sh — Alur kerja aman dev & prod
#  Repo: griya-aleena-sekaran (dev) & griya-aleena (prod)
# ============================================================

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Pastikan dijalankan dari folder repo
if [ ! -d ".git" ]; then
  echo -e "${RED}❌ Error: bukan folder git.${NC}"
  echo "Jalankan dari: ~/Documents/griya-aleena-website/griya-aleena-sekaran"
  exit 1
fi

# Cek remote
if ! git remote | grep -q "^origin$" || ! git remote | grep -q "^prod$"; then
  echo -e "${RED}❌ Error: remote 'origin' atau 'prod' tidak ditemukan.${NC}"
  echo "Remote saat ini:"
  git remote -v
  exit 1
fi

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}   🚀  DEPLOY GRIYA ALEENA${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""
echo "  origin → dev  (staging)"
echo "  prod   → live (production)"
echo ""
echo -e "${BLUE}────────────────────────────────────────────${NC}"

# ─────────────────────────────────────────────
# Fungsi: pull dari dev
# ─────────────────────────────────────────────
pull_dev() {
  echo -e "${YELLOW}📥 Tarik update dari dev (origin/main)...${NC}"
  git checkout main || exit 1
  git pull origin main || { echo -e "${RED}❌ Gagal pull. Cek konflik.${NC}"; exit 1; }
  echo -e "${GREEN}✅ Sinkron dengan dev.${NC}"
  echo ""
}

# ─────────────────────────────────────────────
# Fungsi: push ke dev
# ─────────────────────────────────────────────
push_dev() {
  echo ""
  echo -e "${BLUE}📋 Status perubahan:${NC}"
  git status --short
  echo ""

  if [ -z "$(git status --porcelain)" ] && \
     [ -z "$(git log origin/main..main --oneline 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  Tidak ada perubahan untuk di-push ke dev.${NC}"
    return
  fi

  # Stage semua
  echo -e "${YELLOW}📦 Stage semua perubahan...${NC}"
  git add -A

  # Minta pesan commit
  read -p "📝 Pesan commit (kosongkan untuk batal): " msg
  if [ -z "$msg" ]; then
    echo -e "${YELLOW}⏸️  Dibatalkan.${NC}"
    git reset
    return
  fi

  git commit -m "$msg" || { echo -e "${RED}❌ Commit gagal.${NC}"; return; }

  echo -e "${YELLOW}⬆️  Push ke dev (origin/main)...${NC}"
  git push origin main || { echo -e "${RED}❌ Push gagal.${NC}"; return; }

  echo -e "${GREEN}✅ Berhasil push ke DEV.${NC}"
  echo ""
  echo -e "${BLUE}🔗 Tes di:${NC}"
  echo "   https://lintangglangitt.github.io/griya-aleena-sekaran"
  echo ""
}

# ─────────────────────────────────────────────
# Fungsi: push ke prod (dengan konfirmasi)
# ─────────────────────────────────────────────
push_prod() {
  echo ""
  echo -e "${RED}⚠️  PERINGATAN: Ini akan push ke PRODUCTION (live)!${NC}"
  echo -e "${RED}   URL: https://lintangglangitt.github.io/griya-aleena${NC}"
  echo ""

  # Tampilkan commit yang akan dikirim
  echo -e "${BLUE}📋 Commit yang akan dikirim ke prod:${NC}"
  git log prod/main..main --oneline 2>/dev/null || echo "   (tidak bisa dibandingkan, mungkin belum pernah pull prod)"
  echo ""

  # Konfirmasi
  read -p "❓ Sudah tes di dev & yakin mau ke PROD? (ketik 'YA'): " konfirmasi
  if [ "$konfirmasi" != "YA" ]; then
    echo -e "${YELLOW}⏸️  Dibatalkan. Tidak ada yang di-push ke prod.${NC}"
    return
  fi

  echo -e "${YELLOW}⬆️  Push ke prod (production)...${NC}"
  git push prod main || { echo -e "${RED}❌ Push ke prod gagal.${NC}"; return; }

  echo -e "${GREEN}✅ Berhasil push ke PROD.${NC}"
  echo ""
  echo -e "${BLUE}🔗 Tes di:${NC}"
  echo "   https://lintangglangitt.github.io/griya-aleena"
  echo ""
}

# ─────────────────────────────────────────────
# Fungsi: tarik dari dev (untuk edit di GitHub)
# ─────────────────────────────────────────────
sync_only() {
  pull_dev
  echo -e "${GREEN}✅ Lokal sudah sinkron dengan dev.${NC}"
  echo "   Kalau sudah OK, jalankan lagi & pilih menu [3] untuk push ke prod."
  echo ""
}

# ─────────────────────────────────────────────
# Fungsi: status
# ─────────────────────────────────────────────
show_status() {
  echo ""
  echo -e "${BLUE}📊 STATUS REPO${NC}"
  echo "────────────────────────────────────────────"
  echo -e "${YELLOW}Branch:${NC} $(git branch --show-current)"
  echo ""
  echo -e "${YELLOW}Remote:${NC}"
  git remote -v | sed 's/^/   /'
  echo ""
  echo -e "${YELLOW}Perubahan belum di-commit:${NC}"
  git status --short | sed 's/^/   /' || echo "   (bersih)"
  echo ""
  echo -e "${YELLOW}Commit lokal belum di-push ke dev:${NC}"
  git log origin/main..main --oneline 2>/dev/null | sed 's/^/   /' || echo "   (tidak ada)"
  echo ""
  echo -e "${YELLOW}Commit lokal belum di-push ke prod:${NC}"
  git log prod/main..main --oneline 2>/dev/null | sed 's/^/   /' || echo "   (tidak ada)"
  echo ""
  echo "────────────────────────────────────────────"
  echo ""
}

# ─────────────────────────────────────────────
# Menu utama
# ─────────────────────────────────────────────
while true; do
  echo -e "${BLUE}Pilih aksi:${NC}"
  echo "  [1] 📥 Tarik update dari dev (edit di GitHub → lokal)"
  echo "  [2] 📦 Commit lokal & push ke DEV"
  echo "  [3] 🚀 Push ke PROD (setelah tes di dev OK)"
  echo "  [4] 📊 Lihat status"
  echo "  [5] ❌ Keluar"
  echo ""
  read -p "Pilihan [1-5]: " pilihan
  echo ""

  case $pilihan in
    1) pull_dev ;;
    2) push_dev ;;
    3) push_prod ;;
    4) show_status ;;
    5) echo -e "${GREEN}👋 Selesai.${NC}"; exit 0 ;;
    *) echo -e "${RED}❌ Pilihan tidak valid.${NC}" ;;
  esac

  echo ""
  read -p "Tekan Enter untuk kembali ke menu..." _
  clear
done
