#!/bin/bash
# ============================================================
#  deploy.sh — Alur kerja aman dev & prod (v4)
#  Repo: griya-aleena-sekaran (dev) & griya-aleena (prod)
# ============================================================

# Warna
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Pastikan di folder repo
if [ ! -d ".git" ]; then
  echo -e "${RED}❌ Error: bukan folder git.${NC}"
  echo "Jalankan dari: ~/Documents/griya-aleena-website/griya-aleena-sekaran"
  exit 1
fi

# Cek remote
if ! git remote | grep -q "^origin$" || ! git remote | grep -q "^prod$"; then
  echo -e "${RED}❌ Error: remote 'origin' atau 'prod' tidak ditemukan.${NC}"
  git remote -v
  exit 1
fi

# Pastikan pull pakai merge
git config pull.rebase false > /dev/null 2>&1

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}   🚀  DEPLOY GRIYA ALEENA${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""
echo "  origin → dev  (staging)"
echo "  prod   → live (production)"
echo ""
echo -e "${BLUE}────────────────────────────────────────────${NC}"

# ─────────────────────────────────────────────
# Fungsi: cek status
# ─────────────────────────────────────────────
show_status() {
  echo ""
  echo -e "${YELLOW}📡 Mengambil info terbaru dari remote...${NC}"
  git fetch --all --quiet 2>/dev/null
  echo -e "${GREEN}✅ Info remote diperbarui.${NC}"
  echo ""

  echo -e "${BLUE}📊 STATUS REPO${NC}"
  echo "────────────────────────────────────────────"
  echo -e "${YELLOW}Branch:${NC} $(git branch --show-current)"
  echo ""
  echo -e "${YELLOW}Remote:${NC}"
  git remote -v | sed 's/^/   /'
  echo ""

  echo -e "${YELLOW}Perubahan lokal belum di-commit:${NC}"
  local lokal_changes=$(git status --short)
  if [ -z "$lokal_changes" ]; then
    echo "   (tidak ada)"
  else
    echo "$lokal_changes" | sed 's/^/   /'
  fi
  echo ""

  echo -e "${YELLOW}Commit lokal belum di-push ke dev:${NC}"
  local to_dev=$(git log origin/main..main --oneline 2>/dev/null)
  if [ -z "$to_dev" ]; then
    echo "   (tidak ada)"
  else
    echo "$to_dev" | sed 's/^/   /'
  fi
  echo ""

  echo -e "${YELLOW}Commit lokal belum di-push ke prod:${NC}"
  local to_prod=$(git log prod/main..main --oneline 2>/dev/null)
  if [ -z "$to_prod" ]; then
    echo "   (tidak ada)"
  else
    echo "$to_prod" | sed 's/^/   /'
  fi
  echo ""

  echo -e "${YELLOW}Commit prod belum ada di lokal:${NC}"
  local from_prod=$(git log main..prod/main --oneline 2>/dev/null)
  if [ -z "$from_prod" ]; then
    echo "   (tidak ada)"
  else
    echo "$from_prod" | sed 's/^/   /'
  fi
  echo ""

  echo -e "${YELLOW}Commit dev belum ada di lokal:${NC}"
  local from_dev=$(git log main..origin/main --oneline 2>/dev/null)
  if [ -z "$from_dev" ]; then
    echo "   (tidak ada)"
  else
    echo "$from_dev" | sed 's/^/   /'
  fi
  echo ""

  echo "────────────────────────────────────────────"
  echo ""
}

# ─────────────────────────────────────────────
# Fungsi: pull dari dev
# ─────────────────────────────────────────────
pull_dev() {
  echo -e "${YELLOW}📥 Tarik update dari dev (origin/main)...${NC}"
  git checkout main 2>/dev/null || { echo -e "${RED}❌ Gagal checkout main.${NC}"; return 1; }
  if git pull origin main; then
    echo -e "${GREEN}✅ Sinkron dengan dev.${NC}"
  else
    echo -e "${RED}❌ Gagal pull dari dev. Cek konflik.${NC}"
    return 1
  fi
  echo ""
}

# ─────────────────────────────────────────────
# Fungsi: commit lokal saja (TANPA push)
# ─────────────────────────────────────────────
commit_local() {
  echo ""
  echo -e "${BLUE}📋 Status perubahan:${NC}"
  git status --short
  echo ""

  if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Tidak ada perubahan untuk di-commit.${NC}"
    echo -e "${YELLOW}   (mungkin kamu hanya perlu push — pakai menu [4])${NC}"
    return
  fi

  echo -e "${YELLOW}📦 Stage semua perubahan...${NC}"
  git add -A

  read -p "📝 Yakin mau ke commit? (ketik 'ya' atau kosongkan untuk batal): " msg
  if [ -z "$msg" ]; then
    echo -e "${YELLOW}⏸️  Dibatalkan.${NC}"
    git reset > /dev/null
    return
  fi

  if git commit -m "$msg"; then
    echo -e "${GREEN}✅ Commit berhasil.${NC}"
    echo ""
    echo -e "${BLUE}ℹ️  Langkah berikutnya:${NC}"
    echo "   - Push ke dev: jalankan menu [4]"
    echo "   - Atau cek status: menu [1]"
    echo ""
  else
    echo -e "${RED}❌ Commit gagal.${NC}"
  fi
}

# ─────────────────────────────────────────────
# Fungsi: push ke dev saja (TANPA commit)
# ─────────────────────────────────────────────
push_dev() {
  echo ""
  local to_dev=$(git log origin/main..main --oneline 2>/dev/null)
  if [ -z "$to_dev" ]; then
    echo -e "${YELLOW}⚠️  Tidak ada commit untuk di-push ke dev.${NC}"
    echo -e "${YELLOW}   (mungkin belum commit — pakai menu [3])${NC}"
    return
  fi

  echo -e "${BLUE}📋 Commit yang akan di-push ke dev:${NC}"
  echo "$to_dev" | sed 's/^/   /'
  echo ""

  echo -e "${YELLOW}⬆️  Push ke dev (origin/main)...${NC}"
  if git push origin main; then
    echo -e "${GREEN}✅ Berhasil push ke DEV.${NC}"
    echo ""
    echo -e "${BLUE}🔗 Tes di:${NC}"
    echo "   https://lintangglangitt.github.io/griya-aleena-sekaran"
    echo ""
  else
    echo -e "${RED}❌ Push ke dev gagal.${NC}"
    echo -e "${YELLOW}   Kemungkinan dev punya commit baru yang belum di lokal.${NC}"
    echo -e "${YELLOW}   Coba: menu [2] (tarik dari dev) → lalu menu [4] lagi.${NC}"
    echo ""
  fi
}

# ─────────────────────────────────────────────
# Fungsi: push ke prod (dengan pull otomatis)
# ─────────────────────────────────────────────
push_prod() {
  echo ""
  echo -e "${RED}⚠️  PERINGATAN: Ini akan push ke PRODUCTION (live)!${NC}"
  echo -e "${RED}   URL: https://lintangglangitt.github.io/griya-aleena${NC}"
  echo ""

  # STEP 1: Pull dari prod dulu
  echo -e "${BLUE}🔄 Langkah 1/3: Sinkron dengan prod...${NC}"
  if ! git pull prod main; then
    echo ""
    echo -e "${RED}❌ Gagal sinkron dengan prod. Proses dihentikan.${NC}"
    echo -e "${YELLOW}Selesaikan konflik dulu, lalu jalankan ulang.${NC}"
    return 1
  fi
  echo ""

  # STEP 2: Cek commit yang akan dikirim
  echo -e "${BLUE}🔄 Langkah 2/3: Cek commit yang akan dikirim...${NC}"
  local commits=$(git log prod/main..main --oneline 2>/dev/null)
  if [ -z "$commits" ]; then
    echo -e "${YELLOW}⚠️  Tidak ada commit baru untuk dikirim ke prod.${NC}"
    echo "   Dev dan prod sudah sinkron, atau lokal ketinggalan."
    echo ""
    echo -e "${YELLOW}   Kemungkinan:${NC}"
    echo "   - Kamu lupa tarik dari dev dulu → jalankan menu [2]"
    echo "   - Commit sudah ada di prod"
    return 0
  fi

  echo "$commits" | sed 's/^/   /'
  echo ""

  # STEP 3: Konfirmasi & push
  echo -e "${BLUE}🔄 Langkah 3/3: Konfirmasi & push${NC}"
  read -p "❓ Sudah tes di dev & yakin mau ke PROD? (ketik 'ya'): " konfirmasi
  if [ "$konfirmasi" != "ya" ]; then
    echo -e "${YELLOW}⏸️  Dibatalkan. Tidak ada yang di-push ke prod.${NC}"
    return
  fi

  echo -e "${YELLOW}⬆️  Push ke prod (production)...${NC}"
  if git push prod main; then
    echo -e "${GREEN}✅ Berhasil push ke PROD.${NC}"
    echo ""
    echo -e "${BLUE}🔗 Tes di:${NC}"
    echo "   https://lintangglangitt.github.io/griya-aleena"
    echo ""
  else
    echo -e "${RED}❌ Push ke prod gagal.${NC}"
  fi
}

# ─────────────────────────────────────────────
# Menu utama
# ─────────────────────────────────────────────
while true; do
  echo -e "${BLUE}Pilih aksi:${NC}"
  echo "  [1] 📊 Cek status"
  echo "  [2] 📥 Tarik update dari dev"
  echo "  [3] 📝 Commit lokal (tanpa push)"
  echo "  [4] ⬆️ Push ke DEV (tanpa commit)"
  echo "  [5] 🚀 Push ke PROD (auto-pull prod dulu)"
  echo "  [6] ❌ Keluar"
  echo ""
  read -p "Pilihan [1-6]: " pilihan
  echo ""

  case $pilihan in
    1) show_status ;;
    2) pull_dev ;;
    3) commit_local ;;
    4) push_dev ;;
    5) push_prod ;;
    6) echo -e "${GREEN}👋 Selesai.${NC}"; exit 0 ;;
    *) echo -e "${RED}❌ Pilihan tidak valid.${NC}" ;;
  esac

  echo ""
  read -p "Tekan Enter untuk kembali ke menu..." _
  clear
done