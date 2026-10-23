#!/usr/bin/env bash
# Termux : met à jour NUTS Locator, lance le serveur local et ouvre le navigateur sur l'adresse réellement utilisée.
# Usage : bash scripts/termux-start.sh [branche]   (branche : main par défaut ; Ctrl+C pour arrêter)
# Le dépôt local est un simple miroir : la branche demandée est alignée sur GitHub (pas de fusion, donc pas de conflit
# « divergent branches » même si la branche distante a été réécrite). Les fichiers modifiés localement bloquent l'opération.
# Tout le corps est dans une fonction lue d'un bloc : le changement de branche peut remplacer ce fichier pendant son exécution.
run() {
cd "$(dirname "$0")/.." || exit 1
BRANCH="${1:-main}"
if git fetch origin "$BRANCH" && git checkout -q -B "$BRANCH" FETCH_HEAD; then
  echo "Version : $(grep -o "VERSION='[^']*'" src/version.js)"
else
  echo "(mise à jour impossible, on continue avec la version locale)"
fi
LOG=$(mktemp)
node scripts/serve.mjs > "$LOG" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -f "$LOG"' EXIT INT TERM
URL=""
for _ in $(seq 1 50); do
  URL=$(grep -o 'http://localhost:[0-9]*' "$LOG" | head -1)
  [ -n "$URL" ] && break
  kill -0 $SERVER 2>/dev/null || { cat "$LOG"; exit 1; }
  sleep 0.2
done
[ -n "$URL" ] || { echo "Le serveur n'a pas démarré :"; cat "$LOG"; exit 1; }
echo "NUTS Locator : $URL   (Ctrl+C pour arrêter)"
termux-open-url "$URL" 2>/dev/null || am start -a android.intent.action.VIEW -d "$URL" >/dev/null 2>&1
wait $SERVER
}
run "$@"
exit
