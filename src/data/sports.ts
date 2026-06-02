/**
 * Canonical list of high school sports used across Opletics.
 * Keep this list sorted alphabetically.
 */
export const SPORTS = [
  "Baseball",
  "Basketball",
  "Bowling",
  "Cheerleading",
  "Cross Country",
  "Fencing",
  "Field Hockey",
  "Flag Football",
  "Football",
  "Golf",
  "Gymnastics",
  "Ice Hockey",
  "Lacrosse",
  "Rugby",
  "Soccer",
  "Softball",
  "Swimming",
  "Tennis",
  "Track & Field",
  "Volleyball",
  "Water Polo",
  "Wrestling",
] as const;

export type Sport = (typeof SPORTS)[number];
