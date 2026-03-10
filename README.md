# Minecraft Browser Edition — Multiplayer

A browser-based Minecraft clone with enhanced graphics and local multiplayer.

## Requirements
- [Node.js](https://nodejs.org) (v16 or newer)

## Quick Start

### Windows
Double-click `start.bat`

### Mac / Linux
```bash
chmod +x start.sh
./start.sh
```

### Manual
```bash
npm install
node server.js
```

Then open **http://localhost:3000** in your browser.

## Multiplayer on LAN

1. Start the server on one PC
2. Find your local IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
3. Other players on the same network open: `http://YOUR_IP:3000`
4. Up to **8 players** can join at once

## Controls

| Key | Action |
|-----|--------|
| W A S D | Move |
| Space | Jump |
| Shift | Sneak |
| F | Toggle fly mode |
| Left Click | Break block |
| Right Click | Place block |
| Scroll / 1–9 | Select hotbar slot |
| T | Open chat |
| ESC | Pause |

## Graphics Improvements

- **Procedural block textures** — every block type has unique pixel-art noise patterns
- **Per-face shading** — top/side/bottom faces have distinct tones for depth
- **Vertex AO** — soft ambient occlusion darkens block corners
- **Multiple light sources** — directional sun + fill light + ambient
- **Screen vignette** — subtle depth effect at edges
- **Better fog** — distance fog matches sky color
- **Larger render distance** — 4 chunks radius (vs 3 before)
