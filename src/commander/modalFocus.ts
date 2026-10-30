import { useLayoutEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const inertOwners = new WeakMap<HTMLElement, { count: number; original: boolean }>();
const focusScopes: HTMLElement[] = [];

function inertBackground(boundary: HTMLElement, doc: Document) {
  const affected: HTMLElement[] = [];
  let branch: HTMLElement | null = boundary;
  while (branch?.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (!(sibling instanceof doc.defaultView!.HTMLElement) || sibling === branch) continue;
      const old = inertOwners.get(sibling);
      if (old) old.count++;
      else inertOwners.set(sibling, { count: 1, original: sibling.inert });
      sibling.inert = true;
      affected.push(sibling);
    }
    branch = branch.parentElement;
  }
  return () => {
    for (const element of affected) {
      const entry = inertOwners.get(element);
      if (entry && --entry.count === 0) {
        element.inert = entry.original;
        inertOwners.delete(element);
      }
    }
  };
}

/** Installs one lifetime of a modal. Callbacks may read live refs. */
export function containModalFocus({
  dialog, boundary = dialog, initialFocus, onClose,
}: {
  dialog: HTMLElement;
  boundary?: HTMLElement;
  initialFocus?: HTMLElement | null;
  onClose?: () => void;
}, doc: Document = document) {
  const previous = doc.activeElement instanceof doc.defaultView!.HTMLElement ? doc.activeElement : null;
  const releaseBackground = inertBackground(boundary, doc);
  focusScopes.push(dialog);
  const oldTabIndex = dialog.getAttribute("tabindex");
  if (oldTabIndex === null) dialog.setAttribute("tabindex", "-1");
  const candidates = () => [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter(element => !element.closest("[inert],[hidden]") && element.getClientRects().length > 0);
  const first = () => initialFocus?.isConnected && dialog.contains(initialFocus)
    ? initialFocus : candidates()[0] || dialog;
  const focus = (element: HTMLElement) => element.focus({ preventScroll: true });
  const redirect = (event: FocusEvent) => {
    if (focusScopes[focusScopes.length - 1] !== dialog) return;
    if (!dialog.contains(event.target as Node)) focus(first());
  };
  const key = (event: KeyboardEvent) => {
    if (focusScopes[focusScopes.length - 1] !== dialog) return;
    if (event.key === "Escape" && onClose) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "Tab") {
      const available = candidates();
      const start = available[0], end = available[available.length - 1];
      if (!start) { event.preventDefault(); focus(dialog); }
      else if (!dialog.contains(doc.activeElement) || (event.shiftKey ? doc.activeElement === start : doc.activeElement === end)) {
        event.preventDefault();
        focus(event.shiftKey ? end : start);
      }
    }
  };
  doc.addEventListener("keydown", key, true);
  doc.addEventListener("focusin", redirect, true);
  focus(first());
  return () => {
    doc.removeEventListener("keydown", key, true);
    doc.removeEventListener("focusin", redirect, true);
    const index = focusScopes.lastIndexOf(dialog);
    if (index >= 0) focusScopes.splice(index, 1);
    releaseBackground();
    if (oldTabIndex === null) dialog.removeAttribute("tabindex");
    if (previous?.isConnected && !previous.closest("[inert]")) focus(previous);
  };
}

export function useModalFocus({ dialog, boundary, initialFocus, onClose, active = true }: {
  dialog: RefObject<HTMLElement | null>;
  boundary?: RefObject<HTMLElement | null>;
  initialFocus?: RefObject<HTMLElement | null>;
  onClose?: () => void;
  active?: boolean;
}) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    if (!active || !dialog.current) return;
    return containModalFocus({ dialog: dialog.current, boundary: boundary?.current || dialog.current,
      initialFocus: initialFocus?.current, onClose: onClose ? () => close.current?.() : undefined });
    // Modal initialization belongs to mount/unmount. Preference renders must
    // neither refocus its first button nor replace its focus return target.
  }, [active]);
}
