/** User photo without `alt` — common slip when the asset “looks decorative”. */
export function AvatarImage() {
  return (
    <img
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect fill='%23cbd5e1' width='120' height='80'/%3E%3C/svg%3E"
      className="rounded-md border border-gray-300"
    />
  );
}
