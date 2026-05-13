import type { PlaygroundEntry } from "../types/playground";
import type { HashRoute } from "./hashRoute";

type Props = {
  entries: PlaygroundEntry[];
  route: HashRoute;
  onNavigate: (next: HashRoute) => void;
};

function navButtonClass(active: boolean) {
  return `w-full rounded-md px-2.5 py-1.5 text-left text-sm transition ${
    active
      ? "bg-gray-900 text-white shadow-xs"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
  }`;
}

function sectionLabel(text: string) {
  return (
    <p className="mb-1.5 mt-4 px-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 first:mt-0">
      {text}
    </p>
  );
}

export function Sidebar({ entries, route, onNavigate }: Props) {
  const tokensActive = route.view === "tokens";
  const governanceActive = route.view === "governance";

  return (
    <aside className="fixed h-full w-[240px] overflow-y-auto shrink-0 flex-col border-r ">
      <div className="border-b  px-6 py-4 sticky top-0 bg-white">
        <p className=" text-neutral-900 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <g fill="currentColor">
              <path
                d="m22.346,4.836l-3.182-3.182c-.779-.78-2.049-.78-2.828,0l-3.182,3.182c-.78.78-.78,2.048,0,2.828l3.182,3.182c.39.39.902.585,1.414.585s1.024-.195,1.414-.585l3.182-3.182c.78-.78.78-2.048,0-2.828Z"
                fill="currentColor"
                stroke-width="0"
              ></path>
              <rect
                x="2"
                y="2"
                width="9"
                height="9"
                rx="2"
                ry="2"
                stroke-width="0"
                fill="currentColor"
              ></rect>
              <rect
                x="13"
                y="13"
                width="9"
                height="9"
                rx="2"
                ry="2"
                stroke-width="0"
                fill="currentColor"
              ></rect>
              <rect
                x="2"
                y="13"
                width="9"
                height="9"
                rx="2"
                ry="2"
                stroke-width="0"
                fill="currentColor"
              ></rect>
            </g>
          </svg>
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {sectionLabel("Explore")}
        <button
          type="button"
          onClick={() => onNavigate({ view: "governance" })}
          className={navButtonClass(governanceActive)}
        >
          Governance
        </button>

        {sectionLabel("Components")}
        <div className="space-y-0.5">
          {entries.map((e, i) => {
            const active =
              route.view === "component" && route.componentId === e.id;
            const prev = entries[i - 1];
            const showGroup =
              Boolean(e.meta.group) &&
              (!prev || prev.meta.group !== e.meta.group);
            return (
              <div key={e.id}>
                {showGroup && e.meta.group ? sectionLabel(e.meta.group) : null}
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({ view: "component", componentId: e.id })
                  }
                  className={navButtonClass(active)}
                >
                  {e.meta.title}
                </button>
              </div>
            );
          })}
        </div>

        {sectionLabel("System")}
        <button
          type="button"
          onClick={() => onNavigate({ view: "tokens" })}
          className={navButtonClass(tokensActive)}
        >
          Design tokens
        </button>
      </nav>
    </aside>
  );
}
