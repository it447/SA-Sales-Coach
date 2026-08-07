/**
 * Shared color palette, lifted from the legacy scale-army-pricing-calculator
 * app so Deal Assistant's dashboard looks like the same internal tool
 * family rather than a random new app. Keep this in sync if the brand
 * palette ever changes — it's the only place colors are defined.
 */
export const colors = {
  navy: "#0a1628",
  navyLight: "#152238",
  navyMid: "#1a2d4a",
  navyBorder: "#243550",
  cream: "#f5f0e8",
  beige: "#e8dcc8",
  orange: "#e67e22",
  orangeLight: "#f39c12",
  greenAccent: "#27ae60",
  redAccent: "#e74c3c",
  yellowAccent: "#f1c40f",
} as const;
