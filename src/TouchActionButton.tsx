import { useRef, type ComponentPropsWithRef } from "react";
import { createTouchActivation } from "./touchActivation";

type Props = Omit<ComponentPropsWithRef<"button">,
  "onClick" | "onPointerDown" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture"> & {
  onActivate: () => void;
};

/** A normal button that also works while another finger owns movement/look. */
export default function TouchActionButton({ onActivate, disabled, type = "button", onKeyDown, ...props }: Props) {
  const activation = useRef(createTouchActivation());
  return <button {...props} type={type} disabled={disabled}
    onKeyDown={event => {
      onKeyDown?.(event);
      // Space/Enter belong to this focused button, not global jump/flight keys.
      if (event.key === " " || event.key === "Enter") event.stopPropagation();
    }}
    onPointerDown={event => {
      if (disabled || !activation.current.begin(event.pointerType, event.pointerId)) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerUp={event => {
      if (event.pointerType !== "touch") return;
      const rect = event.currentTarget.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX < rect.right &&
        event.clientY >= rect.top && event.clientY < rect.bottom;
      if (activation.current.release(event.pointerId, !disabled && inside, event.timeStamp)) {
        event.preventDefault();
        onActivate();
      }
    }}
    onPointerCancel={event => activation.current.cancel(event.pointerId)}
    onLostPointerCapture={event => activation.current.cancel(event.pointerId)}
    onClick={event => {
      const native = event.nativeEvent as PointerEvent | MouseEvent;
      const pointerType = "pointerType" in native ? native.pointerType : undefined;
      if (!disabled && activation.current.click(event.detail, pointerType, event.timeStamp)) onActivate();
    }} />;
}
