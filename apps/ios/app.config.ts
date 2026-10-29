import type { ConfigContext, ExpoConfig } from "expo/config";

const APP_GROUP = "group.ai.getecho.shared";
const BUNDLE_ID = "ai.getecho.app";

// Google's public sample app id keeps dev builds from crashing before you
// create your own AdMob app. Production builds must set ADMOB_APP_ID.
const ADMOB_TEST_APP_ID = "ca-app-pub-3940256099942544~1458002511";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Echo",
  slug: "echo",
  scheme: "echo",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  backgroundColor: "#F7F6F2",
  ios: {
    bundleIdentifier: BUNDLE_ID,
    appleTeamId: process.env.APPLE_TEAM_ID,
    supportsTablet: false,
    usesAppleSignIn: true,
    entitlements: {
      "com.apple.security.application-groups": [APP_GROUP],
      // The bearer token lives in a keychain group the Share Extension can read.
      "keychain-access-groups": [`$(AppIdentifierPrefix)${APP_GROUP}`],
    },
    infoPlist: {
      // Used to build the keychain access group at runtime (see modules/echo-shared).
      AppIdentifierPrefix: "$(AppIdentifierPrefix)",
      NSPhotoLibraryUsageDescription: "Echo reads the screenshots and videos you choose so it can save the posts in them.",
      ITSAppUsesNonExemptEncryption: false,
      LSApplicationQueriesSchemes: ["itms-apps"],
    },
  },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { image: "./assets/icon.png", imageWidth: 160, backgroundColor: "#F7F6F2" }],
    "expo-apple-authentication",
    "expo-secure-store",
    "expo-web-browser",
    ["expo-build-properties", { ios: { deploymentTarget: "17.0" } }],
    [
      "react-native-google-mobile-ads",
      {
        iosAppId: process.env.ADMOB_APP_ID ?? ADMOB_TEST_APP_ID,
        // Echo requests non-personalized ads only and never shows the tracking prompt.
        delayAppMeasurementInit: true,
      },
    ],
    "@bacons/apple-targets",
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
