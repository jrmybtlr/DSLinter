import { preview } from "dslinter/preview";
import type { PreviewAdapter } from "dslinter/preview";
import { toast } from "sonner";
import { Toaster } from "./resources/js/components/ui/sonner";

export default {
    previews: {
        Toaster: preview(Toaster, ({ node }) => (
            <>
                {node}
                <button
                    type="button"
                    onClick={() => toast("Example notification")}
                >
                    Show notification
                </button>
            </>
        )),
    },
} satisfies PreviewAdapter;
