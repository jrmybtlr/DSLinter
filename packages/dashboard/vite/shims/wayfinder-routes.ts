/**
 * Minimal Wayfinder route stubs for dslinter component previews (no Laravel backend).
 */

type RouteHelper = {
  url: (params?: Record<string, unknown>) => string;
  form: (options?: Record<string, unknown>) => Record<string, unknown>;
};

function routeHelper(path = "#"): RouteHelper {
  return {
    url: () => path,
    form: () => ({ action: path, method: "post" }),
  };
}

export const dashboard = routeHelper("/dashboard");
export const logout = routeHelper("/logout");
export const home = routeHelper("/");
export const login = routeHelper("/login");
export const register = routeHelper("/register");

export const edit = routeHelper("/profile");
export const confirm = routeHelper("/two-factor/confirm");
export const enable = routeHelper("/two-factor/enable");
export const disable = routeHelper("/two-factor/disable");
export const regenerateRecoveryCodes = routeHelper("/two-factor/recovery-codes");
export const qrCode = routeHelper("/two-factor/qr-code");
export const recoveryCodes = routeHelper("/two-factor/recovery-codes");
export const secretKey = routeHelper("/two-factor/secret-key");
