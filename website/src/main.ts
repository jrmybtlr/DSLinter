const navToggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");
const mobileNav = document.querySelector<HTMLElement>("[data-mobile-nav]");

navToggle?.addEventListener("click", () => {
  const expanded = navToggle.getAttribute("aria-expanded") === "true";
  navToggle.setAttribute("aria-expanded", String(!expanded));
  mobileNav?.classList.toggle("hidden", expanded);
});
