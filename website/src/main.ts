import "./main.css";

const navToggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");
const mobileNav = document.querySelector<HTMLElement>("[data-mobile-nav]");

navToggle?.addEventListener("click", () => {
  const expanded = navToggle.getAttribute("aria-expanded") === "true";
  navToggle.setAttribute("aria-expanded", String(!expanded));
  mobileNav?.classList.toggle("hidden", expanded);
});

const SPOTLIGHT_VIEWBOX_RADIUS = 52;
const SPOTLIGHT_VIEWBOX_WIDTH = 174;

function initLogoSpotlight() {
  const container = document.querySelector<HTMLElement>("[data-logo-spotlight]");

  if (!container) {
    return;
  }

  if (!window.matchMedia("(pointer: fine)").matches) {
    return;
  }

  let rect = container.getBoundingClientRect();
  let pendingX = rect.width / 2;
  let pendingY = rect.height / 2;
  let frame = 0;

  const syncMetrics = () => {
    rect = container.getBoundingClientRect();
    const radius = (rect.width * SPOTLIGHT_VIEWBOX_RADIUS) / SPOTLIGHT_VIEWBOX_WIDTH;
    container.style.setProperty("--spot-r", `${radius}px`);
  };

  const applySpotlight = () => {
    frame = 0;
    container.style.setProperty("--spot-x", `${pendingX}px`);
    container.style.setProperty("--spot-y", `${pendingY}px`);
  };

  const queueSpotlight = (clientX: number, clientY: number) => {
    pendingX = clientX - rect.left;
    pendingY = clientY - rect.top;

    if (!frame) {
      frame = requestAnimationFrame(applySpotlight);
    }
  };

  syncMetrics();
  applySpotlight();

  const resizeObserver = new ResizeObserver(syncMetrics);
  resizeObserver.observe(container);

  container.addEventListener(
    "pointerenter",
    (event) => {
      queueSpotlight(event.clientX, event.clientY);
      applySpotlight();
      container.classList.add("is-active");
    },
    { passive: true },
  );

  container.addEventListener(
    "pointerleave",
    () => {
      container.classList.remove("is-active");
    },
    { passive: true },
  );

  container.addEventListener(
    "pointermove",
    (event) => {
      queueSpotlight(event.clientX, event.clientY);
    },
    { passive: true },
  );
}

initLogoSpotlight();
