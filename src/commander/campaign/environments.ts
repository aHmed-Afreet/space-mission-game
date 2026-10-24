export type Destination =
  "earth" | "moon" | "mars" | "asteroid" | "deep-space" | "europa";
export type Environment = {
  id: Destination;
  name: string;
  gravity: number;
  sunlight: number;
  temperature: number;
  radiation: number;
  solar: number;
  communicationDelay: number;
  terrain: "platform" | "craters" | "dunes" | "rubble" | "none" | "ice";
  movement: number;
  hazards: string[];
  summary: string;
  available: boolean;
};
export const environments: Record<Destination, Environment> = {
  earth: {
    id: "earth",
    name: "Earth orbit",
    gravity: 0,
    sunlight: 1,
    temperature: -80,
    radiation: 1,
    solar: 1,
    communicationDelay: 1,
    terrain: "platform",
    movement: 1.7,
    hazards: ["Vacuum", "Tether boundary"],
    summary:
      "Practise outside on a tethered orbital training platform. Magnetic boots keep you steady.",
    available: true,
  },
  moon: {
    id: "moon",
    name: "Moon",
    gravity: 1.62,
    sunlight: 1,
    temperature: -30,
    radiation: 2,
    solar: 1,
    communicationDelay: 2,
    terrain: "craters",
    movement: 1.35,
    hazards: ["Vacuum", "Low gravity", "Equipment shadow"],
    summary:
      "Slow, low-gravity movement over cratered ground. Your suit protects you from vacuum and temperature extremes.",
    available: true,
  },
  mars: {
    id: "mars",
    name: "Mars",
    gravity: 3.71,
    sunlight: 0.43,
    temperature: -60,
    radiation: 2,
    solar: 0.43,
    communicationDelay: 15,
    terrain: "dunes",
    movement: 1.5,
    hazards: ["Dust", "Thin atmosphere", "Delayed communication"],
    summary:
      "Dust, weaker sunshine and a thin atmosphere change field operations.",
    available: true,
  },
  asteroid: {
    id: "asteroid",
    name: "Asteroid",
    gravity: 0.02,
    sunlight: 0.25,
    temperature: -110,
    radiation: 4,
    solar: 0.25,
    communicationDelay: 30,
    terrain: "rubble",
    movement: 0.6,
    hazards: ["Extremely low gravity", "Unstable footing"],
    summary: "Careful tethered movement is essential on a very small body.",
    available: true,
  },
  "deep-space": {
    id: "deep-space",
    name: "Deep space",
    gravity: 0,
    sunlight: 0.1,
    temperature: -150,
    radiation: 5,
    solar: 0.1,
    communicationDelay: 45,
    terrain: "none",
    movement: 0.7,
    hazards: ["Long communication delay", "Low solar power"],
    summary:
      "Distant operations demand careful reserves and independent decisions.",
    available: false,
  },
  europa: {
    id: "europa",
    name: "Europa",
    gravity: 1.315,
    sunlight: 0.037,
    temperature: -160,
    radiation: 9,
    solar: 0.037,
    communicationDelay: 40,
    terrain: "ice",
    movement: 1.1,
    hazards: ["Radiation", "Extreme cold", "Fractured ice"],
    summary: "Reserved for a future protected icy-moon expedition.",
    available: false,
  },
};
