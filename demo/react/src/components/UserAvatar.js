/** Always passes meaningful `alt` for real user photos. */
export function UserAvatar({ src, name }) {
    return (<img src={src} alt={`Avatar of ${name}`} className="h-12 w-12 rounded-full border-2 border-surface-border object-cover"/>);
}
