#!/bin/bash
# ============================================================
#  deploy.sh — Alur kerja aman dev & prod (v2.5)
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

# Pastikan pull pakai merge (hindari error divergent)
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
# Fungsi: pull dari prod (untuk sync sebelum push)
# ─────────────────────────────────────────────
pull_prod() {
  echo -e "${YELLOW}📥 Cek update dari prod (untuk hindari non-fast-forward)...${NC}"
  if git pull prod main; then
    echo -e "${GREEN}✅ Sinkron dengan prod.${NC}"
    return 0
  else
    echo -e "${RED}❌ Gagal pull dari prod. Kemungkinan ada konflik.${NC}"
    echo -e "${YELLOW}   Selesaikan konflik dulu:${NC}"
    echo "     1. Edit file yang konflik (cari tanda <<<<<<< )"
    echo "     2. git add <file>"
    echo "     3. git commit -m \"merge: resolve conflict\""
    echo "     4. Jalankan ./deploy.sh lagi"
    return 1
  fi
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

  echo -e "${YELLOW}📦 Stage semua perubahan...${NC}"
  git add -A

  read -p "📝 Pesan commit (kosongkan untuk batal): " msg
  if [ -z "$msg" ]; then
    echo -e "${YELLOW}⏸️  Dibatalkan.${NC}"
    git reset > /dev/null
    return
  fi

  git commit -m "$msg" || { echo -e "${RED}❌ Commit gagal.${NC}"; return; }

  echo -e "${YELLOW}⬆️  Push ke dev (origin/main)...${NC}"
  if git push origin main; then
    echo -e "${GREEN}✅ Berhasil push ke DEV.${NC}"
    echo ""
    echo -e "${BLUE}🔗 Tes di:${NC}"
    echo "   https://lintangglangitt.github.io/griya-aleena-sekaran"
    echo ""
  else
    echo -e "${RED}❌ Push ke dev gagal.${NC}"
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

  # ─── STEP 1: Pull dari prod dulu ───
  echo -e "${BLUE}🔄 Langkah 1/3: Sinkron dengan prod...${NC}"
  if ! git pull prod main; then
    echo ""
    echo -e "${RED}❌ Gagal sinkron dengan prod. Proses dihentikan.${NC}"
    echo -e "${YELLOW}Selesaikan konflik dulu, lalu jalankan ulang.${NC}"
    return 1
  fi
  echo ""

  # ─── STEP 2: Cek commit yang akan dikirim ───
  echo -e "${BLUE}🔄 Langkah 2/3: Cek commit yang akan dikirim...${NC}"
  local commits=$(git log prod/main..main --oneline 2>/dev/null)
  if [ -z "$commits" ]; then
    echo -e "${YELLOW}⚠️  Tidak ada commit baru untuk dikirim ke prod.${NC}"
    echo "   Dev dan prod sudah sinkron, atau lokal ketinggalan."
    echo ""
    echo -e "${YELLOW}   Kemungkinan:${NC}"
    echo "   - Kamu lupa tarik dari dev dulu → jalankan menu [1]"
    echo "   - Commit sudah ada di prod"
    return 0
  fi

  echo "$commits" | sed 's/^/   /'
  echo ""

  # ─── STEP 3: Konfirmasi & push ───
  echo -e "${BLUE}🔄 Langkah 3/3: Konfirmasi & push${NC}"
  read -p "❓ Sudah tes di dev & yakin mau ke PROD? (ketik 'YA'): " konfirmasi
  if [ "$konfirmasi" != "YA" ]; then
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
  echo -e "${YELLOW}Commit prod belum ada di lokal:${NC}"
  git log main..prod/main --oneline 2>/dev/null | sed 's/^/   /' || echo "   (tidak ada)"
  echo ""
  echo "────────────────────────────────────────────"
  echo ""
}

# ─────────────────────────────────────────────
# Menu utama
# ─────────────────────────────────────────────
while true; do
  echo -e "${BLUE}Pilih aksi:${NC}"
  echo "  [1] 📥 Tarik update dari dev"
  echo "  [2] 📦 Commit lokal & push ke DEV"
  echo "  [3] 🚀 Push ke PROD (auto-pull prod dulu)"
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