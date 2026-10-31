import { createElement, type ComponentProps } from "react";
import { toast } from "sonner";
import type { PreviewAdapter } from "dslinter/preview";
import { Toaster as PreviewTarget } from "./resources/js/components/ui/sonner.tsx";

export default {
    previews: {
        "resources/js/components/ui/sonner.tsx#Toaster": {
            PlaygroundPreview: ({
                values,
            }: {
                values: ComponentProps<typeof PreviewTarget>;
            }) =>
                createElement(
                    "div",
                    null,
                    createElement(PreviewTarget, values),
                    createElement(
                        "button",
                        {
                            type: "button",
                            onClick: () => toast("Example notification"),
                        },
                        "Show notification",
                    ),
                ),
        },
    },
} satisfies PreviewAdapter;
