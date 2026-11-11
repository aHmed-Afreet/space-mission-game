import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CampaignHome from "./CampaignHome";
import { missions, missionById, missionForSession, type MissionDefinition } from "./definitions";
import { createSession, emptyProgress, makeReport, type Session, type Progress } from "./engine";
import { newStore } from "./save";

// Isolated rendered-component fixtures. These are not earned mission completions.
function fixture(mission: MissionDefinition) {
  const store = newStore(), progress = emptyProgress();
  const prerequisite = (id: string) => {
    if (progress.completed[id]) return;
    const previous = missionById(id);
    previous.prerequisites.forEach(prerequisite);
    // Model fixture only: satisfy the constructor's lock contract, not gameplay evidence.
    progress.completed[id] = makeReport(createSession(previous, store.design, store.life, previous.requiredEquipment, progress), true);
  };
  mission.prerequisites.forEach(prerequisite);
  return { progress, session: createSession(mission, store.design, store.life, mission.requiredEquipment, progress) };
}

function summary(session: Session, progress: Progress) {
  const before = structuredClone({ session, progress });
  const noop = () => {};
  const html = renderToStaticMarkup(createElement(CampaignHome, {
    progress, session, legacy: false, warning: "", readOnly: false,
    selectedRoute: null, setSelectedRoute: noop, onSelect: noop,
    onResume: noop, onLegacy: noop, onExit: noop,
  }));
  assert.deepEqual({ session, progress }, before, "Displaying a saved flight must not migrate state or earned progress");
  return html;
}

test("saved-flight summary follows the actual legacy Mission 7 checklist at early, middle and last objectives", () => {
  const legacy = missionForSession({ missionId: "mission-7", revision: 3 });
  assert.equal(legacy.objectives.length, 58);
  for (const index of [0, 19, 57]) {
    const { session, progress } = fixture(legacy);
    session.objective = index;
    session.completed = legacy.objectives.slice(0, index).map(o => o.id);
    const html = summary(session, progress);
    assert.ok(html.includes(`Task ${index + 1} of 58. Progress is preserved.`));
    assert.ok(!html.includes(`Task ${index + 1} of 59.`));
    assert.ok(html.includes("Resume mission →"));
  }
});

test("saved-flight summary retains current procedure totals for every existing mission including fresh 59-task Mission 7", () => {
  assert.equal(missions.length, 18);
  for (const mission of missions) {
    const { session, progress } = fixture(mission);
    assert.ok(summary(session, progress).includes(`Task 1 of ${mission.objectives.length}. Progress is preserved.`), mission.id);
  }
  assert.equal(missions.find(m => m.id === "mission-7")!.objectives.length, 59);
});


test("Commander home previews mission names, objectives and clearance", () => {
  const progress = emptyProgress();
  const noop = () => {};
  const props = {
    progress, session: null, legacy: false, warning: "", readOnly: false,
    selectedRoute: null as "earth-orbit" | null, setSelectedRoute: noop,
    onSelect: noop, onResume: noop, onLegacy: noop, onExit: noop,
  };
  const home = renderToStaticMarkup(createElement(CampaignHome, props));
  const firstMission = missionById("mission-1");
  assert.ok(home.includes(firstMission.title), "Show the mission name on the campaign picker");
  assert.ok(home.includes(firstMission.majorObjective), "Explain the upcoming objective");
  assert.ok(home.includes("CLEARANCE: LEVEL 1 READY"), "Show actual unlock readiness");

  const route = renderToStaticMarkup(createElement(CampaignHome, {
    ...props, selectedRoute: "earth-orbit",
  }));
  assert.ok(route.includes("YOUR NEXT MISSION"), "Highlight the next eligible mission");
  assert.ok(route.includes("YOUR OBJECTIVE"), "Explain each mission's task");
  assert.ok(route.includes("CLEARANCE GRANTED"), "Label the startable level");
  assert.ok(route.includes("CLEARANCE REQUIRED"), "Label levels that are locked");
});
