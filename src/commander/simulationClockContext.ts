import { createContext } from "react";

/** Input-edge flushes advance resource time at the same monotonic timestamp. */
export const SimulationClockContext = createContext<(nowMs:number)=>void>(() => {});
