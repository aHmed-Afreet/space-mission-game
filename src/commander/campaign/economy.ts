import type { Progress, Session } from "./engine";
import type { MissionDefinition } from "./definitions";
export const technologies = {
  highGain: {
    name: "High-gain radio",
    cost: 8,
    mass: 12,
    description:
      "50% faster data acknowledgements; stronger mission communications.",
  },
  reserveBattery: {
    name: "Reserve battery module",
    cost: 10,
    mass: 35,
    description: "Adds 1 kWh of actual cabin battery capacity.",
  },
  improvedSuit: {
    name: "Extended-duration EVA suit",
    cost: 6,
    mass: 2,
    description: "0.50 kg suit oxygen and 25% more suit battery.",
  },
  advancedSolar: {
    name: "Advanced solar wing",
    cost: 9,
    mass: 20,
    description: "Adds 60 W generation, scaled by destination sunlight.",
  },
} as const;
export type Technology = keyof typeof technologies;
export type Economy = {
  balance: number;
  funded: string[];
  settled: string[];
  launched: string[];
  unlocks: Technology[];
  ledger: { id: string; label: string; amount: number; balance: number }[];
};
export type LaunchFinance = {
  before: number;
  allocation: number;
  assistance: number;
  cost: number;
  practice: boolean;
};
export type FinancialReport = LaunchFinance & {
  base: number;
  optional: number;
  science: number;
  efficiency: number;
  recovery: number;
  insurance: number;
  repair: number;
  earned: number;
  after: number;
};
export const initialEconomy = (): Economy => ({
  balance: 425,
  funded: [],
  settled: [],
  launched: [],
  unlocks: [],
  ledger: [],
});
export const money = (value: number) => `$${value.toFixed(1)}M`;
const round = (n: number) => Math.round(n * 100) / 100;
export function allocation(m: MissionDefinition, p: Progress) {
  return p.completed[m.id] || p.economy.funded.includes(m.id)
    ? 0
    : m.funding || 0;
}
export function launchFinance(
  m: MissionDefinition,
  p: Progress,
  cost: number,
): LaunchFinance {
  const practice = !!p.completed[m.id];
  const grant = practice ? 0 : allocation(m, p);
  // Recovery assistance pays only the standard flight shortfall. It never becomes spendable cash.
  const ceiling = 285;
  const assistance =
    !practice && cost <= ceiling
      ? Math.max(0, cost - p.economy.balance - grant)
      : 0;
  if (!practice && cost > p.economy.balance + grant + assistance)
    throw Error(
      "Agency Budget cannot cover this configuration. Reduce upgrades or use a standard recovery flight below $285M.",
    );
  return {
    before: p.economy.balance,
    allocation: grant,
    assistance: round(assistance),
    cost: practice ? 0 : round(cost),
    practice,
  };
}
export function bookLaunch(p: Progress, s: Session): Progress {
  if (p.economy.launched.includes(s.id)) return p;
  const f = s.finance;
  const balance = round(
    p.economy.balance + f.allocation + f.assistance - f.cost,
  );
  return {
    ...p,
    economy: {
      ...p.economy,
      balance,
      launched: [...p.economy.launched, s.id],
      funded: [...new Set([...p.economy.funded, s.missionId])],
      ledger: [
        ...p.economy.ledger,
        {
          id: s.id + ":launch",
          label: `Mission allocation ${f.allocation}; assistance ${f.assistance}; flight cost ${f.cost}`,
          amount: round(f.allocation + f.assistance - f.cost),
          balance,
        },
      ].slice(-200),
    },
  };
}
export function financialReport(
  s: Session,
  m: MissionDefinition,
  success: boolean,
  optionalRewards: number,
): FinancialReport {
  const f = s.finance;
  const active = !f.practice;
  const base = active && success ? m.reward || 0 : 0;
  const optional = active && success ? optionalRewards : 0;
  const science =
    active && success ? Math.min(4, Math.floor(s.state.science / 25)) : 0;
  const efficiency =
    active && success
      ? (s.state.fuel >= 20 ? 1 : 0) +
        (s.state.battery / s.life.batteries >= 0.65 ? 2 : 0)
      : 0;
  const recovery =
    active && success && s.optionalDone.includes("recover") ? 2 : 0;
  // Insure hardware, not free grants: assistance is excluded from the refundable purchase value.
  const insurance =
    active && !success ? round(Math.max(0, f.cost - f.assistance) * 0.8) : 0;
  const repair = active && !success ? Math.min(3, insurance) : 0;
  const earned = round(base + optional + science + efficiency + recovery);
  return {
    ...f,
    base,
    optional,
    science,
    efficiency,
    recovery,
    insurance,
    repair,
    earned,
    after: round(
      f.before +
        f.allocation +
        f.assistance -
        f.cost +
        earned +
        insurance -
        repair,
    ),
  };
}
export function settle(p: Progress, s: Session): Progress {
  if (!s.report || p.economy.settled.includes(s.id)) return p;
  const f = s.report.finance;
  if (!f) return p;
  const amount = round(f.earned + f.insurance - f.repair);
  const balance = round(p.economy.balance + amount);
  return {
    ...p,
    economy: {
      ...p.economy,
      balance,
      settled: [...p.economy.settled, s.id],
      unlocks: [
        ...new Set([
          ...p.economy.unlocks,
          ...(s.report.success ? s.report.unlocks : []),
        ]),
      ],
      ledger: [
        ...p.economy.ledger,
        {
          id: s.id + ":settlement",
          label: `${s.report.outcome} · ${s.missionId}${f.practice ? " · training replay" : ""}`,
          amount,
          balance,
        },
      ].slice(-200),
    },
  };
}
