#!/usr/bin/env bash
# Lädt Logo, Favicon und VDI/VKS-Badge von der Hauptseite nach public/brand/.
# Quelle der URLs: unfall/CLAUDE.md, Abschnitt "Marken-Assets". Nichts wird neu gestaltet.
# Aufruf aus unfall/:  ./scripts/fetch-brand.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HERE/../public/brand"
mkdir -p "$DEST"

declare -A ASSETS=(
  [logo.png]="https://sv-rettinger.de/wp-content/uploads/2025/07/cropped-rettinger_kollegen_logo_01.png"
  [favicon.png]="https://sv-rettinger.de/wp-content/uploads/2025/09/cropped-rettinger_kollegen_favicon-scaled-1-300x300.png"
  [vdi-vks-badge.png]="https://sv-rettinger.de/wp-content/uploads/2026/05/RK-VDI-Qualifield-Experts-VKS.png"
)

for name in "${!ASSETS[@]}"; do
  url="${ASSETS[$name]}"
  echo "→ $name  ($url)"
  curl -fsSL -A "Mozilla/5.0 (compatible; unfall-brand/1.0)" -o "$DEST/$name" "$url"
  file "$DEST/$name" | sed 's/^/   /'
done

echo "Fertig: $(ls "$DEST" | tr '\n' ' ')"
