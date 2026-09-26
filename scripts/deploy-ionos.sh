#!/usr/bin/env bash
# Lädt den fertigen Ordner dist/ per SFTP auf den IONOS-Webspace.
# Sicherheitsnetz: Es wird nur in einen Ordner hochgeladen, der leer ist oder schon von uns stammt
# (erkennbar an der Datei .svelversberg-deploy). So werden nie fremde Dateien gelöscht.
set -euo pipefail

: "${SFTP_HOST:?SFTP_HOST fehlt (GitHub-Secret)}"
: "${SFTP_USER:?SFTP_USER fehlt (GitHub-Secret)}"
: "${SFTP_PASSWORD:?SFTP_PASSWORD fehlt (GitHub-Secret)}"
: "${SFTP_PATH:?SFTP_PATH fehlt (GitHub-Secret), z. B. / bei eigenem SFTP-Konto}"

# Zielpfad normalisieren ("/svelversberg/" → "/svelversberg"; "/" bleibt "/").
# Empfohlen: eigenes SFTP-Konto, das auf den Ordner /svelversberg beschränkt ist – dann ist SFTP_PATH einfach "/".
TARGET="${SFTP_PATH%/}"
TARGET="${TARGET:-/}"
MARKER=".svelversberg-deploy"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "dist/$MARKER"

LFTP_SETTINGS="set sftp:auto-confirm yes; set net:max-retries 3; set net:timeout 30; set cmd:fail-exit yes"
export LFTP_PASSWORD="$SFTP_PASSWORD"
OPEN="open --env-password -u \"$SFTP_USER\" sftp://$SFTP_HOST"

# Zielordner anlegen (falls nötig) und Inhalt prüfen
lftp -c "$LFTP_SETTINGS; $OPEN; mkdir -p -f \"$TARGET\"" 2>/dev/null || true
if ! raw=$(lftp -c "$LFTP_SETTINGS; $OPEN; cls -1a \"${TARGET%/}/\""); then
  echo "Abbruch: Verbindung zu IONOS fehlgeschlagen oder Ordner nicht lesbar. Zugangsdaten (Secrets) prüfen." >&2
  exit 1
fi
listing=$(sed -E 's#/$##; s#.*/##' <<<"$raw" | grep -v -E '^(\.{1,2})?$' || true)
if [ -n "$listing" ] && ! grep -qx "$MARKER" <<<"$listing"; then
  echo "Abbruch: Der Zielordner $TARGET enthält fremde Dateien:" >&2
  head -20 <<<"$listing" >&2
  echo "Bitte einen leeren, eigenen Ordner verwenden (siehe Anleitung)." >&2
  exit 1
fi

# Spiegeln: neue/geänderte Dateien hochladen, nicht mehr vorhandene löschen
lftp -c "$LFTP_SETTINGS; $OPEN; mirror --reverse --delete --verbose=1 --parallel=4 dist/ \"${TARGET%/}/\""
echo "Fertig: Seite nach $TARGET hochgeladen."
