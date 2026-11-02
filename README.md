# Essential Key Remapper

Give the Essential key of a Nothing phone a new job. Plug the phone into a Windows PC, pick what the key does, and you're done.

- **Press**, **double press** and **hold** can each get their own action: flashlight, camera, screenshot, assistant, lock screen, notifications, quick settings, recent apps, power menu, play/pause, next track, vibrate mode, Do not disturb, or any app.
- Changes reach the phone right away. The phone keeps working without the PC.
- The window mirrors the real key: press it and you see what it triggered.
- One click brings Essential Space back.

## Using it

1. On the phone, turn on USB debugging (Settings › About phone › tap Build number 7 times, then Settings › System › Developer options › USB debugging).
2. Run `essential-key-remapper.exe` and plug in the phone. Allow the computer on the phone.
3. Click **Set up**, press the Essential key once, then pick your actions.

On first run the app downloads Google's Android platform tools (about 7 MB) unless adb is already installed. Windows 10 or 11 with the WebView2 runtime is required (it ships with Windows 11).

## How it works

Setup does what the community guides do by hand, over adb:

- installs a tiny companion app (`com.ekremapper.companion`, about 45 KB, no internet permission),
- turns off `com.nothing.ntessentialspace` and `com.nothing.ntessentialrecorder` with `pm disable-user` (they are not uninstalled),
- enables the companion's accessibility service through `settings put secure enabled_accessibility_services`, so nothing has to be toggled on the phone.

The accessibility service only filters the Essential key (recognised by its scan code, since it reports key code 0) and lets every other key through. The desktop app talks to the companion through a content provider that only answers `adb shell`, and follows key presses live through `logcat`.

**Bring back Essential Space** re-enables both Nothing packages, removes the service and, if you want, uninstalls the companion.

### Limits

- Like any accessibility service, the key is not caught while the screen is off.
- *Do not disturb* needs notification policy access; setup grants it with `cmd notification allow_dnd`.

## Building

`build.bat` builds everything on Windows. It needs the Android SDK, a JDK 17+ (Android Studio's JBR is picked up automatically), Rust with the MSVC toolchain and Node.js.

The release APK is signed with the key described in `android/keystore.properties` (not in the repo):

```
storeFile=ekr-release.jks
storePassword=…
keyAlias=ekr
keyPassword=…
```

Keep that key: a companion signed with another key cannot update an installed one.

Layout:

- `android/` – companion app (Kotlin, no dependencies)
- `desktop/` – Windows app (Tauri 2: Rust backend in `src-tauri/`, React UI in `src/`)

To preview the UI in a browser without a phone, run `npm run dev` in `desktop/` and open `http://localhost:1420/?scene=ready` (scenes: `tools`, `connect`, `unauthorized`, `nokey`, `setup`, `learn`, `ready`, `flash`).
