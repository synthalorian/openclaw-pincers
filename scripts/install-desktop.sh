#!/usr/bin/env bash
# install-desktop.sh — install the OpenClaw Pincers app icon + launcher (Linux).
#
# Renders the official logo (assets/openclawpincers.png) into the user icon
# theme at all standard sizes and writes a .desktop launcher pointing at the
# release binary. Idempotent; safe to re-run after pulling new brand assets.
#
# Usage: ./scripts/install-desktop.sh [path-to-binary]
#   Default binary: src-tauri/target/release/openclaw-desktop

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGO="$REPO_ROOT/assets/openclawpincers.png"
BINARY="${1:-$REPO_ROOT/src-tauri/target/release/openclaw-desktop}"
ICON_THEME="$HOME/.local/share/icons/hicolor"
APPS_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$APPS_DIR/openclaw-pincers.desktop"

[[ -f "$LOGO" ]] || { echo "error: logo not found at $LOGO" >&2; exit 1; }
command -v magick >/dev/null 2>&1 || command -v convert >/dev/null 2>&1 || {
  echo "error: ImageMagick (magick/convert) required" >&2; exit 1; }
render() { # size dest
  if command -v magick >/dev/null 2>&1; then magick "$LOGO" -resize "$1x$1" "$2"
  else convert "$LOGO" -resize "$1x$1" "$2"; fi
}

# All names the launcher/window might resolve: manual launcher name, deb
# bundle name, Wayland app id, legacy no-hyphen variant.
NAMES=(openclaw-pincers openclaw-desktop ai.openclaw.pincers openclawpincers)
for size in 32 64 128 256 512; do
  dir="$ICON_THEME/${size}x${size}/apps"
  mkdir -p "$dir"
  for name in "${NAMES[@]}"; do
    render "$size" "$dir/$name.png"
  done
done
echo "icons installed → $ICON_THEME"

mkdir -p "$APPS_DIR"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=OpenClaw Pincers
GenericName=OpenClaw Desktop Client
Comment=Get a grip on your gateway — desktop control center for OpenClaw
Exec=$BINARY
Icon=openclaw-pincers
Terminal=false
Categories=Development;Utility;Network;
Keywords=openclaw;ai;gateway;agent;claw;
StartupNotify=true
# Matches the .deb's WMClass so the taskbar window binds to this launcher icon.
StartupWMClass=openclaw-desktop
EOF
echo "launcher installed → $DESKTOP_FILE"

# Refresh icon + desktop-entry caches (best-effort).
gtk-update-icon-cache -f -t "$ICON_THEME" 2>/dev/null || true
if command -v kbuildsycoca6 >/dev/null 2>&1; then kbuildsycoca6 --noincremental || true
elif command -v kbuildsycoca5 >/dev/null 2>&1; then kbuildsycoca5 --noincremental || true
fi
update-desktop-database "$APPS_DIR" 2>/dev/null || true

echo "done — restart Pincers to pick up the new window icon."
