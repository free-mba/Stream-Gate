#!/bin/bash
# Script to sign the macOS app bundle and its binaries

set -e

APP_PATH="$1"

if [ -z "$APP_PATH" ]; then
    echo "Usage: $0 <path-to-app-bundle>"
    exit 1
fi

if [ ! -d "$APP_PATH" ]; then
    echo "Error: App bundle not found at $APP_PATH"
    exit 1
fi

echo "Signing app bundle at: $APP_PATH"

# Sign the native binaries first
if [ -d "$APP_PATH/Contents/Resources/binaries" ]; then
    echo "Signing native binaries..."
    for binary in "$APP_PATH/Contents/Resources/binaries"/*; do
        if [ -f "$binary" ]; then
            echo "Signing: $binary"
            chmod +x "$binary"
            codesign --force --deep --sign - "$binary" 2>/dev/null || true
        fi
    done
fi

# Sign the entire app with the entitlements
echo "Signing app bundle..."
ENTITLEMENTS_PATH="$(dirname "$0")/../src-tauri/entitlements.plist"

if [ -f "$ENTITLEMENTS_PATH" ]; then
    echo "Using entitlements: $ENTITLEMENTS_PATH"
    codesign --force --deep --options runtime --entitlements "$ENTITLEMENTS_PATH" --sign - "$APP_PATH"
else
    echo "Warning: Entitlements file not found, signing without entitlements"
    codesign --force --deep --sign - "$APP_PATH"
fi

echo "Verifying signature..."
codesign --verify --verbose "$APP_PATH"

echo "✓ App signed successfully!"
