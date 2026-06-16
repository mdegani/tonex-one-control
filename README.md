# Tonex One Control

A browser-based editor for the IK Multimedia TONEX ONE guitar pedal. Connect via USB, tweak every parameter, and save snapshots — no install required.

**Try it live at [tonex.markbuilds.ca](https://tonex.markbuilds.ca)**

## How it works

Plug your TONEX ONE into your computer with a USB cable, open the site in Chrome or Edge, and click Connect. The app talks directly to the pedal using the WebSerial API — there's no server, no backend, no software to install.

- Browse and switch between all 20 onboard presets
- Adjust every effect parameter: noise gate, compressor, EQ, amp model, cabinet, modulation, delay, reverb
- Tweak global settings: master volume, BPM, bypass, tuning reference
- Save and recall parameter snapshots per model
- Drag-to-position virtual mic placements on the cabinet

All settings are saved in your browser's local storage. Your data stays on your machine.

## Requirements

- A TONEX ONE pedal connected via USB
- Chrome or Edge (WebSerial is not supported in Safari or Firefox)

## Development

```bash
npm install
npm run dev    # serves on localhost:8080
npm test       # runs the test suite
```

## Acknowledgments

The USB serial protocol implementation is based on the reverse-engineering work done by [Builty](https://github.com/Builty) in the [TonexOneController](https://github.com/Builty/TonexOneController) project. That project figured out the HDLC framing, message types, and parameter mappings that make this kind of tool possible.

## Trademarks

TONEX, TONEX ONE, and AmpliTube are trademarks or registered trademarks of [IK Multimedia](https://www.ikmultimedia.com). This project is not affiliated with, endorsed by, or sponsored by IK Multimedia.
