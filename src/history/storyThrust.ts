/** Independent touch contacts must not cancel another finger's thrust.
 * Flush the old input interval before every accepted contact edge, including
 * edges between slow renders. Pause/blur clears contacts rather than saving
 * held input in an exercise checkpoint. */
export function createStoryThrust({ flush, active, publish }: {
  flush: () => void;
  active: () => boolean;
  publish: (lift: number) => void;
}) {
  const contacts = new Map<number, 1 | -1>();
  const value = () => Math.max(-1, Math.min(1, [...contacts.values()].reduce<number>((sum, n) => sum + n, 0)));
  return {
    press(pointerId: number, direction: 1 | -1) {
      flush();
      if (!active()) return;
      contacts.set(pointerId, direction);
      publish(value());
    },
    release(pointerId: number) {
      if (!contacts.has(pointerId)) return;
      flush();
      contacts.delete(pointerId);
      publish(value());
    },
    clear() { contacts.clear(); publish(0); },
  };
}
