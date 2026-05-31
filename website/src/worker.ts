type AssetsEnv = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

export default {
  async fetch(request: Request, env: AssetsEnv): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
