# Changelog

All notable changes to this project will be documented in this file.

This project uses [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-06-16

### Features

- **Tempo / metronome popup** — Reusable BPM control with numeric input, slider, tap tempo (averages last 4 taps), and toggleable metronome (Web Audio wood block click). Accessible from header BPM display, delay detail, modulation detail, and global settings.
- **Clear All Snapshots** — Data Management section in Settings with button to wipe all saved snapshots
- **Mobile remote control via QR code** — Share button in header generates a QR code for phone pairing. Phone connects via Firebase Realtime Database relay — no login required. Full state sync, slider drag optimization, automatic reconnection.
- **Google sign-in + cloud snapshots** — Optional login via Firebase Auth. When signed in, snapshots sync to Firestore for cross-device access. Works offline via Firestore persistence. First login migrates existing localStorage snapshots to cloud.

### Fixed

- **Snapshot dirty state on preset switch** — Snapshots no longer show as unsaved/dirty when switching presets. Fixed race condition where stale params from the previous preset's `_fireSync` were incorrectly compared against the new preset's snapshot.

## [1.0.0] - 2026-06-15

First official release. Browser-based parameter editor for the TONEX ONE pedal.

### Features

- **WebSerial communication** — Direct browser-to-pedal USB connection via Chrome/Edge, replacing the original Python/FastAPI backend
- **Signal chain view** — Visual signal chain with effect block cards showing on/off status, pre/post position, model name, and key parameter summaries
- **Detail editing** — Full parameter controls for all 8 effect blocks (noise gate, compressor, EQ, amplifier, cabinet, modulation, delay, reverb) plus global settings (master volume, BPM, input trim, tuning reference, bypass)
- **EQ visualization** — Interactive frequency response curve with separate bass/mid/treble band overlays, reset-to-saved and reset-to-defaults buttons
- **Delay visualization** — Animated delay timeline with impulse decay, ping pong mode lanes, tempo sync beat markers, and real-time playback cursor
- **Cabinet mic placement** — Draggable 2D mic pads for positioning two virtual microphones on the speaker, with mic type selection (Condenser 414, Dynamic 57, Ribbon 121) and blend control
- **Model-level snapshots** — Auto-save and recall parameter snapshots per tone model, dirty-state tracking with save prompts on preset switch
- **A/B comparison** — Side-by-side snapshot comparison with spacebar toggle and per-section parameter diff display grouped by effect block
- **Preset metadata import** — Import tone model metadata (character, amp based on, cab based on) from Tonex Editor via TSV file upload or paste; displayed in preset dropdown and signal chain header
- **Sync progress UI** — Real-time "Syncing preset 3 / 20..." indicator during initial connection
- **Settings page** — My Rig description fields, preset metadata import, About section with usage instructions, data policy, and credits
- **GitHub Pages hosting** — Static site at tonex.markbuilds.ca with custom domain via CNAME
- **Cloudflare Web Analytics** — Cookie-free page visit measurement

### Technical

- HDLC framing with CRC-16-CCITT over WebSerial (USB VID 0x1963, PID 0x00D1)
- 20 onboard presets, 109 per-preset parameters + 7 global parameters
- All data stored in browser localStorage — no server, no accounts
- Tailwind CSS via CDN, no build step

### Pre-1.0 history

The project began as a Python/FastAPI app with an AI tone assistant. The AI features were deprioritized (too expensive and unreliable for real-time use), and the entire backend was replaced with a static JavaScript site using the WebSerial API for direct browser-to-pedal communication.
