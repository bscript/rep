# Building rep+ Android App

This document provides instructions for building the rep+ Android application without Gradle.

## Prerequisites

### Required Software

1. **Android SDK** (API level 33 recommended)
   - Download from: https://developer.android.com/studio#command-tools
   - Or install Android Studio and use its SDK

2. **Kotlin Compiler** (kotlinc)
   - Download from: https://github.com/JetBrains/kotlin/releases

3. **Java JDK** (11 or higher)
   - OpenJDK or Oracle JDK

### Optional: Bazel Build System

- **Bazel** (if using Bazel build method)
  - Install: https://bazel.build/install
  - Version 6.0 or higher recommended

## Build Method 1: Using Bazel (Recommended)

Bazel provides a clean, reproducible build process.

### Setup

```bash
cd android
```

### Configure Android SDK Path

Set the `ANDROID_HOME` environment variable:

```bash
export ANDROID_HOME=/path/to/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
```

### Build

```bash
# Build the APK
bazel build //app:rep_plus

# Install to connected device
bazel mobile-install //app:rep_plus

# Build debug APK
bazel build //app:rep_plus --compilation_mode=dbg

# Build release APK (requires keystore)
bazel build //app:rep_plus --compilation_mode=opt
```

The APK will be located at:
```
bazel-bin/app/rep_plus.apk
```

## Build Method 2: Manual Build with Android SDK Tools

This method uses Android SDK command-line tools directly without Gradle or Bazel.

### Step 1: Set Environment Variables

```bash
export ANDROID_HOME=/path/to/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/build-tools/33.0.0:$ANDROID_HOME/platform-tools
```

### Step 2: Compile Kotlin Source Files

```bash
cd android/app

# Create output directories
mkdir -p build/classes
mkdir -p build/gen

# Generate R.java from resources
aapt2 compile --dir src/main/res -o build/compiled_resources.zip

aapt2 link \
  -o build/app-unaligned.apk \
  -I $ANDROID_HOME/platforms/android-33/android.jar \
  --manifest src/main/AndroidManifest.xml \
  --java build/gen \
  build/compiled_resources.zip

# Compile Kotlin sources
kotlinc \
  -classpath $ANDROID_HOME/platforms/android-33/android.jar \
  -d build/classes \
  src/main/kotlin/com/rep/plus/*.kt \
  src/main/kotlin/com/rep/plus/network/*.kt \
  src/main/kotlin/com/rep/plus/storage/*.kt \
  src/main/kotlin/com/rep/plus/utils/*.kt \
  build/gen/com/rep/plus/R.java
```

### Step 3: Convert to DEX

```bash
# Convert compiled classes to DEX format
d8 --lib $ANDROID_HOME/platforms/android-33/android.jar \
   --output build/dex \
   build/classes/**/*.class \
   /path/to/kotlin-stdlib.jar
```

### Step 4: Package APK

```bash
# Create APK structure
mkdir -p build/apk/lib
mkdir -p build/apk/assets

# Copy DEX files
cp build/dex/classes.dex build/apk/

# Copy assets
cp -r src/main/assets/* build/apk/assets/

# Package APK
cd build/apk
zip -r ../app-unsigned.apk .
cd ../..

# Align APK
zipalign -v -p 4 build/app-unsigned.apk build/app-unsigned-aligned.apk
```

### Step 5: Sign APK

#### Generate Debug Keystore (if needed)

```bash
keytool -genkey -v \
  -keystore debug.keystore \
  -alias androiddebugkey \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass android \
  -keypass android
```

#### Sign APK

```bash
apksigner sign \
  --ks debug.keystore \
  --ks-key-alias androiddebugkey \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out build/app-debug.apk \
  build/app-unsigned-aligned.apk
```

The final APK is at: `build/app-debug.apk`

## Build Method 3: Using Android Studio (Easiest)

While this project doesn't use Gradle by default, you can import it into Android Studio:

1. Open Android Studio
2. Choose "Import Project (Gradle, Eclipse ADT, etc.)"
3. Select the `android` directory
4. Android Studio will detect it as a non-Gradle project
5. Configure the project structure manually:
   - Set SDK location
   - Configure build paths
   - Add Kotlin support

Then build using: **Build > Build Bundle(s) / APK(s) > Build APK(s)**

## Installation

### Install via ADB

```bash
adb install -r build/app-debug.apk
```

### Install Manually

1. Enable "Unknown Sources" in Android Settings
2. Transfer APK to device
3. Open APK file to install

## Post-Installation Setup

### Install PCAPdroid

rep+ requires PCAPdroid to capture network traffic:

1. Install from F-Droid: https://f-droid.org/packages/com.emanuelef.remote_capture/
2. Or from Google Play Store
3. Grant VPN permissions to PCAPdroid when prompted

### First Run

1. Launch rep+
2. Grant necessary permissions
3. Tap "Start Capture" button
4. PCAPdroid will prompt for VPN permission
5. Allow the permission and start capturing traffic

## Troubleshooting

### Bazel Issues

**Error: "Cannot find Android SDK"**
```bash
# Create/edit .bazelrc
echo "build --android_sdk=@androidsdk//:sdk" >> .bazelrc
```

### Manual Build Issues

**Error: "kotlinc: command not found"**
```bash
# Install Kotlin compiler
# On Ubuntu/Debian:
sudo snap install kotlin --classic

# Or download manually:
wget https://github.com/JetBrains/kotlin/releases/download/v1.9.0/kotlin-compiler-1.9.0.zip
unzip kotlin-compiler-1.9.0.zip
export PATH=$PATH:$PWD/kotlinc/bin
```

**Error: "aapt2: not found"**
```bash
# Install Android build tools
sdkmanager "build-tools;33.0.0"
```

### Runtime Issues

**Error: "PCAPdroid not installed"**
- Install PCAPdroid from F-Droid or Play Store

**Error: "VPN permission denied"**
- Grant VPN permission when PCAPdroid prompts
- Check Android Settings > VPN > PCAPdroid

## Development

### Project Structure

```
android/
├── WORKSPACE              # Bazel workspace config
├── app/
│   ├── BUILD.bazel       # Bazel build config
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml
│           ├── kotlin/
│           │   └── com/rep/plus/
│           │       ├── MainActivity.kt
│           │       ├── network/       # Network capture & HTTP client
│           │       ├── storage/       # SQLite database
│           │       └── utils/         # PCAPdroid helper
│           ├── res/                   # Android resources
│           └── assets/
│               └── web/               # WebView UI (HTML/CSS/JS)
```

### Architecture

- **WebView UI**: Existing Chrome extension UI runs in WebView
- **Android Bridge**: JavaScript bridge provides native functionality
- **PCAPdroid Integration**: Captures network traffic via UDP
- **HTTP Client**: Replays requests using HttpURLConnection
- **SQLite Database**: Stores captured requests

## References

- Bazel Android Tutorial: https://bazel.build/start/android-app
- PCAPdroid API: https://github.com/emanuele-f/PCAPdroid/blob/master/docs/app_api.md
- Android Command-line Tools: https://developer.android.com/studio/command-line
