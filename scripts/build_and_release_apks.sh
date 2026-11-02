#!/usr/bin/env bash
set -e

# ==============================================================================
# BEMS ERP: Dual Flutter Mobile Apps (Staff + GMD) Build & Release Pipeline
# ==============================================================================

echo "========================================================"
echo "🚀 Starting BEMS Mobile Apps Automated Release Pipeline"
echo "========================================================"

export PATH="/Users/henry/.local/flutter/bin:$PATH"
export JAVA_HOME="/Users/henry/.local/java/jdk-17.0.12+7/Contents/Home"
export ANDROID_HOME="/Users/henry/.local/android-sdk"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "📦 1. Building BEMS Staff App..."
cd "$ROOT_DIR/bems_staff_app"
flutter build apk --release

echo "📦 2. Building BEMS GMD AI App..."
cd "$ROOT_DIR/bems_gmd_ai"
flutter build apk --release

echo "📋 3. Staging APK binaries to public distribution paths..."
cd "$ROOT_DIR"
mkdir -p public/downloads

# Staff APKs
cp bems_staff_app/build/app/outputs/flutter-apk/app-release.apk public/downloads/staff-app.apk
cp bems_staff_app/build/app/outputs/flutter-apk/app-release.apk public/downloads/BEMS-Staff-Portal.apk
cp bems_staff_app/build/app/outputs/flutter-apk/app-release.apk BEMS-Staff-Portal.apk
cp bems_staff_app/build/app/outputs/flutter-apk/app-release.apk bems_staff_app.apk

# GMD APKs
cp bems_gmd_ai/build/app/outputs/flutter-apk/app-release.apk public/downloads/gmd-app.apk
cp bems_gmd_ai/build/app/outputs/flutter-apk/app-release.apk public/downloads/BEMS-GMD-Executive-Cockpit.apk
cp bems_gmd_ai/build/app/outputs/flutter-apk/app-release.apk BEMS-GMD-Executive-Cockpit.apk
cp bems_gmd_ai/build/app/outputs/flutter-apk/app-release.apk bems_gmd_app.apk

echo "✅ All APKs built and synchronized with public/downloads/!"
echo "   - Staff Portal APK: public/downloads/staff-app.apk"
echo "   - GMD AI APK:       public/downloads/gmd-app.apk"
