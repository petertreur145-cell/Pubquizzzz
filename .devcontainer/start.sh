#!/usr/bin/env bash
# Start de Pubquizzz-server in de achtergrond, zet poort 3001 op "Public"
# (zodat telefoons zonder GitHub-login kunnen meedoen) en schrijf de links
# naar START-HIER.md.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3001
LOG=/tmp/pubquizzz.log

if ! curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  [ -d "$ROOT/app/node_modules" ] || (cd "$ROOT/app" && npm ci --omit=dev --no-audit --no-fund)
  DATA_DIR="$ROOT/data" PORT=$PORT setsid nohup node "$ROOT/app/server/index.js" >"$LOG" 2>&1 < /dev/null &
fi

for i in $(seq 1 30); do
  curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1 && break
  sleep 1
done

if [ -n "$CODESPACE_NAME" ]; then
  BASE="https://${CODESPACE_NAME}-${PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  for i in $(seq 1 10); do
    gh codespace ports visibility "$PORT:public" -c "$CODESPACE_NAME" >/dev/null 2>&1 && break
    sleep 3
  done
else
  BASE="http://localhost:$PORT"
fi

cat > "$ROOT/START-HIER.md" <<MD
# Pubquizzz draait! 🎉

Houd **Ctrl** (Mac: **Cmd**) ingedrukt en klik op een link:

| Wat | Link |
|---|---|
| 📺 **Beamer** (QR-code, zet op tv/beamer) | $BASE/screen |
| 🎮 **Host** (hiermee bestuur jij de quiz) | $BASE/host |
| ✏️ Vragen maken / aanpassen | $BASE/host/editor |
| 📱 Zelf meespelen / testen | $BASE |

Spelers scannen gewoon de QR-code op de beamer — wifi of 4G maakt niet uit.

**Telefoon krijgt een GitHub-inlogscherm?** Ga onderaan naar het tabblad
**Ports / Poorten**, klik met rechts op poort 3001 → **Port Visibility** → **Public**.

Laat dit tabblad open staan tijdens de quiz.
MD
