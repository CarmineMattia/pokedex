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
| Eye button (top-right) | Toggle 360° console inspect / orbit |
| Esc / B while inspecting | Exit inspect mode |

### 360° inspect

Tap the **eye** control (top-right) to enter inspect mode: drag to orbit the whole GBA shell (Three.js CSS3D + OrbitControls). Gameplay inputs on the LCD and buttons are paused until you exit (eye again, Esc, or B). Play mode keeps the live 2D UI usable on the front face.

8-bit Web Audio blips play on every D-pad / A / B / START / SELECT press (keyboard and on-screen), list taps, FIND typing, and sprite rotate (←→ or drag). Audio unlocks on the first user gesture (browser autoplay rules).

On-screen GBA buttons use pointer events (mouse + touch). Drag horizontally on the 3D stage to rotate. Tap list rows to select; the list scrolls with touch.

## Camera scan (Cosmidex WIP)

Optional Gen-1 camera recognition lives under `src/vision/` (TensorFlow.js + Cosmidex labels). Modules are included for future CAM wiring; weights are **not** committed.

## Data

`public/data/pets.json` from [codex-pokepets](https://github.com/dnnyngyen/codex-pokepets). Sprites load from GitHub raw (needs network).

## Credits

- Cosmidex Gen-1 recognition model & label list — [Ansh9045/Cosmidex](https://github.com/Ansh9045/Cosmidex)
- Pet data / sprites — [codex-pokepets](https://github.com/dnnyngyen/codex-pokepets) / PokeAPI community sources (see `pets.json` license note)
