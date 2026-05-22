import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  formatHashRoute,
  parseHashRoute,
  stripLegacyHashFragment,
  type HashRoute,
} from "./hashRoute";

const NAVIGATE_EVENT = "dslinter:navigate";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(NAVIGATE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(NAVIGATE_EVENT, onStoreChange);
  };
}

function getPathSnapshot() {
  return window.location.pathname || "/governance";
}

function getServerPathSnapshot() {
  return "/governance";
}

export function useHashRoute(): [HashRoute, (next: HashRoute) => void] {
  const pathname = useSyncExternalStore(
    subscribe,
    getPathSnapshot,
    getServerPathSnapshot,
  );
  const route = parseHashRoute(pathname);

  useEffect(() => {
    if (stripLegacyHashFragment()) {
      window.dispatchEvent(new Event(NAVIGATE_EVENT));
    }
  }, []);

  const navigate = useCallback((next: HashRoute) => {
    const nextPath = formatHashRoute(next);
    const pathChanged = nextPath !== window.location.pathname;
    if (pathChanged) {
      window.history.pushState(null, "", nextPath);
    }
    if (stripLegacyHashFragment() || pathChanged) {
      window.dispatchEvent(new Event(NAVIGATE_EVENT));
    }
  }, []);

  return [route, navigate];
}
