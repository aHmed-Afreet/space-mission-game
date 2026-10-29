import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { historyMissions } from "./missionHistory";
import { createStoryScenario } from "./storyScenarios";
import { createHistoricVehicle } from "./historicVehicles";
import { planetKind, makePlanet, disposePlanet } from "../commander/celestial";

test("Luna 2 dispatch builds its spherical probe instead of an Apollo capsule",()=>{
  const model=createHistoricVehicle(createStoryScenario(historyMissions.find(m=>m.title==="Luna 2")!));
  const sphere=model.children.find(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.SphereGeometry) as THREE.Mesh;
  assert.ok(sphere);assert.equal((sphere.geometry as THREE.SphereGeometry).parameters.radius,.94);
  assert.equal(model.children.length,5,"probe sphere and four antennas");
});

test("Webb builds five separate sunshield layers and preserves its mirror",()=>{
  const model=createHistoricVehicle(createStoryScenario(historyMissions.find(m=>m.title==="James Webb Telescope")!));
  const layers=model.children.filter(o=>o.name.startsWith("Webb sunshield layer "));
  assert.equal(layers.length,5);assert.equal(new Set(layers.map(o=>o.position.y)).size,5);
  const mirrors=model.children.filter(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.CylinderGeometry&&o.geometry.parameters.radialSegments===6);
  assert.equal(mirrors.length,18);
});

test("deep-space destinations never silently resolve to Earth",()=>{
  for(const title of ["Voyager 1","Voyager 2","Deep Impact","Rosetta and Philae","OSIRIS-REx sampling"]){
    const m=historyMissions.find(m=>m.title===title)!;
    assert.notEqual(planetKind(m.destination),"earth");assert.notEqual(planetKind(m.destination),"unknown");
  }
  assert.equal(planetKind("Comet Tempel 1"),"comet");assert.equal(planetKind("Asteroid Bennu"),"asteroid");
  assert.equal(planetKind("Earth orbit"),"earth");assert.equal(planetKind("Moon"),"moon");
  assert.equal(planetKind("unspecified coordinates"),"unknown");
  for(const kind of ["asteroid","comet","unknown"] as const){
    const body=makePlanet(kind,3);assert.equal(body.userData.destinationKind,kind);assert.ok(body.children.length);
    disposePlanet(body);assert.equal(body.userData.disposed,true);
  }
});
