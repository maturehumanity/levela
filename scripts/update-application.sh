#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
APK_SOURCE="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APK_TARGET_DIR="$ROOT_DIR/public/downloads"
APK_TARGET="$APK_TARGET_DIR/levela-debug.apk"
RELEASE_ID="$(sed -n "s/^export const APP_RELEASE_ID = '\\(.*\\)';$/\\1/p" "$ROOT_DIR/src/lib/downloads.ts")"
VERSIONED_APK_TARGET="$APK_TARGET_DIR/levela-debug-${RELEASE_ID}.apk"
JDK_CACHE_DIR="/tmp/levela-jdk"
JDK_ARCHIVE="$JDK_CACHE_DIR/temurin21.tar.gz"
JDK_DOWNLOAD_URL="https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"

ensure_java() {
  if command -v java >/dev/null 2>&1; then
    return
  fi

  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    export PATH="$JAVA_HOME/bin:$PATH"
    return
  fi

  mkdir -p "$JDK_CACHE_DIR/extracted"

  if [ ! -f "$JDK_ARCHIVE" ]; then
    curl -L -o "$JDK_ARCHIVE" "$JDK_DOWNLOAD_URL"
  fi

  if ! find "$JDK_CACHE_DIR/extracted" -mindepth 1 -maxdepth 1 -type d | grep -q .; then
    tar -xzf "$JDK_ARCHIVE" -C "$JDK_CACHE_DIR/extracted"
  fi

  JAVA_HOME="$(find "$JDK_CACHE_DIR/extracted" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  export JAVA_HOME
  export PATH="$JAVA_HOME/bin:$PATH"

  if ! command -v java >/dev/null 2>&1; then
    echo "Java is required to build the Android APK." >&2
    exit 1
  fi
}

echo "Building the web app for Android sync..."
npm run build:android

echo "Syncing the latest web assets into the Android project..."
npx cap sync android

echo "Preparing Java for the Android build..."
ensure_java

echo "Building the Android debug APK..."
(
  cd "$ANDROID_DIR"
  ./gradlew assembleDebug
)

if [ ! -f "$APK_SOURCE" ]; then
  echo "Expected APK not found at $APK_SOURCE" >&2
  exit 1
fi

echo "Publishing the APK into the website download path..."
mkdir -p "$APK_TARGET_DIR"
cp "$APK_SOURCE" "$APK_TARGET"
cp "$APK_SOURCE" "$VERSIONED_APK_TARGET"

echo "Rebuilding the website so the download path includes the latest APK..."
npm run build

echo "Application update complete."
echo "APK source: $APK_SOURCE"
echo "Website download target: $APK_TARGET"
echo "Website versioned APK target: $VERSIONED_APK_TARGET"
