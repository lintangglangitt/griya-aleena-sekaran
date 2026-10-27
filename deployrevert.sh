#!/bin/bash
# ============================================================
#  deploy.sh — Alur kerja aman dev & prod (v7 - Revert Specific)
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

  echo -e "${YELLOW}Perubahan lokal belum di-commit [2 utk commit]:${NC}"
  local lokal_changes=$(git status --short)
  if [ -z "$lokal_changes" ]; then
    echo "   (tidak ada)"
  else
    echo "$lokal_changes" | sed 's/^/   /'
  fi
  echo ""

  echo -e "${YELLOW}Commit dev belum ada di lokal [3 untuk pull dari dev]:${NC}"
  local from_dev=$(git log main..origin/main --oneline 2>/dev/null)
  if [ -z "$from_dev" ]; then
    echo "   (tidak ada)"
  else
    echo "$from_dev" | sed 's/^/   /'
  fi
  echo ""


   echo -e "${YELLOW}Commit prod belum ada di lokal [4 untuk pull dari prod]:${NC}"
  local from_prod=$(git log main..prod/main --oneline 2>/dev/null)
  if [ -z "$from_prod" ]; then
    echo "   (tidak ada)"
  else
    echo "$from_prod" | sed 's/^/   /'
  fi
  echo ""


  echo -e "${YELLOW}Commit lokal belum di-push ke dev [5 untuk push ke dev]:${NC}"
  local to_dev=$(git log origin/main..main --oneline 2>/dev/null)
  if [ -z "$to_dev" ]; then
    echo "   (tidak ada)"
  else
    echo "$to_dev" | sed 's/^/   /'
  fi
  echo ""

  echo -e "${YELLOW}Commit lokal belum di-push ke prod [6 untuk push ke prod]:${NC}"
  local to_prod=$(git log prod/main..main --oneline 2>/dev/null)
  if [ -z "$to_prod" ]; then
    echo "   (tidak ada)"
  else
    echo "$to_prod" | sed 's/^/   /'
  fi
  echo ""

  echo "────────────────────────────────────────────"
  echo ""
}

# ─────────────────────────────────────────────
# Fungsi: commit lokal (tanpa push)
# ─────────────────────────────────────────────
commit_local() {
  echo ""
  echo -e "${BLUE}📋 Status perubahan:${NC}"
  git status --short
  echo ""

  if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Tidak ada perubahan untuk di-commit.${NC}"
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

  if git commit -m "$msg"; then
    echo -e "${GREEN}✅ Commit berhasil.${NC}"
    echo ""
    echo -e "${BLUE}ℹ️  Langkah berikutnya:${NC}"
    echo "   - Push ke dev: menu [5]"
    echo "   - Cek status: menu [1]"
    echo ""
  else
    echo -e "${RED}❌ Commit gagal.${NC}"
  fi
}

# ─────────────────────────────────────────────
# Fungsi: pull dari dev
# ─────────────────────────────────────────────
pull_dev() {
  echo -e "${YELLOW}📥 Pull update dari dev (origin/main)...${NC}"
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
# Fungsi: pull dari prod
# ─────────────────────────────────────────────
pull_prod() {
  echo -e "${YELLOW}📥 Pull update dari prod (prod/main)...${NC}"
  git checkout main 2>/dev/null || { echo -e "${RED}❌ Gagal checkout main.${NC}"; return 1; }
  if git pull prod main; then
    echo -e "${GREEN}✅ Sinkron dengan prod.${NC}"
  else
    echo -e "${RED}❌ Gagal pull dari prod. Cek konflik.${NC}"
    return 1
  fi
  echo ""
}

# ─────────────────────────────────────────────
# Fungsi: push ke dev (auto-pull dev dulu)
# ─────────────────────────────────────────────
push_dev() {
  echo ""
  echo -e "${BLUE}🔄 Langkah 1/3: Sinkron dengan dev...${NC}"
  if ! git pull origin main; then
    echo ""
    echo -e "${RED}❌ Gagal sinkron dengan dev. Proses dihentikan.${NC}"
    echo -e "${YELLOW}Selesaikan konflik dulu, lalu jalankan ulang.${NC}"
    return 1
  fi
  echo ""

  echo -e "${BLUE}🔄 Langkah 2/3: Cek commit yang akan dikirim...${NC}"
  local commits=$(git log origin/main..main --oneline 2>/dev/null)
  if [ -z "$commits" ]; then
    echo -e "${YELLOW}⚠️  Tidak ada commit baru untuk dikirim ke dev.${NC}"
    echo "   Lokal dan dev sudah sinkron."
    echo ""
    echo -e "${YELLOW}   Kemungkinan:${NC}"
    echo "   - Belum commit perubahan → jalankan menu [2]"
    echo "   - Commit sudah ada di dev"
    return 0
  fi

  echo "$commits" | sed 's/^/   /'
  echo ""

  echo -e "${BLUE}🔄 Langkah 3/3: Push ke dev${NC}"
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
# Fungsi: push ke prod (auto-pull prod dulu)
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
    echo "   - Kamu lupa tarik dari dev dulu → jalankan menu [3]"
    echo "   - Commit sudah ada di prod"
    return 0
  fi

  echo "$commits" | sed 's/^/   /'
  echo ""

  # STEP 3: Konfirmasi & push
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
# Fungsi: revert 1 commit terakhir
# ─────────────────────────────────────────────
revert_commit() {
  echo ""
  echo -e "${RED}⚠️  PERINGATAN: REVERT COMMIT TERAKHIR${NC}"
  echo "   Ini akan membuat commit baru untuk membatalkan perubahan"
  echo "   dari 1 commit terakhir di branch lokal (main)."
  echo ""

  echo -e "${YELLOW}📋 Commit terakhir yang akan dibatalkan:${NC}"
  git log -1 --oneline
  echo ""

  read -p "❓ Yakin ingin melanjutkan revert? (ketik 'YA'): " konfirmasi
  if [ "$konfirmasi" != "YA" ]; then
    echo -e "${YELLOW}⏸️  Dibatalkan.${NC}"
    return
  fi

  echo -e "${BLUE}🔄 Langkah 1/3: Melakukan revert...${NC}"
  # Menggunakan --no-edit agar tidak masuk ke editor teks
  if ! git revert HEAD --no-edit; then
    echo -e "${RED}❌ Gagal melakukan revert. Mungkin ada konflik.${NC}"
    echo -e "${YELLOW}   Silakan cek 'git status' dan selesaikan konflik secara manual.${NC}"
    return 1
  fi
  echo -e "${GREEN}✅ Revert berhasil dibuat secara lokal.${NC}"
  echo ""

  echo -e "${BLUE}🔄 Langkah 2/3: Pilih tujuan push revert...${NC}"
  echo "   [1] Push ke DEV (origin/main)"
  echo "   [2] Push ke PROD (prod/main)"
  echo "   [3] Batalkan push (biarkan lokal saja)"
  read -p "Pilihan [1-3]: " tujuan

  case $tujuan in
    1)
      echo -e "${YELLOW}⬆️  Push ke dev (origin/main)...${NC}"
      if git push origin main; then
        echo -e "${GREEN}✅ Berhasil push revert ke DEV.${NC}"
      else
        echo -e "${RED}❌ Push ke dev gagal.${NC}"
      fi
      ;;
    2)
      echo -e "${YELLOW}⬆️  Push ke prod (prod/main)...${NC}"
      if git push prod main; then
        echo -e "${GREEN}✅ Berhasil push revert ke PROD.${NC}"
      else
        echo -e "${RED}❌ Push ke prod gagal.${NC}"
      fi
      ;;
    3)
      echo -e "${YELLOW}⏸️  Revert hanya ada di lokal. Tidak di-push.${NC}"
      ;;
    *)
      echo -e "${RED}❌ Pilihan tidak valid. Revert hanya ada di lokal.${NC}"
      ;;
  esac
  echo ""
}

# ─────────────────────────────────────────────
# Fungsi: revert ke commit tertentu (pilih dari list)
# ─────────────────────────────────────────────
revert_specific_commit() {
  echo ""
  echo -e "${RED}⚠️  REVERT KE COMMIT TERTENTU${NC}"
  echo "   Pilih commit dari daftar di bawah. Git akan membatalkan"
  echo "   commit tersebut beserta commit-commit di atasnya."
  echo ""

  # Ambil 10 commit terakhir
  echo -e "${YELLOW}📋 Daftar commit terakhir di branch lokal (main):${NC}"
  
  # Simpan hash ke dalam array
  local hashes=($(git log -n 10 --format="%H"))
  local i=1
  
  for hash in "${hashes[@]}"; do
    local info=$(git log -1 --format="%h - %s (%cr)" $hash)
    echo -e "   [$i] $info"
    ((i++))
  done
  echo ""

  read -p "❓ Pilih nomor commit yang ingin di-revert [1-10] (kosongkan untuk batal): " pilihan

  if [ -z "$pilihan" ] || ! [[ "$pilihan" =~ ^[0-9]+$ ]] || [ "$pilihan" -lt 1 ] || [ "$pilihan" -gt "${#hashes[@]}" ]; then
    echo -e "${YELLOW}⏸️  Dibatalkan atau pilihan tidak valid.${NC}"
    return
  fi

  # Git array dimulai dari 0
  local target_index=$((pilihan - 1))
  local target_hash=${hashes[$target_index]}
  local target_desc=$(git log -1 --format="%h - %s" $target_hash)

  echo ""
  echo -e "${RED}⚠️  Anda memilih untuk me-revert:${NC}"
  echo -e "   $target_desc"
  echo -e "${YELLOW}   Semua perubahan dari commit ini dan commit setelahnya akan dibatalkan.${NC}"
  echo ""

  read -p "❓ Yakin ingin melanjutkan? (ketik 'YA'): " konfirmasi
  if [ "$konfirmasi" != "YA" ]; then
    echo -e "${YELLOW}⏸️  Dibatalkan.${NC}"
    return
  fi

  echo -e "${BLUE}🔄 Langkah 1/3: Melakukan revert (mungkin butuh waktu)...${NC}"
  
  # Gunakan git revert dengan range (HEAD sampai target_hash^)
  # Tanda ^ artinya "satu commit sebelum target", jadi commit target ikut di-revert.
  if ! git revert --no-edit HEAD^..$target_hash 2>/dev/null; then
    # Fallback jika revert range gagal (misal karena konflik)
    echo -e "${RED}❌ Gagal melakukan revert otomatis. Kemungkinan ada konflik.${NC}"
    echo -e "${YELLOW}   Silakan cek 'git status' dan selesaikan konflik secara manual.${NC}"
    echo -e "${YELLOW}   Jika ingin membatalkan proses revert: git revert --abort${NC}"
    return 1
  fi
  
  echo -e "${GREEN}✅ Revert berhasil dibuat secara lokal.${NC}"
  echo ""

  echo -e "${BLUE}🔄 Langkah 2/3: Pilih tujuan push revert...${NC}"
  echo "   [1] Push ke DEV (origin/main)"
  echo "   [2] Push ke PROD (prod/main)"
  echo "   [3] Batalkan push (biarkan lokal saja)"
  read -p "Pilihan [1-3]: " tujuan

  case $tujuan in
    1)
      echo -e "${YELLOW}⬆️  Push ke dev (origin/main)...${NC}"
      if git push origin main; then
        echo -e "${GREEN}✅ Berhasil push revert ke DEV.${NC}"
      else
        echo -e "${RED}❌ Push ke dev gagal.${NC}"
      fi
      ;;
    2)
      echo -e "${YELLOW}⬆️  Push ke prod (prod/main)...${NC}"
      if git push prod main; then
        echo -e "${GREEN}✅ Berhasil push revert ke PROD.${NC}"
      else
        echo -e "${RED}❌ Push ke prod gagal.${NC}"
      fi
      ;;
    3)
      echo -e "${YELLOW}⏸️  Revert hanya ada di lokal. Tidak di-push.${NC}"
      ;;
    *)
      echo -e "${RED}❌ Pilihan tidak valid. Revert hanya ada di lokal.${NC}"
      ;;
  esac
  echo ""
}

# ─────────────────────────────────────────────
# Menu utama
# ─────────────────────────────────────────────
while true; do
  echo -e "${BLUE}Pilih aksi:${NC}"
  echo "  [1] 📊 Cek status"
  echo "  [2] 📝 Commit lokal (tanpa push)"
  echo "  [3] 📥 Pull update dari dev"
  echo "  [4] 📥 Pull update dari prod"
  echo "  [5] ⬆️ Push ke dev (auto-pull dev dulu)"
  echo "  [6] ⬆️ Push ke prod (auto-pull prod dulu)"
  echo "  [7] ⏪ Revert 1 commit terakhir"
  echo "  [8] ⏪ Revert ke commit tertentu (pilih dari list)"
  echo "  [9] ❌ Keluar"
  echo ""
  read -p "Pilihan [1-9]: " pilihan
  echo ""

  case $pilihan in
    1) show_status ;;
    2) commit_local ;;
    3) pull_dev ;;
    4) pull_prod ;;
    5) push_dev ;;
    6) push_prod ;;
    7) revert_commit ;;
    8) revert_specific_commit ;;
    9) echo -e "${GREEN}👋 Selesai.${NC}"; exit 0 ;;
    *) echo -e "${RED}❌ Pilihan tidak valid.${NC}" ;;
  esac

  echo ""
  read -p "Tekan Enter untuk kembali ke menu..." _
  clear
done