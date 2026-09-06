# Pokédex GBA (MVP)

Vite + TypeScript + Three.js handheld Pokédex.

## Run

```bash
cd pokedex
npm install
npm run dev -- --port 5174 --host
```

Open http://localhost:5174

## Controls

| Input | Action |
|-------|--------|
| ↑↓ / W S / D-pad | Move in list |
| ←→ / A D | Rotate sprite |
| Enter / Z / A btn | Reload / confirm |
| Esc / X / B btn | Jump to #001 |
| Shift / START | Cycle Gen filter |
| Ctrl / SELECT | Clear filter |

## Data

`public/data/pets.json` from [codex-pokepets](https://github.com/dnnyngyen/codex-pokepets). Sprites load from GitHub raw (needs network).
