import { ChaosGrid } from "./components/bad/ChaosGrid";
import { DeprecatedChip } from "./components/bad/DeprecatedChip";
import { FlashBanner } from "./components/bad/FlashBanner";
import { InconsistentToggle } from "./components/bad/InconsistentToggle";
import { InlinePaint } from "./components/bad/InlinePaint";
import { KitchenSinkModal } from "./components/bad/KitchenSinkModal";
import { LegacyButton } from "./components/bad/LegacyButton";
import { MysteryImage } from "./components/bad/MysteryImage";
import { Card as DuplicateProductCard } from "./components/bad/duplicate/DuplicateCardB";
import { Card as DuplicateTeamCard } from "./components/bad/duplicate/DuplicateCardA";
import { ContentCard } from "./components/good/ContentCard";
import { FlexStack } from "./components/good/FlexStack";
import { FormField } from "./components/good/FormField";
import { InlineCode } from "./components/good/InlineCode";
import { LoadingSkeleton } from "./components/good/LoadingSkeleton";
import { NavLink } from "./components/good/NavLink";
import { PageHero } from "./components/good/PageHero";
import { PrimaryButton } from "./components/good/PrimaryButton";
import { StatusBadge } from "./components/good/StatusBadge";
import { UserAvatar } from "./components/good/UserAvatar";

const avatarSrc =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='24' r='14' fill='%232563eb'/%3E%3Cpath fill='%2394a3b8' d='M8 58c4-14 16-22 28-22s24 8 28 22'/%3E%3C/svg%3E";

export function DemoGallery() {
  return (
    <div className="min-h-screen bg-surface">
      <PageHero
        title="DSLint Tailwind demo"
        subtitle="Ten “good” components vs ten “bad” patterns for lint exploration."
      />

      <main className="mx-auto grid max-w-6xl gap-layout-lg px-layout-lg py-layout-lg lg:grid-cols-2">
        <FlexStack>
          <ContentCard title="Good — tokens & a11y">
            <p className="mb-layout-md">
              Uses extended Tailwind theme (<InlineCode>primary</InlineCode>,{" "}
              <InlineCode>surface</InlineCode>, <InlineCode>layout-*</InlineCode> spacing).
            </p>
            <div className="flex flex-wrap items-center gap-layout-md">
              <PrimaryButton>Save</PrimaryButton>
              <UserAvatar src={avatarSrc} name="Jordan Lee" />
              <StatusBadge tone="success">Synced</StatusBadge>
            </div>
            <div className="mt-layout-md space-y-layout-sm">
              <FormField id="email" label="Email" />
              <NavLink href="/tokens">Token docs</NavLink>
            </div>
          </ContentCard>

          <LoadingSkeleton />

          <ContentCard title="Good — layout primitive">
            <p>FlexStack composes children with consistent gaps.</p>
          </ContentCard>
        </FlexStack>

        <FlexStack>
          <ContentCard title="Bad — entropy gallery">
            <FlashBanner>
              <>
                <p className="font-medium">Hardcoded neon banner</p>
                <a className="mt-2 block text-sm underline opacity-90">Missing href</a>
              </>
            </FlashBanner>
            <div className="mt-layout-md space-y-layout-md">
              <LegacyButton>Legacy glow</LegacyButton>
              <DeprecatedChip label="old-api" />
              <MysteryImage />
              <InlinePaint>Inline hex panel</InlinePaint>
              <ChaosGrid>
                <span>chaotic</span>
              </ChaosGrid>
              <InconsistentToggle pressedTone="on">
                Inconsistent prop naming
              </InconsistentToggle>
            </div>
          </ContentCard>

          <ContentCard title="Bad — duplicate `Card` exports">
            <p className="mb-layout-sm text-slate-600">
              Two files both export <InlineCode>Card</InlineCode> — DSLint duplicate-component.
            </p>
            <div className="flex flex-col gap-layout-sm">
              <DuplicateTeamCard />
              <DuplicateProductCard />
            </div>
          </ContentCard>

          <ContentCard title="Bad — variant explosion (15 props on one tag)">
            <KitchenSinkModal
              title="Kitchen sink"
              subtitle="Too many knobs on one JSX tag"
              icon="warn"
              confirmLabel="Continue"
              cancelLabel="Go back"
              width="640px"
              dismissible={true}
              initialFocus="confirm"
              bannerTone="critical"
              footerAlign="end"
              scrollLock={true}
              overlayBlur={true}
              analyticsId="demo-kitchen-sink"
              testId="kitchen-sink-modal"
              role="dialog"
            />
          </ContentCard>
        </FlexStack>
      </main>
    </div>
  );
}
