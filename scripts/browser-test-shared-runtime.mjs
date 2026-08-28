export function createSharedBrowserFacade(browser) {
  const ownedContexts = new Set();

  return new Proxy(browser, {
    get(target, property) {
      if (property === "newContext") {
        return async (...args) => {
          const context = await target.newContext(...args);
          ownedContexts.add(context);
          return context;
        };
      }

      if (property === "newPage") {
        return async (...args) => {
          const page = await target.newPage(...args);
          if (typeof page?.context === "function") ownedContexts.add(page.context());
          return page;
        };
      }

      if (property === "close") {
        return async () => {
          const contexts = [...ownedContexts];
          ownedContexts.clear();
          await Promise.allSettled(contexts.map((context) => context.close()));
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function installSharedWebKitClient(browserType, wsEndpoint) {
  if (!wsEndpoint) return false;

  const originalLaunch = browserType.launch.bind(browserType);
  const originalConnect = browserType.connect.bind(browserType);

  Object.defineProperty(browserType, "launch", {
    configurable: true,
    value: async (options) => {
      const hasCustomLaunchOptions = options && Object.keys(options).length > 0;
      if (hasCustomLaunchOptions) return originalLaunch(options);

      const browser = await originalConnect(wsEndpoint);
      return createSharedBrowserFacade(browser);
    },
  });
  return true;
}

export async function startSharedWebKitServer(browserType) {
  const browserServer = await browserType.launchServer();
  return {
    wsEndpoint: browserServer.wsEndpoint(),
    close: () => browserServer.close(),
  };
}
