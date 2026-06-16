# CLAUDE.md

## Project

Tonex One Control — a browser-based parameter editor for the IK Multimedia TONEX ONE guitar pedal. Static site hosted on GitHub Pages at tonex.markbuilds.ca.

## Architecture

- No build step, no framework. Vanilla JavaScript with Tailwind CSS (CDN).
- `tonex.js` — WebSerial protocol layer (HDLC framing, CRC-16-CCITT, USB serial communication)
- `app.js` — All UI logic (signal chain, detail views, snapshots, A/B comparison, settings)
- `index.html` — Single page, loads scripts directly
- Browser communicates directly with pedal via WebSerial API. No server or backend.
- State is a single global object; localStorage persists snapshots, rig data, and preset metadata.

## Development

```bash
npm run dev    # serves on localhost:8080
npm test       # runs the test suite (node --test)
```

## Conventions

- Vanilla JS, no TypeScript, no build tools, no bundler
- Global scope — all files share the same namespace via `<script>` tags
- Tailwind utility classes for styling via CDN
- HTML rendered via template literals in JS functions
- Keep files focused: tonex.js for protocol, app.js for UI

## Versioning

This project uses **semantic versioning** (semver). All changes are tracked in `CHANGELOG.md`.

- Update CHANGELOG.md with every feature, fix, or notable change
- Group changes under the next version heading while in development
- When a version is released, set the date and create a git tag (e.g., `v1.0.0`)
- MAJOR: breaking changes to saved data format or USB protocol handling
- MINOR: new features, new UI sections
- PATCH: bug fixes, polish, test additions

## Testing

- Node.js built-in test runner (`node --test`)
- `test/tonex.test.js` — protocol layer (CRC, HDLC framing, float conversion, message builders, param definitions)
- `test/app.test.js` — UI logic (formatting, state helpers, signal chain routing, EQ math, delay impulses, snapshots, A/B comparison, preset metadata import)
- Tests run in a `vm` sandbox with mocked DOM/browser globals
- Focus on pure logic functions; don't attempt to test DOM rendering directly

## WebSerial Protocol

- USB VID `0x1963`, PID `0x00D1`, baud `115200`, 8N1
- HDLC framing with FLAG `0x7E`, ESCAPE `0x7D`, byte stuffing
- CRC-16-CCITT for frame integrity
- State machine: IDLE → HELLO → GET_STATE → SYNCING → READY
- Key sync ordering: GETSYNCCOMPLETE → GETPRESETNAMES → GETPRESET → GETPARAMS (order matters — GETPRESET must fire before GETPARAMS for snapshot loading)
- 20 onboard presets, 109 per-preset parameters + 7 global parameters
