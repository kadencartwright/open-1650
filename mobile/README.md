# Open 1650 for Android

React Native 0.85.3 app for Android 10 and later, built for ARM64 phones and
x86-64 emulators. The APK includes all 150 Psalms, 13 alternate versions,
27 SATB tunes, and 163 lyric settings. A network connection is only needed
for Sing together and external source links.

The native shell provides the searchable Psalm/version picker, app navigation,
safe areas, persistent last selection, Android sharing, and file saving into
`Downloads/Open1650`. The bundled React singing interface runs in Android
WebView and uses the same audio engine, lyrics, transposition, sourced tempo
references, MIDI exporter, and autoplay queue as the website. A loopback-only
asset server serves the bundled ES modules; no Metro or remote website is
needed by the release APK.

## Build

Install Node 22.12+ and Java 17, and configure the Android SDK (API 36,
build-tools 36.0.0, NDK 27.1.12297006). Set `ANDROID_HOME` or create the ignored
`android/local.properties` with `sdk.dir=/absolute/path/to/Android/Sdk`.

```sh
# Repository root
npm ci
cd mobile
npm ci
npm run apk
```

The APK is `android/app/build/outputs/apk/release/app-release.apk`. The asset
build always rebuilds the shared player first. It generates an offline asset
folder and the native search catalog from the checked-in corpus.

On the first build, `npm run signing` creates a private local RSA release key.
Preserve **both** `android/app/open1650-release.keystore` and
`android/release-signing.properties` for future updates. Both are ignored by
Git; never commit them. Later builds reuse that key. Debug and release builds
use different keys, so remove a debug install before installing a release APK.

## Development and validation

```sh
npm run assets      # Rebuild player and native search catalog
npm run typecheck
npm start          # Metro for debug builds only
npm run android
# Repository root
npm run check
```

Use the emulator to check offline launch, native search and alternate versions,
SATB playback, lyric highlighting, seek/restart/pause, tempo and its reset,
all transposition steps, verse looping, automatic Psalm progression, the
three text export formats, MIDI export, file sharing, background pause, and
last-selection restoration. Sing together uses the existing production relay
at `wss://1650.kdn.dev/api/sync`; it requires internet access.

## Playback behavior

Open **More playback options** (the ellipsis beside the player) for tempo,
transposition, autoplay, looping, group singing, volume, and MIDI export.
Transposition moves all four parts together from -12 through +12 semitones
and also changes exported MIDI. Changing pitch restarts the current Psalm.

Autoplay advances from the current Psalm to the next primary version and
stops after Psalm 150. Start at Psalm 1 to sing the entire primary Psalter.
Verse looping takes priority. Autoplay is disabled during a singing group;
transposition follows the group leader. Playback pauses when the app moves
to the background; while playing in the foreground, Android keeps the screen
awake. This release does not implement a background audio service.

Tempo provenance is in `../corpus/sources/tempo-references.json`. Every tune
has either an explicit source tempo or an honest provisional fallback; two
exact Psalm/tune combinations use documented recording-derived estimates.
Custom tempo choices are remembered per Psalm version and tune.

The `ios` target is not provided in this Android-only release.

## Verified build

Validated on the Android 16 / API 36 emulator with a signed release APK:
offline launch and restoration of the selected Psalm, native full-text search,
Psalm-specific tempo and transposition selection, active audio output, all
four SATB tracks in an exported +12-semitone MIDI file at 68 BPM, TXT/JSON/TEI
saving in airplane mode, and Android's file share chooser. The shared tests
exercise progression through all 150 primary Psalms, terminal stopping, and
verse-loop priority; browser verification also exercised real automatic
advancement and playback with transposition retained.
A two-device session between the Android host and the existing live web app
also verified group discovery, remote Psalm selection, the host's 68 BPM
tempo, and transport delivery through the production relay. The test group
was ended after verification.

## 1.0.1 — Android lyric scrolling

The native reader now has one bounded scroll area. Lyric following animates
that area directly and centers the current line above the fixed player,
including when seeking while paused. Restart returns to the opening text even
if playback is already at zero. Android 16 emulator verification covered
natural progression across multiple verses, paused seeks, and restart;
regression tests cover wrapped lines, player overlap, scroll boundaries,
reduced motion, and cancellation when the target changes.
