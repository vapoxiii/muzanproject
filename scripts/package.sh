#!/usr/bin/env bash
# Prépare les deux archives à livrer :
#  - mon-suivi-v2-projet.zip : le projet complet (à mettre dans le dépôt GitHub)
#  - mon-suivi-v2-site.zip   : le site déjà construit, en mode local (sans compte), prêt à publier tel quel
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=$(realpath -m "${1:-dist-livrables}")
mkdir -p "$OUT"
rm -f "$OUT/mon-suivi-v2-projet.zip" "$OUT/mon-suivi-v2-site.zip"
git archive --format=zip --prefix=mon-suivi/ -o "$OUT/mon-suivi-v2-projet.zip" HEAD
rm -rf .tmp/site
# variables vides : priorité sur un éventuel .env → version sans compte
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite build --outDir .tmp/site --emptyOutDir > /dev/null
(cd .tmp/site && find . -name '*.map' -delete && zip -qr "$OUT/mon-suivi-v2-site.zip" .)
ls -la "$OUT"
