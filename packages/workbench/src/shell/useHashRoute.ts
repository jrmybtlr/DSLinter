import { useCallback, useSyncExternalStore } from "react";
import { formatHashRoute, parseHashRoute, type HashRoute } from "./hashRoute";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getHashSnapshot() {
  return window.location.hash || "#!/governance";
}

function getServerHashSnapshot() {
  return "#!/governance";
}

export function useHashRoute(): [HashRoute, (next: HashRoute) => void] {
  const hash = useSyncExternalStore(subscribe, getHashSnapshot, getServerHashSnapshot);
  const route = parseHashRoute(hash);

  const navigate = useCallback((next: HashRoute) => {
    const nextHash = formatHashRoute(next);
    if (nextHash !== window.location.hash) {
      window.location.hash = nextHash;
    }
  }, []);

  return [route, navigate];
}
