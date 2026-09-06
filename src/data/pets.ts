export type Pet = {
  slug: string;
  name: string;
  description: string;
  category: string;
  style: "2d" | "3d";
  gen: number;
  pokedex_id: number;
};

export type PetsFile = {
  version: number;
  total: number;
  pets: Pet[];
  license_note?: string;
};

const SPRITE_BASE =
  "https://raw.githubusercontent.com/dnnyngyen/codex-pokepets/main/pets";

export function spritesheetUrl(slug: string) {
  return `${SPRITE_BASE}/${slug}/spritesheet.webp`;
}

export function previewUrl(slug: string) {
  return `${SPRITE_BASE}/${slug}/preview.gif`;
}

export async function loadPets(): Promise<Pet[]> {
  const res = await fetch("/data/pets.json");
  if (!res.ok) throw new Error(`pets.json HTTP ${res.status}`);
  const data = (await res.json()) as PetsFile;
  return [...data.pets].sort((a, b) => a.pokedex_id - b.pokedex_id);
}

export function padId(id: number) {
  return String(id).padStart(3, "0");
}
