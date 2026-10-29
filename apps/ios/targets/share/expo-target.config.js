/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "share",
  name: "EchoShare",
  displayName: "Echo",
  icon: "../../assets/share-icon.png",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "Vision", "UniformTypeIdentifiers"],
  colors: { $accent: "#111315" },
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
    "keychain-access-groups": config.ios.entitlements["keychain-access-groups"],
  },
});
