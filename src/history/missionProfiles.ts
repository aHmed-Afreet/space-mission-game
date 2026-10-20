/** Historically grounded identifiers for the 55 educational scenarios.
 * These are museum-style training reconstructions, not flight-certified schematics.
 * Their tasks use the real program's engineering goals; success thresholds remain fictional. */
export type HistoricProfile={
 vehicle:string; hardware:string; operation:string; observation:string; visual:string
};
export const missionProfiles:Record<string,HistoricProfile> = {
  "Sputnik 1": {
    "vehicle": "PS-1 spherical satellite",
    "hardware": "Radio transmitter and battery pack",
    "operation": "Follow transmitted radio beeps as the satellite circles Earth",
    "observation": "Record the orbit inferred from signal reception",
    "visual": "Four whip antennas"
  },
  "Explorer 1": {
    "vehicle": "Juno I / Explorer 1 slender satellite",
    "hardware": "Cosmic-ray detector and onboard batteries",
    "operation": "Check the satellite's Geiger-Müller counter measurements",
    "observation": "Identify changes consistent with trapped particle radiation",
    "visual": "Long cylindrical instrument bus"
  },
  "Luna 2": {
    "vehicle": "Luna 2 lunar impact probe",
    "hardware": "Radio beacon and impact trajectory guidance",
    "operation": "Track the probe toward its planned impact with the Moon",
    "observation": "Confirm the disappearance of its tracking signal at impact",
    "visual": "Spherical probe with projecting antennas"
  },
  "Vostok 1": {
    "vehicle": "Vostok 3KA spacecraft",
    "hardware": "Cabin environmental systems and automatic controls",
    "operation": "Monitor Yuri Gagarin's single orbital flight and return",
    "observation": "Confirm the historical separate parachute landing",
    "visual": "Spherical descent module and instrument compartment"
  },
  "Freedom 7": {
    "vehicle": "Mercury-Redstone 3 Freedom 7 capsule",
    "hardware": "Mercury cabin pressure and reentry systems",
    "operation": "Check Alan Shepard's suborbital flight profile",
    "observation": "Log the capsule's ocean recovery",
    "visual": "Small blunt-body Mercury capsule"
  },
  "Friendship 7": {
    "vehicle": "Mercury-Atlas 6 Friendship 7 capsule",
    "hardware": "Mercury flight-control and reentry systems",
    "operation": "Track three Earth orbits and the capsule's return",
    "observation": "Record John Glenn's mission findings",
    "visual": "Blunt Mercury capsule and escape tower"
  },
  "Mariner 2": {
    "vehicle": "Mariner 2 Venus flyby probe",
    "hardware": "Solar wings, antenna and radiometer",
    "operation": "Point radiometer measurements during the Venus flyby",
    "observation": "Record evidence of Venus's high temperature",
    "visual": "Hexagonal bus with solar panels"
  },
  "Voskhod 2": {
    "vehicle": "Voskhod 2 spacecraft and inflatable airlock",
    "hardware": "Airlock, suit and environmental support",
    "operation": "Review Leonov's pioneering first EVA and return",
    "observation": "Log the challenges of the EVA and recovery",
    "visual": "Spherical cabin with external airlock"
  },
  "Gemini 4": {
    "vehicle": "Gemini IV spacecraft",
    "hardware": "Gemini hatch, suit and oxygen supply",
    "operation": "Review Ed White's EVA timing and safe return",
    "observation": "Record Gemini 4 EVA operations",
    "visual": "Two-seat Gemini capsule"
  },
  "Gemini 6A and 7": {
    "vehicle": "Gemini VI-A and VII spacecraft",
    "hardware": "Rendezvous radar and attitude thrusters",
    "operation": "Maintain close station-keeping between two capsules",
    "observation": "Record relative-approach observations",
    "visual": "Pair of two-seat capsules"
  },
  "Gemini 8": {
    "vehicle": "Gemini VIII and Agena target vehicle",
    "hardware": "Docking mechanism and reaction controls",
    "operation": "Dock with Agena, diagnose a stuck thruster and prepare early return",
    "observation": "Record the first docking and emergency response",
    "visual": "Gemini capsule and Agena docking target"
  },
  "Luna 9": {
    "vehicle": "Luna 9 automatic lunar station",
    "hardware": "Inflatable landing protection and panorama camera",
    "operation": "Complete a soft lunar landing and unfold camera petals",
    "observation": "Archive the first lunar-surface photographs",
    "visual": "Small petal-shaped lunar lander"
  },
  "Apollo 8": {
    "vehicle": "Apollo 8 Command and Service Modules",
    "hardware": "Command module guidance and service propulsion",
    "operation": "Review lunar orbit insertion and trans-Earth injection",
    "observation": "Record Earthrise observations",
    "visual": "Apollo command capsule with service module"
  },
  "Apollo 9": {
    "vehicle": "Apollo CSM Gumdrop and LM Spider",
    "hardware": "LM ascent and descent engines and docking mechanism",
    "operation": "Separate, test and rendezvous the lunar module in Earth orbit",
    "observation": "File the lunar module flight-test results",
    "visual": "Apollo CSM and Lunar Module pair"
  },
  "Apollo 10": {
    "vehicle": "Apollo CSM Charlie Brown and LM Snoopy",
    "hardware": "Lunar module descent guidance and rendezvous controls",
    "operation": "Fly a lunar landing dress rehearsal without touchdown",
    "observation": "Record the low lunar approach and reunion",
    "visual": "Apollo LM and CSM in lunar orbit"
  },
  "Apollo 11": {
    "vehicle": "Lunar Module Eagle and CSM Columbia",
    "hardware": "Eagle descent guidance, suit and landing radar",
    "operation": "Land Eagle at Tranquility Base and prepare first lunar EVA",
    "observation": "Document initial lunar rock samples and surface imagery",
    "visual": "Four-legged Apollo Lunar Module"
  },
  "Apollo 12": {
    "vehicle": "Lunar Module Intrepid and CSM Yankee Clipper",
    "hardware": "LM precision landing guidance and EVA tools",
    "operation": "Target a landing near Surveyor 3 and inspect its hardware",
    "observation": "Catalogue retrieved Surveyor components and lunar samples",
    "visual": "Apollo LM near robotic Surveyor lander"
  },
  "Apollo 13": {
    "vehicle": "Apollo CSM Odyssey and LM Aquarius",
    "hardware": "Lunar module power, consumables and return guidance",
    "operation": "Abandon lunar landing and coordinate the crew's safe return",
    "observation": "Record resource-saving measures and recovery",
    "visual": "Apollo CSM with emergency lunar-module lifeboat"
  },
  "Luna 16": {
    "vehicle": "Luna 16 robotic sample-return spacecraft",
    "hardware": "Lunar drill, sample container and ascent stage",
    "operation": "Drill lunar soil and prepare an automated ascent",
    "observation": "Log returned lunar soil and sampling information",
    "visual": "Sample-return lander with tall ascent stage"
  },
  "Salyut 1": {
    "vehicle": "Salyut 1 orbital station",
    "hardware": "Station docking port and crew life support",
    "operation": "Prepare orbital workshop habitation and docking checks",
    "observation": "Record station research objectives",
    "visual": "Long single-module orbital station"
  },
  "Apollo 15": {
    "vehicle": "LM Falcon and Lunar Roving Vehicle",
    "hardware": "Lunar rover, drill and geology tools",
    "operation": "Prepare Hadley-Apennine traverse and collect samples",
    "observation": "Document core samples and geological context",
    "visual": "Apollo LM and four-wheel lunar rover"
  },
  "Mariner 9": {
    "vehicle": "Mariner 9 Mars orbiter",
    "hardware": "Orbital imaging system and solar panels",
    "operation": "Plan planetary mapping after the global dust storm",
    "observation": "Archive images of Martian volcanoes and canyons",
    "visual": "Solar-powered planetary orbiter"
  },
  "Pioneer 10": {
    "vehicle": "Pioneer 10 Jupiter probe",
    "hardware": "High-gain dish and radioisotope generator",
    "operation": "Prepare Jupiter flyby observations and antenna pointing",
    "observation": "Record early close-range Jupiter data",
    "visual": "Large dish with RTG booms"
  },
  "Apollo 17": {
    "vehicle": "LM Challenger and Lunar Roving Vehicle",
    "hardware": "Lunar rover, surface experiments and geology kit",
    "operation": "Plan Taurus-Littrow traverses and science deployment",
    "observation": "Record lunar samples and deployed experiments",
    "visual": "Apollo LM with deployed experiment stations"
  },
  "Skylab 2": {
    "vehicle": "Skylab orbital workshop",
    "hardware": "Thermal sunshade and damaged solar power array",
    "operation": "Plan recovery of station temperatures and power",
    "observation": "Document post-repair orbital laboratory science",
    "visual": "Large single-module station with solar arrays"
  },
  "Mariner 10": {
    "vehicle": "Mariner 10 Venus and Mercury probe",
    "hardware": "Solar arrays, camera and propulsion control",
    "operation": "Plan gravity assists and multiple Mercury flybys",
    "observation": "Record the first Mercury close-up images",
    "visual": "Planetary probe with articulated solar wings"
  },
  "Apollo–Soyuz": {
    "vehicle": "Apollo CSM and Soyuz 19 with docking module",
    "hardware": "International docking adapter and joint radio systems",
    "operation": "Coordinate docking between Apollo and Soyuz",
    "observation": "Document joint international crew activities",
    "visual": "Apollo and Soyuz docked spacecraft"
  },
  "Viking 1": {
    "vehicle": "Viking 1 Mars orbiter and lander",
    "hardware": "Lander arm, meteorology and biology experiment package",
    "operation": "Complete descent and remotely sample Martian soil",
    "observation": "Record Mars panorama and instrument results",
    "visual": "Three-legged Viking lander"
  },
  "Voyager 1": {
    "vehicle": "Voyager 1 deep-space spacecraft",
    "hardware": "Radioisotope power units, high-gain dish and scan platform",
    "operation": "Schedule Jupiter and Saturn encounter measurements",
    "observation": "Downlink images and outer-planet science",
    "visual": "Large high-gain dish with long RTG boom"
  },
  "Voyager 2": {
    "vehicle": "Voyager 2 deep-space spacecraft",
    "hardware": "Radioisotope power units, high-gain dish and science boom",
    "operation": "Sequence Jupiter, Saturn, Uranus and Neptune flybys",
    "observation": "Archive giant-planet atmosphere and moon observations",
    "visual": "High-gain dish with long instrument booms"
  },
  "STS-1": {
    "vehicle": "Space Shuttle Columbia OV-102",
    "hardware": "Shuttle flight computers, payload bay and thermal protection",
    "operation": "Perform first Shuttle orbital test and controlled landing",
    "observation": "Review spacecraft performance and return data",
    "visual": "Winged Space Shuttle orbiter"
  },
  "Mir station": {
    "vehicle": "Mir multi-module space station",
    "hardware": "Docked station modules, solar power and airlocks",
    "operation": "Manage long-duration crew maintenance and science",
    "observation": "Record station research and support data",
    "visual": "Connected Mir modules and radial ports"
  },
  "Hubble deployment": {
    "vehicle": "Space Shuttle Discovery and Hubble Space Telescope",
    "hardware": "Shuttle payload bay and telescope deployment hardware",
    "operation": "Release Hubble from the payload bay and check pointing",
    "observation": "Confirm first-orbit telescope engineering status",
    "visual": "Shuttle with cylindrical Hubble payload"
  },
  "Galileo Jupiter arrival": {
    "vehicle": "Galileo orbiter and atmospheric probe",
    "hardware": "High-gain antenna, RTGs and descent-probe interface",
    "operation": "Insert into Jupiter orbit and release atmospheric probe",
    "observation": "Record Jupiter atmosphere and moon observations",
    "visual": "Spinning spacecraft bus with RTG booms"
  },
  "Mars Pathfinder": {
    "vehicle": "Mars Pathfinder lander and Sojourner rover",
    "hardware": "Airbag landing system and rover-control radio",
    "operation": "Deploy the small Sojourner rover and plan a short traverse",
    "observation": "Record Mars rocks and soil data",
    "visual": "Stationary lander and six-wheel Sojourner"
  },
  "ISS assembly begins": {
    "vehicle": "Zarya and Unity station modules",
    "hardware": "Module berthing interfaces and station power systems",
    "operation": "Join early station elements and check integrated power",
    "observation": "Document station assembly milestones",
    "visual": "Connected ISS modules with truss beginnings"
  },
  "ISS Expedition 1": {
    "vehicle": "International Space Station early configuration",
    "hardware": "Crew environmental controls and experiment racks",
    "operation": "Commission life support and begin permanent habitation",
    "observation": "Transmit the crew's orbital research log",
    "visual": "Station with modules and solar arrays"
  },
  "Cassini–Huygens": {
    "vehicle": "Cassini Saturn orbiter and Huygens Titan probe",
    "hardware": "RTGs, high-gain antenna and atmospheric entry probe",
    "operation": "Release Huygens for Titan while operating the Saturn orbiter",
    "observation": "Record Titan landing and Saturnian-system science",
    "visual": "Orbiter bus with large dish and attached probe"
  },
  "Deep Impact": {
    "vehicle": "Deep Impact flyby craft and impactor",
    "hardware": "Imaging instruments and detachable impactor",
    "operation": "Aim the impactor at Tempel 1 and capture the ejecta",
    "observation": "Record comet composition and impact imagery",
    "visual": "Solar-powered flyby craft plus impactor"
  },
  "STS-125 Hubble servicing": {
    "vehicle": "Space Shuttle Atlantis OV-104 with Hubble",
    "hardware": "Shuttle airlock, EVA tools and telescope instrument bay",
    "operation": "Perform simulated telescope servicing and verify upgraded instruments",
    "observation": "File Hubble engineering and instrument checks",
    "visual": "Shuttle with cylindrical Hubble telescope"
  },
  "Kepler": {
    "vehicle": "Kepler space telescope",
    "hardware": "Photometer and solar power wings",
    "operation": "Maintain stable pointing to detect planetary transits",
    "observation": "Archive brightness curves of target stars",
    "visual": "Cylindrical photometer with solar wings"
  },
  "Curiosity": {
    "vehicle": "Curiosity Mars Science Laboratory rover",
    "hardware": "Six-wheel rocker-bogie, cameras and rock-sampling drill",
    "operation": "Drive toward a safe target and analyze Gale Crater rocks",
    "observation": "Record evidence of ancient habitable environments",
    "visual": "Six-wheel Mars science rover"
  },
  "Rosetta and Philae": {
    "vehicle": "Rosetta orbiter and Philae comet lander",
    "hardware": "Large solar arrays and Philae deployment hardware",
    "operation": "Escort comet 67P and release the small surface lander",
    "observation": "Archive comet observations and lander measurements",
    "visual": "Large-span solar array orbiter plus lander"
  },
  "New Horizons Pluto flyby": {
    "vehicle": "New Horizons Pluto probe",
    "hardware": "RTG, high-gain dish and LORRI telescope",
    "operation": "Sequence rapid close-up observations during Pluto flyby",
    "observation": "Downlink Pluto surface imagery",
    "visual": "Compact RTG-powered deep-space probe"
  },
  "Juno Jupiter arrival": {
    "vehicle": "Juno Jupiter orbiter",
    "hardware": "Three massive solar array wings and microwave instruments",
    "operation": "Insert into a polar Jupiter orbit for interior measurements",
    "observation": "Record Jupiter magnetic and weather observations",
    "visual": "Three-arm solar array configuration"
  },
  "OSIRIS-REx sampling": {
    "vehicle": "OSIRIS-REx asteroid explorer",
    "hardware": "Touch-and-go sampling arm and solar arrays",
    "operation": "Approach Bennu and touch the surface to capture sample material",
    "observation": "Document sampling site and returned sample",
    "visual": "Solar probe with extended sampling arm"
  },
  "Perseverance": {
    "vehicle": "Perseverance Mars 2020 rover",
    "hardware": "Six wheels, Mastcam-Z and sampling drill",
    "operation": "Investigate Jezero delta and cache selected rock cores",
    "observation": "Record calibrated images and cached rock samples",
    "visual": "Six-wheel rover with tall camera mast"
  },
  "Ingenuity": {
    "vehicle": "Ingenuity Mars helicopter",
    "hardware": "Twin counter-rotating rotors and solar-charged battery",
    "operation": "Check power and execute a short autonomous Mars flight",
    "observation": "Archive engineering camera imagery from the flight",
    "visual": "Compact four-leg helicopter with twin rotor sets"
  },
  "James Webb Telescope": {
    "vehicle": "James Webb Space Telescope",
    "hardware": "Eighteen-segment mirror and multilayer sunshield",
    "operation": "Deploy thermal shielding and align primary mirrors",
    "observation": "Confirm instrument commissioning observations",
    "visual": "Gold hexagonal mirror and kite-shaped sunshield"
  },
  "Artemis I": {
    "vehicle": "Orion spacecraft and European Service Module",
    "hardware": "Service module solar wings and heat shield",
    "operation": "Complete uncrewed Moon test flight and prepare capsule recovery",
    "observation": "Record heat shield and deep-space systems telemetry",
    "visual": "Orion capsule with four solar wings"
  },
  "Chandrayaan-3": {
    "vehicle": "Vikram lander and Pragyan rover",
    "hardware": "Landing sensors and Pragyan rover ramp",
    "operation": "Land near the lunar south polar region and deploy Pragyan",
    "observation": "Record lunar surface observations",
    "visual": "Four-leg lunar lander with small rover"
  },
  "JUICE": {
    "vehicle": "Jupiter Icy Moons Explorer",
    "hardware": "Large solar arrays and icy-moon investigation instruments",
    "operation": "Plan Earth-Venus gravity assists toward Jupiter",
    "observation": "Record cruise readiness for future icy-moon science",
    "visual": "Large solar-powered Jupiter mission craft"
  },
  "SLIM": {
    "vehicle": "SLIM precision lunar lander",
    "hardware": "Optical navigation and compact landing supports",
    "operation": "Complete precision Moon landing and monitor solar energy",
    "observation": "Document actual landing accuracy and power status",
    "visual": "Small asymmetric precision lander"
  },
  "Europa Clipper": {
    "vehicle": "Europa Clipper spacecraft",
    "hardware": "Large solar wings, radar and ice-moon sensors",
    "operation": "Prepare future multiple Europa flybys and test instruments",
    "observation": "Record cruise checkout; Europa science has not yet occurred",
    "visual": "Large solar wings and radar boom"
  },
  "Blue Ghost Mission 1": {
    "vehicle": "Firefly Blue Ghost lunar lander",
    "hardware": "Four landing legs and solar-powered science instruments",
    "operation": "Perform lunar descent and operate surface experiments",
    "observation": "Record science after successful landing",
    "visual": "Four-leg commercial lunar lander"
  }
};
export function missionProfile(title:string):HistoricProfile {
 const p=missionProfiles[title];
 if(!p)throw new Error("Missing historic mission profile: "+title);
 return p;
}
