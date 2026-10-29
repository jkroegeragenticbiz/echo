// Expo's default Metro config detects the pnpm workspace and watches packages/*.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @vercel/blob/client -> @vercel/oidc -> jose resolves to jose's Node build,
// which needs node:buffer. jose ships a WebCrypto build under the "browser"
// export condition; use it for jose only, leaving every other package alone.
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstream ?? context.resolveRequest;
  if (moduleName === "jose" || moduleName.startsWith("jose/")) {
    return resolve(
      { ...context, unstable_conditionNames: ["browser", ...(context.unstable_conditionNames ?? [])] },
      moduleName,
      platform,
    );
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
