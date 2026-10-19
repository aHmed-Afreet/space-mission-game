const explanations: Record<string, { title: string; text: string }> = {
  navigation: {
    title: "Using a station",
    text: "Follow the small waypoint. Walk close to the console, then tap INTERACT or press E. Only the current task counts toward mission progress.",
  },
  food: {
    title: "Food supplies",
    text: "Take a meal from galley storage. It moves into your inventory. Eating uses that meal and restores nutrition and energy.",
  },
  water: {
    title: "Drinking water",
    text: "Fill your bottle at the dispenser. Drinking uses the water you carry. A working recycler returns some of it to spacecraft storage.",
  },
  inventory: {
    title: "Your inventory",
    text: "Open INVENTORY in the Mission Tablet to eat or drink from carried supplies. Food packs and water are finite. Wait between meals and drinks.",
  },
  science: {
    title: "Science operations",
    text: "Use the science console to gather observations. Instruments need electrical power, and working uses some crew energy.",
  },
  rest: {
    title: "Resting",
    text: "Rest in the sleeping berth to restore energy. Time and life support continue while you rest. Wake when the task asks you to.",
  },
  comms: {
    title: "Communications",
    text: "The radio sends science data home. If the link fails, go to the communications station to restore it.",
  },
  power: {
    title: "Electrical power",
    text: "Batteries and solar panels power life support, science and radio equipment. Low power can stop important systems. STATUS shows whether supplies are GOOD, WARNING or CRITICAL.",
  },
  repair: {
    title: "Repairs",
    text: "Collect the toolkit from equipment storage. A power repair also uses one spare part. The inventory shows how many remain.",
  },
  eva: {
    title: "Going outside",
    text: "Your selected field equipment is packed when you put on the suit. Check suit oxygen and power, then follow every airlock step. You must stay suited in vacuum.",
  },
  airlock: {
    title: "The airlock",
    text: "Never open both hatches together. Close the inside hatch before releasing air. On return, close the outside hatch and refill the chamber before opening the inside hatch.",
  },
  environment: {
    title: "Different worlds",
    text: "The Moon has low gravity, no breathable air and harsh sunlight. Movement and hopping feel different outside. Your suit protects you from temperature and radiation.",
  },
  field: {
    title: "Field science",
    text: "Follow the current waypoint to the marked site. You can only use tools you packed before leaving. Use a small hop to feel the lower gravity.",
  },
  camp: {
    title: "Research camp",
    text: "Deploy your carried equipment at the marker. Solar panels and a battery power the experiment and radio. The shelter protects equipment; it is not pressurized, so keep your suit on.",
  },
};
export default function Tutorial({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const t = explanations[id] || explanations.navigation;
  return (
    <div
      className="campaign-tutorial"
      role="dialog"
      onKeyDown={(e) => {
        if (e.key === "Tab") e.preventDefault();
        if (e.key === "Escape") onClose();
      }}
      aria-modal="true"
      aria-label={t.title}
    >
      <span className="eyebrow">QUICK GUIDE / MISSION PAUSED</span>
      <h2>{t.title}</h2>
      <p>{t.text}</p>
      <button autoFocus onClick={onClose}>
        Got it →
      </button>
    </div>
  );
}
