export function joystickVector(dx: number, dy: number, radius: number) {
  const length = Math.hypot(dx, dy),
    dead = 5;
  if (length <= dead) return { x: 0, y: 0 };
  const magnitude = Math.min(1, (length - dead) / (radius - dead));
  return { x: (dx / length) * magnitude, y: (dy / length) * magnitude };
}
