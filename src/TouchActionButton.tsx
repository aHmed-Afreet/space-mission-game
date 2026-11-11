import { useEffect, useRef, type ComponentPropsWithRef } from "react";
import { createPostClickActivationQueue, createTouchActivation } from "./touchActivation";

type Props = Omit<ComponentPropsWithRef<"button">,
  "onClick" | "onPointerDown" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture"> & {
  onActivate: () => void;
};

/** A normal button that also works while another finger owns movement/look. */
export default function TouchActionButton({ onActivate, disabled, type = "button", onKeyDown, ...props }: Props) {
  const activation = useRef(createTouchActivation());
  const latestActivate=useRef(onActivate);
  const latestDisabled=useRef(disabled);
  latestActivate.current=onActivate;
  latestDisabled.current=disabled;
  const lastTouchRelease=useRef(-Infinity);
  // Commit a touch just after its compatibility click (which can otherwise
  // land on the menu that INTERACT has only just rendered on iPad WebKit).
  const postClick=useRef(createPostClickActivationQueue(
    callback=>window.setTimeout(callback,70),
    handle=>window.clearTimeout(handle),
  ));
  useEffect(()=>()=>postClick.current.cancel(),[]);
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
        lastTouchRelease.current=event.timeStamp;
        postClick.current.commit(()=>{
          if(!latestDisabled.current)latestActivate.current();
        });
      }
    }}
    onPointerCancel={event => activation.current.cancel(event.pointerId)}
    onLostPointerCapture={event => activation.current.cancel(event.pointerId)}
    onClick={event => {
      const native = event.nativeEvent as PointerEvent | MouseEvent;
      const pointerType = "pointerType" in native ? native.pointerType : undefined;
      // A one-finger tap can produce a follow-up click; a held joystick
      // (two-finger gesture) often cannot. Both must activate exactly once.
      const sinceTouch=event.timeStamp-lastTouchRelease.current;
      if(event.detail>0&&sinceTouch>=0&&sinceTouch<900){
        event.preventDefault();
        return;
      }
      if (!disabled && activation.current.click(event.detail, pointerType, event.timeStamp)) onActivate();
    }} />;
}
