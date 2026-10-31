import type { CatalogComponent } from "../types/report";
import type { DemoNode } from "./recipes";

export function includesTarget(tree: DemoNode | string, names: Set<string>): boolean {
  return (
    typeof tree !== "string" &&
    (names.has(tree.name) || Boolean(tree.children?.some((child) => includesTarget(child, names))))
  );
}

const families = [
  "DropdownMenu",
  "NavigationMenu",
  "Collapsible",
  "Breadcrumb",
  "ToggleGroup",
  "InputOTP",
  "Tooltip",
  "Popover",
  "Sidebar",
  "Avatar",
  "Dialog",
  "Select",
  "Sheet",
  "Card",
];

/** Recipes use the selected family's real exports, including the selected subcomponent. */
export function familyRecipe(
  component: CatalogComponent,
  catalog: CatalogComponent[],
): DemoNode | undefined {
  let family = families.find(
    (name) =>
      component.name === name ||
      (component.name.startsWith(name) && /^[A-Z]/.test(component.name.slice(name.length))),
  );
  // Application fragments which return menu children also need a real menu/content owner.
  const menuFragment =
    !family &&
    Object.values(component.preview.component_imports || {}).some((binding) =>
      /^DropdownMenu(?:Item|Group|Label|Separator)$/.test(binding.export_name),
    );
  if (menuFragment) family = "DropdownMenu";
  if (!family) return;
  const candidate = component.preview.provider_candidates?.find((item) => item.name === family);
  const sidebarMenuFragment = component.name === "SidebarNavMenu" && Boolean(candidate);
  const file =
    menuFragment || sidebarMenuFragment ? candidate?.rel_path : component.preview.rel_path;
  const members = catalog.filter(
    (item) => item.framework === component.framework && item.preview.rel_path === file,
  );
  const names = new Set(members.map((item) => item.name));
  const source = members.flatMap((item) => item.dependencies);
  if (
    !["Breadcrumb", "Card"].includes(family) &&
    !source.some((name) =>
      /^(?:@radix-ui\/|radix-ui$|@base-ui\/|reka-ui$|radix-vue$|input-otp$|class-variance-authority$)/.test(
        name,
      ),
    )
  )
    return;
  const node = (
    name: string,
    children: (DemoNode | string)[] = [],
    props: Record<string, unknown> = {},
  ): DemoNode => ({ name, children, props });
  const target = component.name;
  const leaf = (name: string, text: string, props = {}): DemoNode => node(name, [text], props);
  const selected = (fallback: string, text = "Example"): DemoNode =>
    leaf(names.has(target) ? target : fallback, text);
  const requireNames = (...items: string[]) => items.every((item) => names.has(item));
  const open = target !== family && target !== family + "Trigger";
  let tree: DemoNode | undefined;
  switch (family) {
    case "DropdownMenu": {
      if (
        !requireNames(
          "DropdownMenu",
          "DropdownMenuTrigger",
          "DropdownMenuContent",
          "DropdownMenuItem",
        )
      )
        return;
      let content: DemoNode = leaf("DropdownMenuItem", "Example action");
      if (menuFragment) content = node(target);
      else if (target.startsWith("DropdownMenuSub")) {
        if (!requireNames("DropdownMenuSub", "DropdownMenuSubTrigger", "DropdownMenuSubContent"))
          return;
        content = node(
          "DropdownMenuSub",
          [
            leaf("DropdownMenuSubTrigger", "More actions"),
            node("DropdownMenuSubContent", [leaf("DropdownMenuItem", "Nested action")]),
          ],
          { open: true },
        );
      } else if (target === "DropdownMenuRadioGroup" || target === "DropdownMenuRadioItem") {
        if (!requireNames("DropdownMenuRadioGroup", "DropdownMenuRadioItem")) return;
        content = node(
          "DropdownMenuRadioGroup",
          [leaf("DropdownMenuRadioItem", "First option", { value: "first" })],
          { value: "first" },
        );
      } else if (target === "DropdownMenuShortcut")
        content = node("DropdownMenuItem", ["Save", leaf(target, "⌘S")]);
      else if (target === "DropdownMenuGroup") content = node(target, [content]);
      else if (
        ![
          "DropdownMenu",
          "DropdownMenuTrigger",
          "DropdownMenuContent",
          "DropdownMenuPortal",
        ].includes(target)
      )
        content = selected("DropdownMenuItem", "Example action");
      let panel = node("DropdownMenuContent", [content], { sideOffset: 8 });
      if (target === "DropdownMenuPortal" && names.has(target)) panel = node(target, [panel]);
      tree = node("DropdownMenu", [leaf("DropdownMenuTrigger", "Open menu"), panel], {
        defaultOpen: open,
      });
      break;
    }
    case "Dialog":
    case "Sheet":
    case "Popover": {
      if (!requireNames(family, family + "Trigger", family + "Content")) return;
      const children: (DemoNode | string)[] = [];
      if (names.has(family + "Title"))
        children.push(leaf(family + "Title", "Example " + family.toLowerCase()));
      if (names.has(family + "Description"))
        children.push(leaf(family + "Description", "Your component in its required context."));
      if (target.endsWith("Header") && names.has(target))
        children.splice(0, children.length, node(target, [...children]));
      if (target.endsWith("Footer")) children.push(node(target, ["Footer content"]));
      if (target.endsWith("Close")) children.push(leaf(target, "Close"));
      if (!children.length) children.push("Example content");
      let panel = node(family + "Content", children);
      if (target.endsWith("Overlay") || target.endsWith("Portal")) {
        if (!names.has(target)) return;
        panel = node(target, [panel]);
      }
      tree = node(family, [leaf(family + "Trigger", "Open " + family.toLowerCase()), panel], {
        defaultOpen: open,
      });
      break;
    }
    case "Select": {
      if (!requireNames("Select", "SelectTrigger", "SelectValue", "SelectContent", "SelectItem"))
        return;
      let content = [
        leaf("SelectItem", "First option", { value: "first" }),
        leaf("SelectItem", "Second option", { value: "second" }),
      ];
      if (/Scroll(?:Up|Down)Button$/.test(target))
        content.push(
          ...Array.from({ length: 24 }, (_, index) =>
            leaf("SelectItem", `Option ${index + 3}`, { value: `option-${index + 3}` }),
          ),
        );
      if (target === "SelectGroup") content = [node(target, content)];
      else if (target === "SelectLabel")
        content = [node("SelectGroup", [leaf(target, "Options"), ...content])];
      else if (/Select(?:Separator|ScrollUpButton|ScrollDownButton)/.test(target))
        content.push(node(target));
      tree = node(
        "Select",
        [
          node("SelectTrigger", [node("SelectValue", [], { placeholder: "Choose an option" })], {
            "aria-label": "Example selection",
          }),
          node(
            "SelectContent",
            content,
            /Scroll(?:Up|Down)Button$/.test(target)
              ? { style: { maxHeight: "160px" }, position: "popper" }
              : {},
          ),
        ],
        { defaultOpen: !["Select", "SelectTrigger", "SelectValue"].includes(target) },
      );
      break;
    }
    case "Collapsible": {
      if (!requireNames("Collapsible", "CollapsibleTrigger", "CollapsibleContent")) return;
      tree = node(
        "Collapsible",
        [
          leaf("CollapsibleTrigger", "Toggle details"),
          leaf("CollapsibleContent", "Example details"),
        ],
        { defaultOpen: open },
      );
      break;
    }
    case "Breadcrumb": {
      if (!requireNames("Breadcrumb", "BreadcrumbList", "BreadcrumbItem", "BreadcrumbLink")) return;
      const content =
        target === "BreadcrumbPage"
          ? leaf(target, "Current page")
          : leaf("BreadcrumbLink", "Home", { href: "#" });
      const parts = [node("BreadcrumbItem", [content])];
      if (target === "BreadcrumbSeparator" || target === "BreadcrumbEllipsis")
        parts.push(node(target));
      tree = node("Breadcrumb", [node("BreadcrumbList", parts)]);
      break;
    }
    case "ToggleGroup": {
      if (!requireNames("ToggleGroup", "ToggleGroupItem")) return;
      tree = node(
        "ToggleGroup",
        [
          leaf("ToggleGroupItem", "Left", { value: "left", "aria-label": "Align left" }),
          leaf("ToggleGroupItem", "Right", { value: "right", "aria-label": "Align right" }),
        ],
        { type: "single", defaultValue: "left" },
      );
      break;
    }
    case "InputOTP": {
      if (!requireNames("InputOTP", "InputOTPGroup", "InputOTPSlot")) return;
      const children: DemoNode[] = [
        node("InputOTPSlot", [], { index: 0 }),
        node("InputOTPSlot", [], { index: 1 }),
      ];
      if (target === "InputOTPSeparator") children.push(node(target));
      children.push(node("InputOTPSlot", [], { index: 2 }));
      tree = node("InputOTP", [node("InputOTPGroup", children)], {
        maxLength: 3,
        defaultValue: "123",
        "aria-label": "Example verification code",
      });
      break;
    }
    case "Avatar": {
      if (!requireNames("Avatar", "AvatarImage", "AvatarFallback")) return;
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#64748b"/><text x="20" y="26" text-anchor="middle" fill="white">JD</text></svg>';
      tree = node("Avatar", [
        node("AvatarImage", [], {
          src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
          alt: "Example avatar",
        }),
        leaf("AvatarFallback", "JD"),
      ]);
      if (target === "AvatarFallback") tree.children = [leaf(target, "JD")];
      break;
    }
    case "NavigationMenu": {
      if (
        !requireNames(
          "NavigationMenu",
          "NavigationMenuList",
          "NavigationMenuItem",
          "NavigationMenuTrigger",
          "NavigationMenuContent",
          "NavigationMenuLink",
        )
      )
        return;
      const item = node(
        "NavigationMenuItem",
        [
          leaf("NavigationMenuTrigger", "Explore"),
          node("NavigationMenuContent", [
            leaf("NavigationMenuLink", "Example page", { href: "#" }),
          ]),
        ],
        { value: "example" },
      );
      const children = [node("NavigationMenuList", [item])];
      if (names.has(target) && /(?:Indicator|Viewport)$/.test(target))
        children.push(node(target, [], { forceMount: true }));
      tree = node("NavigationMenu", children, { defaultValue: open ? "example" : undefined });
      break;
    }
    case "Sidebar": {
      if (
        !requireNames(
          "SidebarProvider",
          "Sidebar",
          "SidebarContent",
          "SidebarMenu",
          "SidebarMenuItem",
          "SidebarMenuButton",
        )
      )
        return;
      let menu: DemoNode = node("SidebarMenuItem", [leaf("SidebarMenuButton", "Example page")]);
      if (
        /^SidebarMenu(?:Sub|SubItem|SubButton)$/.test(target) &&
        requireNames("SidebarMenuSub", "SidebarMenuSubItem", "SidebarMenuSubButton")
      )
        menu = node("SidebarMenuItem", [
          leaf("SidebarMenuButton", "Section"),
          node("SidebarMenuSub", [
            node("SidebarMenuSubItem", [leaf("SidebarMenuSubButton", "Child page", { href: "#" })]),
          ]),
        ]);
      else if (/SidebarMenu(?:Action|Badge|Skeleton)$/.test(target))
        menu.children!.push(leaf(target, target.endsWith("Badge") ? "3" : "More"));
      let panel: DemoNode = node("SidebarContent", [
        node(sidebarMenuFragment ? target : "SidebarMenu", [menu]),
      ]);
      if (/SidebarGroup/.test(target))
        panel = node("SidebarContent", [
          node("SidebarGroup", [
            leaf("SidebarGroupLabel", "Example section"),
            node("SidebarGroupContent", [
              node(sidebarMenuFragment ? target : "SidebarMenu", [menu]),
            ]),
            ...(target === "SidebarGroupAction" ? [leaf(target, "+")] : []),
          ]),
        ]);
      if (/Sidebar(?:Header|Footer|Input|Separator|Rail|Trigger|Inset)$/.test(target))
        panel = node("SidebarContent", [
          panel,
          leaf(target, /Input/.test(target) ? "" : "Example"),
        ]);
      tree = node("SidebarProvider", [node("Sidebar", [panel], { collapsible: "none" })], {
        style: { minHeight: "180px", width: "18rem" },
      });
      break;
    }
    case "Card": {
      if (!requireNames("Card", "CardHeader", "CardTitle", "CardContent")) return;
      tree = node("Card", [
        node("CardHeader", [
          leaf("CardTitle", "Example card"),
          ...(names.has("CardDescription") ? [leaf("CardDescription", "A complete example")] : []),
        ]),
        leaf("CardContent", "Card content"),
        ...(names.has("CardFooter") ? [leaf("CardFooter", "Card footer")] : []),
      ]);
      break;
    }
    default:
      return;
  }
  if (!tree || !includesTarget(tree, new Set([target]))) return;
  const requiredNodes = (item: DemoNode | string): boolean =>
    typeof item === "string" ||
    ((names.has(item.name) || ((menuFragment || sidebarMenuFragment) && item.name === target)) &&
      (item.children || []).every(requiredNodes));
  return requiredNodes(tree) ? tree : undefined;
}
