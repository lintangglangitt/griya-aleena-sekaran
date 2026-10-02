#!/bin/bash
# Script backup D1 Griya Aleena
# Format nama file: griya-aleena-db-backup_YYYYMMDD_HHMM.sql
# Pakai waktu lokal (WIB)
# Output file .sql otomatis di folder yang sama dengan script ini

set -e

# Deteksi folder tempat script ini berada
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Buat nama file dengan timestamp WIB
DATE=$(date +%Y%m%d)
TIME=$(date +%H%M)
FILENAME="griya-aleena-db-backup_${DATE}_${TIME}.sql"
FILEPATH="${SCRIPT_DIR}/${FILENAME}"

echo "🔄 Memulai backup..."
echo "📁 File: $FILENAME"
echo "📂 Folder: $SCRIPT_DIR"
echo ""

# Export D1 ke file (path absolut)
npx wrangler d1 export griya-aleena-db --remote --output="$FILEPATH"

echo ""
echo "✅ Backup selesai!"
echo "📁 Lokasi: $FILEPATH"
echo "📊 Ukuran:"
ls -lh "$FILEPATH"00
