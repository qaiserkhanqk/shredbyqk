# Shred by QK as an iPhone and Android app

The same web app, wrapped as a store app with [Capacitor](https://capacitorjs.com). Everything works as on the website, plus a native **pulse camera** for Body check:

| | Website (Safari / Chrome) | Native app |
|---|---|---|
| Flash on iPhone | ❌ Safari can't turn it on | ✅ |
| Frame rate | 30 fps (60 on some Androids) | up to 120–240 fps on recent iPhones, usually 60 on Android |
| Exposure / colour locked during a reading | Android Chrome only | ✅ both |

Higher frame rates time each heartbeat more finely, which is what HRV needs. In our fake-camera tests, going from 30 to 60 fps already brought very low HRV closer to the truth.

**Status:** the plugin code (`native/ios/PulseCameraPlugin.swift`, `native/android/PulseCameraPlugin.kt`) is written but **has not been compiled or run yet**. iPhone apps can only be built on a Mac with Xcode, and the build environment where this was written has neither Xcode nor the Android SDK. Build it on a real device and check a reading against a chest strap (Body check → *Check it against a chest strap*) before releasing.

The JavaScript side is already in the app: `js/vitals.js` uses the plugin automatically when it's running inside the native app, and the web camera otherwise.

## What you need
- **iPhone:** a Mac with Xcode, an Apple Developer account (£79/year) for TestFlight and the App Store.
- **Android:** Android Studio, a Google Play developer account (one-off $25).
- Node.js 20+.

## One-time setup
```bash
npm install -D @capacitor/cli@7 @capacitor/core@7 @capacitor/ios@7 @capacitor/android@7
node tools/build-native-web.mjs
npx cap add ios
npx cap add android
```
`capacitor.config.json` (app id `com.shredbyqk.app`) is already in the repo root.

### iPhone
1. Copy `native/ios/PulseCameraPlugin.swift` into `ios/App/App/` and add it to the **App** target in Xcode.
2. Register it. Create `ios/App/App/MainViewController.swift`:
   ```swift
   import Capacitor
   class MainViewController: CAPBridgeViewController {
       override open func capacitorDidLoad() { bridge?.registerPluginInstance(PulseCameraPlugin()) }
   }
   ```
   In `Main.storyboard`, set the Bridge View Controller's **Custom Class** to `MainViewController`.
3. In `ios/App/App/Info.plist` add **Privacy – Camera Usage Description**: "Shred uses the camera to check your form and to read your pulse from your fingertip. Video never leaves your phone." Also add **Privacy – Microphone Usage Description** if you use the voice Studio.
4. `npx cap open ios`, choose your team under Signing, run on a real iPhone (the simulator has no camera).

### Android
1. Copy `native/android/PulseCameraPlugin.kt` into `android/app/src/main/java/com/shredbyqk/app/`.
2. Register it in `MainActivity` (same folder):
   ```kotlin
   class MainActivity : BridgeActivity() {
       override fun onCreate(savedInstanceState: Bundle?) {
           registerPlugin(PulseCameraPlugin::class.java)
           super.onCreate(savedInstanceState)
       }
   }
   ```
   (If `MainActivity` is Java, write `registerPlugin(PulseCameraPlugin.class);` before `super.onCreate`.)
   Kotlin must be enabled in the app module; Android Studio offers to add it when you open a `.kt` file.
3. `android/app/src/main/AndroidManifest.xml` needs `<uses-permission android:name="android.permission.CAMERA" />` and `<uses-permission android:name="android.permission.RECORD_AUDIO" />` (voice Studio).
4. `npx cap open android` and run on a real phone.

## Every time the web app changes
```bash
node tools/build-native-web.mjs
npx cap sync
```

## Checking it works
1. Body check → Heart rate. The camera preview is hidden in the native app; the flash should come on and the *Signal* line should show the frame rate (e.g. `240 fps`).
2. Turn on **Check it against a chest strap**, wear a Polar H10 (or similar) and take 10+ HRV readings over a few mornings, typing in the strap's number each time.
3. Export the comparisons and run `npm run validate shred-camera-vs-strap-….csv` for bias, typical error and agreement (ICC). Turn on the correction if it helps.

## Steps (Apple Health / Health Connect)

`native/ios/StepsPlugin.swift` and `native/android/StepsPlugin.kt` give the Food tab each day's step count. QK's weekly report uses it (a walk suggestion, and a check on the "How active" setting). Like the pulse camera, they **have not been compiled yet**. On the web the client types their steps in.

**iPhone:**
1. Add `StepsPlugin.swift` to the App target.
2. Register it next to the pulse camera: `bridge?.registerPluginInstance(StepsPlugin())`.
3. In *Signing & Capabilities*, add **HealthKit**.
4. In `Info.plist`, add `NSHealthShareUsageDescription` ("Shred reads your daily steps to plan your food and training.").

**Android:**
1. Add `implementation "androidx.health.connect:connect-client:1.1.0"` to `app/build.gradle`.
2. Copy `StepsPlugin.kt` into `android/app/src/main/java/com/shredbyqk/app/`.
3. Register it in `MainActivity` with `registerPlugin(StepsPlugin::class.java)`.
4. Add `<uses-permission android:name="android.permission.health.READ_STEPS"/>` to the manifest.
5. Ask for the permission once from `MainActivity` with `PermissionController.createRequestPermissionResultContract()`. The plugin only reads, and returns "permission" until it's granted.

Check a day's count against the Health / Fit app before release.
