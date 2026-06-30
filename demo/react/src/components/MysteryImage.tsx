/** Decorative image with no `alt` — triggers a11y-img-alt. */
export function MysteryImage() {
  return (
    <img
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect fill='%23cbd5e1' width='120' height='80'/%3E%3C/svg%3E"
      className="rounded-md border border-gray-300"
    />
  );
}
