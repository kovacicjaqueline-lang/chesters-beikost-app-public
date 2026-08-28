'use strict';

function installSharedWebKitClient(browserType, wsEndpoint) {
  if (!wsEndpoint) return false;

  const originalLaunch = browserType.launch.bind(browserType);
  const originalConnect = browserType.connect.bind(browserType);

  Object.defineProperty(browserType, 'launch', {
    configurable: true,
    value: async (options) => {
      const hasCustomLaunchOptions = options && Object.keys(options).length > 0;
      if (hasCustomLaunchOptions) return originalLaunch(options);
      return originalConnect(wsEndpoint);
    },
  });
  return true;
}

async function startSharedWebKitServer(browserType) {
  const browserServer = await browserType.launchServer();
  return {
    wsEndpoint: browserServer.wsEndpoint(),
    close: () => browserServer.close(),
  };
}

module.exports = {
  installSharedWebKitClient,
  startSharedWebKitServer,
};
