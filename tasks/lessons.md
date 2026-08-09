# Lessons

## Radix SelectValue ignores className

`@radix-ui/react-select` `Select.Value` destructures `className` / `style` and never applies them to the DOM. Putting a custom label beside `<SelectValue className="sr-only" />` (or `hidden`) still shows the portaled `ItemText`, which doubles labels (e.g. `mdmd`, `@3xl@3xl`).

**Fix:** Put the custom trigger label as **children of `SelectValue`**. When children are present, Radix skips portaling `ItemText` into the value node.
