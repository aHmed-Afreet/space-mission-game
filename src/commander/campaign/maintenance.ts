import type { Session } from "./engine";
import { equipmentServiceCost } from "./ship";

export function canServiceEquipment(
  value: number | undefined,
  balance: number,
  session: Pick<Session, "report"> | null,
) {
  const condition = value ?? 100;
  return condition < 100 && balance >= equipmentServiceCost(condition) &&
    (!session || !!session.report);
}
