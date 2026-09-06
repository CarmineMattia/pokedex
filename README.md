# Pokédex GBA (MVP)

Vite + TypeScript + Three.js handheld Pokédex.

## Run

```bash
cd pokedex
npm install
npm run dev -- --port 5174 --host
```

Open http://localhost:5174

On load, a short GBA-style power-on splash (screen glow → logo → fade) plays, then the Pokédex UI unlocks for keyboard and touch controls.

## Controls

| Input | Action |
|-------|--------|
| ↑↓ / W S / D-pad | Move in list |
| ←→ / A D / drag sprite | Rotate sprite |
| Enter / Z / A btn | Reload / confirm |
| Esc / X / B btn | Jump to #001 |
| Shift / START | Cycle Gen filter |
| Ctrl / SELECT | Clear filter (short press) |
| Hold SELECT (~650ms) | Mute / unmute SFX |

8-bit Web Audio blips play on every D-pad / A / B / START / SELECT press (keyboard and on-screen), list taps, and sprite rotate (←→ or drag). Audio unlocks on the first user gesture (browser autoplay rules).

On-screen GBA buttons use pointer events (mouse + touch). Drag horizontally on the 3D stage to rotate. Tap list rows to select; the list scrolls with touch.

## Data

`public/data/pets.json` from [codex-pokepets](https://github.com/dnnyngyen/codex-pokepets). Sprites load from GitHub raw (needs network).
