// WoW item rarity → CSS class (colors live in bidding.css) + Wowhead links.
const QUALITIES = ['poor', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'artifact', 'heirloom']

export function itemQualityClass(quality?: string | null) {
  const q = (quality || '').toLowerCase()
  return QUALITIES.includes(q) ? `quality-${q}` : 'quality-epic'
}

// Wowhead's tooltip script attaches a hover card to any /tbc/item= link.
export function wowheadItemUrl(itemId?: number | null) {
  return itemId ? `https://www.wowhead.com/tbc/item=${itemId}` : ''
}
