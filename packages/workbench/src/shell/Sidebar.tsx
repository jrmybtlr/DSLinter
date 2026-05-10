import type { PlaygroundEntry } from "../types/playground";
import type { HashRoute } from "./hashRoute";

type Props = {
  entries: PlaygroundEntry[];
  route: HashRoute;
  onNavigate: (next: HashRoute) => void;
};

function navButtonClass(active: boolean) {
  return `w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition ${
    active
      ? "bg-slate-900 text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;
}

function sectionLabel(text: string) {
  return (
    <p className="mb-1.5 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 first:mt-0">
      {text}
    </p>
  );
}

export function Sidebar({ entries, route, onNavigate }: Props) {
  const overviewActive = route.view === "overview";
  const tokensActive = route.view === "tokens";
  const governanceActive = route.view === "governance";

  return (
    <aside className="fixed h-full w-[240px] overflow-y-auto shrink-0 flex-col border-r">
      <div className="border-b border-slate-200 px-6 py-4 sticky top-0 bg-white">
        <p className=" text-neutral-900 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
              <g fill="currentColor">
                <path fill="currentColor" d="M13 0L10.1 0 9.7 0.4 8 3 2 3 2 7 6 7 3 13 3 16 6 16 6.3 15.6 8 13 14 13 14 9 10 9 13 3z"></path>
              </g>
            </svg>
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {sectionLabel("Explore")}
        <button
          type="button"
          onClick={() => onNavigate({ view: "overview" })}
          className={navButtonClass(overviewActive)}
        >
          Overview
        </button>

        {sectionLabel("Components")}
        <ul className="space-y-0.5">
          {entries.map((e) => {
            const active = route.view === "component" && route.componentId === e.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onNavigate({ view: "component", componentId: e.id })}
                  className={navButtonClass(active)}
                >
                  {e.meta.title}
                </button>
              </li>
            );
          })}
        </ul>

        {sectionLabel("System")}
        <button
          type="button"
          onClick={() => onNavigate({ view: "tokens" })}
          className={navButtonClass(tokensActive)}
        >
          Design tokens
        </button>
        <button
          type="button"
          onClick={() => onNavigate({ view: "governance" })}
          className={`${navButtonClass(governanceActive)} mt-0.5`}
        >
          Governance
        </button>
      </nav>
    </aside>
  );
}
