/**
 * Read-only educational greenhouse climate estimate.
 * The Outpost save format has no thermometer or thermal subsystem. Show a
 * transparent, deterministic estimate using existing power/weather choices
 * without inventing a sensor reading or changing survival/scoring rules.
 */
import {forecast,projectPower,type Outpost} from "./engine";

export type GreenhouseClimate = {
  temperatureC:number;
  status:"NOMINAL"|"COOL";
  note:string;
};

export function greenhouseClimate(session:Readonly<Outpost>):GreenhouseClimate{
  const weather=forecast(session.destination,session.sol);
  const supply=projectPower(session);
  const limitedPower=supply.projectedBattery<25;
  const lightingAdjustment=session.priority==="crops"?1:session.priority==="crew"?-1:0;
  const darkAdjustment=weather.sunlight<.3?-1:0;
  const temperatureC=Math.max(17,Math.min(24,22+lightingAdjustment+darkAdjustment-(limitedPower?2:0)));
  return {
    temperatureC,
    status:temperatureC<20?"COOL":"NOMINAL",
    note:"Estimated cabin climate from the day's lighting, weather and projected power. Simulation only; not a live thermometer or a separate temperature-control system.",
  };
}
