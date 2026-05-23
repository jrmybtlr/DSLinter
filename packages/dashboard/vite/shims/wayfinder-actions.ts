/**
 * Minimal Wayfinder action stubs for dslinter component previews (no Laravel backend).
 */

type ActionMethod = {
  url: (id?: number | string) => string;
  form: (options?: Record<string, unknown>) => Record<string, unknown>;
};

function actionMethod(path = "#"): ActionMethod {
  return {
    url: () => path,
    form: () => ({ action: path, method: "post" }),
  };
}

const controllerHandler: ProxyHandler<Record<string, ActionMethod>> = {
  get(_target, prop) {
    if (typeof prop !== "string") return undefined;
    return actionMethod(`/${prop}`);
  },
};

const controllerStub = new Proxy(
  {} as Record<string, ActionMethod>,
  controllerHandler,
);

/** Default export used as `ProfileController.destroy.form()`. */
export default controllerStub;

/** Named export used as `destroy.url(id)`. */
export const destroy = actionMethod("/passkeys");
