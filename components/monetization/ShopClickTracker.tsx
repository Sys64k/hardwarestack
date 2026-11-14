"use client";

import { useEffect } from "react";
import { buildShopClickBody, isCountableButton } from "@/lib/shop-clicks";

const ENDPOINT = "/api/shop-click";
const EVENTS = ["click", "auxclick"] as const; // auxclick: middle-click opens a new tab

// Counts clicks on shop links anywhere on the page (see lib/shop-clicks.ts). One
// listener on the document, so links need no changes. It never delays or blocks the
// navigation: sendBeacon is fire-and-forget and survives the page unloading.
export function ShopClickTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!isCountableButton(event.button)) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const body = buildShopClickBody(link.href, window.location.pathname);
      if (body) navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }));
    }
    for (const name of EVENTS) document.addEventListener(name, onClick, { capture: true });
    return () => {
      for (const name of EVENTS) document.removeEventListener(name, onClick, { capture: true });
    };
  }, []);
  return null;
}
