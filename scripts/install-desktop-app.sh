#!/bin/bash
# Build a clickable Swingstr.app on the Desktop that launches the local project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_APP="$ROOT/node_modules/electron/dist/Electron.app"
DEST="$HOME/Desktop/Swingstr.app"
ICON_SRC="$ROOT/public/swingstr-logo.jpg"
TMP_BASE="$(mktemp -d /tmp/swingstr-icon.XXXXXX)"
TMP_ICONSET="$TMP_BASE/AppIcon.iconset"
ICNS="$ROOT/electron/AppIcon.icns"

if [[ ! -d "$ELECTRON_APP" ]]; then
  echo "Electron is not installed. Run npm install first."
  exit 1
fi

if [[ ! -f "$ROOT/dist/index.html" ]]; then
  echo "Missing dist/. Run npm run build first."
  exit 1
fi

echo "Building app icon..."
mkdir -p "$TMP_ICONSET"
make_icon() {
  local size="$1"
  local name="$2"
  sips -s format png -z "$size" "$size" "$ICON_SRC" --out "$TMP_ICONSET/$name" >/dev/null
}
make_icon 16 icon_16x16.png
make_icon 32 icon_16x16@2x.png
make_icon 32 icon_32x32.png
make_icon 64 icon_32x32@2x.png
make_icon 128 icon_128x128.png
make_icon 256 icon_128x128@2x.png
make_icon 256 icon_256x256.png
make_icon 512 icon_256x256@2x.png
make_icon 512 icon_512x512.png
make_icon 1024 icon_512x512@2x.png
iconutil -c icns "$TMP_ICONSET" -o "$ICNS"
rm -rf "$TMP_BASE"

echo "Creating $DEST..."
rm -rf "$DEST"
cp -R "$ELECTRON_APP" "$DEST"

RESOURCES="$DEST/Contents/Resources"
rm -f "$RESOURCES/default_app.asar"
rm -rf "$RESOURCES/app"
ln -s "$ROOT" "$RESOURCES/app"
cp "$ICNS" "$RESOURCES/electron.icns"
cp "$ICNS" "$RESOURCES/icon.icns"

PLIST="$DEST/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName Swingstr" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Swingstr" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.bozentka.swingstr" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString 0.1.0" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 0.1.0" "$PLIST" 2>/dev/null || true

xattr -cr "$DEST" 2>/dev/null || true

echo "Done. Desktop icon: $DEST"
echo "Saved videos/notes: $HOME/Documents/Swingstr Library"
