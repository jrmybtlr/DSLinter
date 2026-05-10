import type { PlaygroundArgs } from "@dslint/workbench";

function j(s: string): string {
  return JSON.stringify(s);
}

export const usageSnippets: Partial<Record<string, (values: PlaygroundArgs) => string>> = {
  FlexStack: (v) =>
    `<FlexStack>\n  <div>${String(v.blockA)}</div>\n  <div>${String(v.blockB)}</div>\n</FlexStack>`,

  ContentCard: (v) =>
    `<ContentCard title={${j(String(v.cardTitle))}}>\n  {/* compose children: copy, row, FormField, NavLink */}\n</ContentCard>`,

  FormField: (v) => `<FormField id={${j(String(v.id))}} label={${j(String(v.label))}} />`,

  InlineCode: (v) =>
    `<p className="text-sm">\n  Theme key <InlineCode>${String(v.snippet)}</InlineCode> …\n</p>`,

  LoadingSkeleton: () => "<LoadingSkeleton />",

  NavLink: (v) => `<NavLink href={${j(String(v.href))}}>${String(v.text)}</NavLink>`,

  PageHero: (v) =>
    v.showSubtitle
      ? `<PageHero title={${j(String(v.title))}} subtitle={${j(String(v.subtitle))}} />`
      : `<PageHero title={${j(String(v.title))}} />`,

  PrimaryButton: (v) => {
    const t = v.type === "submit" ? "submit" : "button";
    return `<PrimaryButton type="${t}">\n  ${String(v.label)}\n</PrimaryButton>`;
  },

  StatusBadge: (v) => {
    const tone = v.tone === "neutral" || v.tone === "danger" ? String(v.tone) : "success";
    return `<StatusBadge tone="${tone}">\n  ${String(v.text)}\n</StatusBadge>`;
  },

  UserAvatar: (v) => `<UserAvatar src={demoAvatarSrc} name={${j(String(v.name))}} />`,

  ChaosGrid: (v) =>
    `<ChaosGrid>\n  <span>${String(v.cellText).replace(/</g, "&lt;")}</span>\n</ChaosGrid>`,

  DeprecatedChip: (v) => `<DeprecatedChip label={${j(String(v.label))}} />`,

  FlashBanner: (v) =>
    v.showBadLink
      ? `<FlashBanner>\n  <p>${String(v.title)}</p>\n  <a>Missing href</a>\n</FlashBanner>`
      : `<FlashBanner>\n  <p>${String(v.title)}</p>\n</FlashBanner>`,

  InconsistentToggle: (v) => {
    const pressed = v.pressedTone === "off" ? "off" : "on";
    return `<InconsistentToggle pressedTone="${pressed}">\n  ${String(v.label)}\n</InconsistentToggle>`;
  },

  InlinePaint: (v) => `<InlinePaint>${String(v.text)}</InlinePaint>`,

  KitchenSinkModal: (v) =>
    `<KitchenSinkModal\n  title={${j(String(v.title))}}\n  subtitle={${j(String(v.subtitle))}}\n  confirmLabel={${j(String(v.confirmLabel))}}\n  cancelLabel={${j(String(v.cancelLabel))}}\n  width={${j(String(v.width))}}\n  icon={${j(String(v.icon))}}\n  dismissible={${Boolean(v.dismissible)}}\n  initialFocus={${j(String(v.initialFocus))}}\n  bannerTone={${j(String(v.bannerTone))}}\n  footerAlign={${j(String(v.footerAlign))}}\n  scrollLock={${Boolean(v.scrollLock)}}\n  overlayBlur={${Boolean(v.overlayBlur)}}\n  analyticsId={${j(String(v.analyticsId))}}\n  testId={${j(String(v.testId))}}\n  role={${j(String(v.role))}}\n  portal={${Boolean(v.portal)}}\n/>`,

  LegacyButton: (v) => `<LegacyButton>${String(v.label)}</LegacyButton>`,

  MysteryImage: () => "<MysteryImage />",

  DuplicateCardA: () => "<Card />",

  DuplicateCardB: () => "<Card />",
};
