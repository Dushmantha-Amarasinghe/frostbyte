# Frostbyte

> Fast video compression for Windows — powered by FFmpeg with hardware acceleration.

Frostbyte is a desktop video compressor built for people who need real results fast. It uses the full GPL FFmpeg build, so you get every encoder — NVENC, Quick Sync, AMF, x264, x265, VP9, AV1 — and every setting. The interface stays out of your way: pick a preset and hit Compress, or go deep with the advanced panel if you need it.

## Features

- **Hardware acceleration** — NVIDIA NVENC, Intel Quick Sync, and AMD AMF auto-detected at startup
- **Watch Folders** — drop files in a folder and Frostbyte compresses them automatically
- **Queue** — batch multiple files, see live fps / speed / ETA per job
- **Advanced settings** — full FFmpeg surface: codec, rate control, filters, audio, two-pass, raw args
- **Output config** — custom save location and filename templates (`{name}`, `{date}`, `{codec}`, `{res}`)
- **System tray** — keep it running in the background with a tray icon
- **Command preview** — the exact FFmpeg command shown before it runs

## Download

Head to the [Releases](https://github.com/Dushmantha-Amarasinghe/frostbyte/releases) page and grab the latest installer or portable `.exe`.

> **FFmpeg is not bundled in the repo** (GPL binary, ~100 MB). The release builds include it. If you're building from source, download a full GPL Windows build from [ffmpeg.org](https://ffmpeg.org/download.html) and put `ffmpeg.exe` + `ffprobe.exe` in `resources/ffmpeg/`.

## Build from source

```bash
git clone https://github.com/Dushmantha-Amarasinghe/frostbyte.git
cd frostbyte
npm install

# dev
npm run dev

# package (NSIS installer + portable)
npm run build:win
```

Requires Node 20+ and Windows (NVENC/QSV/AMF detection is Windows-only).

## Stack

- Electron 39 + electron-vite
- React + TypeScript + Tailwind CSS
- Zustand for state
- better-sqlite3 for the Watch Folders ledger
- Framer Motion for transitions
- FFmpeg (GPL) for the heavy lifting

## Support

If Frostbyte saves you time, a coffee keeps development going.

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-%E2%98%95-FFDD00?style=flat-square&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/dushmantha)

## License

MIT — do whatever you want with the source. The bundled FFmpeg binaries are [GPL licensed](https://ffmpeg.org/legal.html).

---

Made by [Dushmantha Amarasinghe](https://github.com/Dushmantha-Amarasinghe)
