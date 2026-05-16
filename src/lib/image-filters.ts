/* ── Custom Image Filters ──────────────────────────────────────── */

export interface ImageFilter {
  id: string
  name: string
  css: string
  emoji: string
}

/**
 * A curated set of filters for enhancing photos.
 * `css` is a valid CSS filter string — can be used both as a CSS `filter`
 * property on <img> elements (for live preview) and as `CanvasRenderingContext2D.filter`
 * when baking the filter into a compressed JPEG via canvas.
 */
export const IMAGE_FILTERS: ImageFilter[] = [
  { id: 'normal',   name: 'Normal',   css: 'none', emoji: '📷' },
  { id: 'bright',  name: 'Bright',   css: 'contrast(1.2) saturate(1.35)', emoji: '☀️' },
  { id: 'vintage', name: 'Vintage',  css: 'brightness(1.05) hue-rotate(-10deg)', emoji: '🌿' },
  { id: 'lunar',   name: 'Lunar',    css: 'grayscale(1) contrast(1.1) brightness(1.1)', emoji: '🌙' },
  { id: 'dawn',    name: 'Dawn',     css: 'brightness(1.15) contrast(0.9) saturate(1.2)', emoji: '🐦' },
  { id: 'warm',    name: 'Warm',     css: 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)', emoji: '🎞️' },
  { id: 'vibrant', name: 'Vibrant',  css: 'contrast(1.15) saturate(1.8) brightness(1.1)', emoji: '🌸' },
  { id: 'haze',    name: 'Haze',     css: 'saturate(0.66) brightness(1.05) sepia(0.15)', emoji: '😴' },
  { id: 'cream',   name: 'Cream',    css: 'contrast(0.9) brightness(1.05) saturate(0.9) sepia(0.1)', emoji: '☕' },
  { id: 'crystal', name: 'Crystal',  css: 'contrast(1.05) saturate(1.2) brightness(1.05)', emoji: '🏰' },
  { id: 'dusk',    name: 'Dusk',     css: 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)', emoji: '🌊' },
  { id: 'evergreen', name: 'Evergreen', css: 'contrast(1.1) brightness(1.25) saturate(1.1)', emoji: '🌲' },
  { id: 'retro',   name: 'Retro',    css: 'sepia(0.25) contrast(1.15) brightness(1.05) saturate(1.2)', emoji: '🎸' },
  { id: 'golden',  name: 'Golden',   css: 'sepia(0.15) brightness(1.1) contrast(1.1)', emoji: '🌅' },
]

export function getFilterById(id: string): ImageFilter {
  return IMAGE_FILTERS.find((f) => f.id === id) ?? IMAGE_FILTERS[0]
}
