import { useCallback, useState } from "react";
import { hideCatalogComponent } from "../dashboard/updateDslintConfig";
import { Button } from "./ui/button";

type Props = {
  componentName: string;
  onHidden: (componentName: string) => void;
};

export function HideFromCatalogButton({ componentName, onHidden }: Props) {
  const [pending, setPending] = useState(false);

  const handleClick = useCallback(async () => {
    if (
      !window.confirm(
        `Hide ${componentName} from the component catalog? This updates hidden_components in .dslinter.json.`,
      )
    ) {
      return;
    }
    setPending(true);
    try {
      await hideCatalogComponent(componentName);
      onHidden(componentName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      window.alert(`Could not hide ${componentName}: ${message}`);
    } finally {
      setPending(false);
    }
  }, [componentName, onHidden]);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => void handleClick()}
    >
      {pending ? "Hiding…" : "Hide from catalog"}
    </Button>
  );
}
