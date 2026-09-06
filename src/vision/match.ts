import type { Pet } from "../data/pets";
import { LABEL_SLUG_OVERRIDES } from "./labels";

function baseSlug(label: string): string {
  const override = LABEL_SLUG_OVERRIDES[label];
  if (override) return override;
  return label
    .toLowerCase()
    .replace(/[''.]/g, "")
    .replace(/\s+/g, "-")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m");
}

/**
 * Map a Cosmidex species label → a pet in our list.
 * Prefers Gen-1 2D base forms (same style as the default Pokédex ordering).
 */
export function findPetForLabel(pets: Pet[], label: string): Pet | null {
  const slug = baseSlug(label);
  const nameLower = label.toLowerCase();

  const candidates = pets.filter((p) => {
    if (p.category !== "pokemon") return false;
    if (p.slug === slug || p.slug === `${slug}-3d`) return true;
    return p.name.toLowerCase() === nameLower;
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const score = (p: Pet) =>
      (p.gen === 1 ? 0 : 10) +
      (p.style === "2d" ? 0 : 1) +
      (p.slug.endsWith("-3d") ? 1 : 0) +
      p.pokedex_id / 10000;
    return score(a) - score(b);
  });

  return candidates[0];
}

/** Index of `pet` inside the currently visible list (after gen filter). */
export function indexOfPet(visible: Pet[], pet: Pet): number {
  const bySlug = visible.findIndex((p) => p.slug === pet.slug);
  if (bySlug >= 0) return bySlug;
  return visible.findIndex((p) => p.pokedex_id === pet.pokedex_id);
}
