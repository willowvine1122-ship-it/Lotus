/**
 * Brand v2 colors as plain hex, for code that cannot read CSS variables (three.js, canvas).
 * Keep in sync with app/globals.css and /mnt/project-files/lotus-colors.json.
 */
export const brand = {
  ink: "#0f2a2e",
  paper: "#f8f5ef",
  mist: "#e6eceb",
  stone: "#5b6b6e",
  rose: "#c8326a",
  plum: "#4a1f45",
  blush: "#f6c9d8",
  roseMist: "#fbeaf0",
  // Section primaries and their light tints (from the section hero gradients)
  leaf: "#0f6e52",
  leafLight: "#22936b",
  blue: "#1769c9",
  blueLight: "#4d8df7",
  violet: "#6a3fe0",
  violetLight: "#9c82f5",
  // Logo mark parts (brand book p.10). "reverse" tones are the lifted W tones for dark backgrounds.
  mark: {
    petal: "#c8326a",
    petalOverlap: "#4a1f45",
    wSide: "#6e9598",
    wCenter: "#2f5a5f",
    wLeg: "#1e454a",
    wShadow: "#0f2a2e",
  },
  markReverse: {
    petal: "#c8326a",
    petalOverlap: "#4a1f45",
    wSide: "#b9d0d2",
    wCenter: "#86a9ac",
    wLeg: "#628a8e",
    wShadow: "#456e73",
  },
} as const;
