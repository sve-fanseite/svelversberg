#!/usr/bin/env bash
# Lädt den fertigen Ordner dist/ per SFTP auf den IONOS-Webspace.
# Sicherheitsnetz: Es wird nur in einen Ordner hochgeladen, der leer ist oder schon von uns stammt
# (erkennbar an der Datei .svelversberg-deploy). So werden nie fremde Dateien gelöscht.
set -euo pipefail

: "${SFTP_HOST:?SFTP_HOST fehlt (GitHub-Secret)}"
: "${SFTP_USER:?SFTP_USER fehlt (GitHub-Secret)}"
: "${SFTP_PASSWORD:?SFTP_PASSWORD fehlt (GitHub-Secret)}"
: "${SFTP_PATH:?SFTP_PATH fehlt (GitHub-Secret), z. B. /svelversberg}"

case "$SFTP_PATH" in
  "" | "/" | "." | "./")
    echo "Abbruch: SFTP_PATH darf nicht das Hauptverzeichnis sein. Bitte einen eigenen Ordner wie /svelversberg verwenden." >&2
    exit 1 ;;
esac

MARKER=".svelversberg-deploy"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "dist/$MARKER"

LFTP_SETTINGS="set sftp:auto-confirm yes; set net:max-retries 3; set net:timeout 30; set cmd:fail-exit yes"
export LFTP_PASSWORD="$SFTP_PASSWORD"
OPEN="open --env-password -u \"$SFTP_USER\" sftp://$SFTP_HOST"

# Zielordner anlegen (falls nötig) und Inhalt prüfen
listing=$(lftp -c "$LFTP_SETTINGS; $OPEN; mkdir -p -f \"$SFTP_PATH\"; cls -1a \"$SFTP_PATH/\"" 2>/dev/null | sed -E 's#/$##; s#.*/##' | grep -v -E '^(\.{1,2})?$' || true)
if [ -n "$listing" ] && ! grep -qx "$MARKER" <<<"$listing"; then
  echo "Abbruch: Der Zielordner $SFTP_PATH enthält fremde Dateien:" >&2
  head -20 <<<"$listing" >&2
  echo "Bitte einen leeren, eigenen Ordner verwenden (siehe Anleitung)." >&2
  exit 1
fi

# Spiegeln: neue/geänderte Dateien hochladen, nicht mehr vorhandene löschen
lftp -c "$LFTP_SETTINGS; $OPEN; mirror --reverse --delete --verbose=1 --parallel=4 dist/ \"$SFTP_PATH/\""
echo "Fertig: Seite nach $SFTP_PATH hochgeladen."
