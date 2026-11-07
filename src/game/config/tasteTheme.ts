/**
 * TasteTheme (`design-taste-frontend` / `taste-skill` Design Token System)
 * ------------------------------------------------------------------------
 * Follows `system.md`, `layout-v4.md`, `cards.md`, `motion.md`, and `palettes.json`:
 * - 90-95% warm neutral surfaces (dark espresso cabinet + warm cream paper cards).
 * - Single primary brand accent (`accent`: Vietnamese street-food vermilion/amber `#d9381e` / `#e85d04`).
 * - Strict NO-VIOLET / NO-PURPLE rule (`#9d4edd` completely removed across the entire codebase).
 * - 1px subtle hairline borders (`10-14%` of ink/surface contrast) instead of heavy cartoon double boxes.
 * - Cohesive typographic scale and Cubic.easeOut (`cubic-bezier(.2,.8,.2,1)`) micro-interactions.
 */

export const TASTE_THEME = {
  fonts: {
    display: '"Baloo 2", "Plus Jakarta Sans", sans-serif',
    sans: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"JetBrains Mono", monospace',
  },

  colors: {
    // Deep warm espresso background & cabinet surfaces
    bgBase: 0x16110d,
    bgElevated: 0x211913,
    bgSurface: 0x2c2119,
    bgGlassShowcase: 0x261d16,

    // Warm cream paper card surfaces (high contrast 7:1+ with dark espresso ink)
    cardCream: 0xfaf5ed,
    cardCreamHover: 0xfffdf9,
    cardWarmAlt: 0xf3eadb,
    cardMuted: 0xe6dccb,
    cardLocked: 0x231b15,

    // Wood counter & street kiosk architectural palette
    woodLight: 0xd89c5a,
    woodMid: 0xb57638,
    woodDark: 0x78471a,
    woodDeep: 0x45260c,

    // Stainless steel fryer station palette
    steelLight: 0xdce2e8,
    steelMid: 0x9aa5b1,
    steelDark: 0x38424d,
    steelDeep: 0x1f262e,

    // Ink & text hierarchy
    inkDark: '#1c130c',
    inkBody: '#4a3728',
    inkMuted: '#7c6552',
    inkOnDark: '#f7f1e8',
    inkMutedOnDark: '#b8a693',
    inkGold: '#fbbf24',

    // Hairline borders (1px subtle structural borders)
    borderHairlineDark: 0x4a382b,
    borderHairlineLight: 0xd9cbb8,
    borderAccent: 0xd97706,

    // Primary Brand Accent (Street-food Vermilion & Warm Amber)
    accentPrimary: 0xd9381e,
    accentPrimaryHover: 0xeb472b,
    accentAmber: 0xd97706,
    accentGold: 0xf59e0b,

    // Semantic Status Tokens (Zero purple/violet!)
    success: 0x1f8a4c,
    successLight: 0x2eb868,
    warning: 0xd97706,
    danger: 0xc92a2a,
    infoTeal: 0x0f766e,
    slateNeutral: 0x475569,
  },

  layout: {
    desktop: {
      gutter: 20,
      gap: 14,
      navHeight: 64,
      bottomBarHeight: 62,
      radiusLg: 14,
      radiusMd: 10,
      radiusSm: 8,
    },
    mobile: {
      gutter: 12,
      gap: 10,
      navHeight: 58,
      bottomBarHeight: 58,
      radiusLg: 12,
      radiusMd: 9,
      radiusSm: 7,
    },
  },

  motion: {
    fast: 140,
    normal: 220,
    enter: 420,
    easeOut: 'Cubic.easeOut',
  },
} as const;
