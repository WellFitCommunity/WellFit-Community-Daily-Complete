const brandConfig = require('./config/brand-config.js').default;

export default {
  expo: {
    name: brandConfig.appName,
    slug: brandConfig.appStore.packageName.split('.').pop() || 'care-monitor',
    version: "2.0.0",
    orientation: "portrait",
    icon: "./assets/icons/app-icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash/splash.png",
      resizeMode: "contain",
      backgroundColor: brandConfig.colors.primary
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: brandConfig.appStore.packageName,
      buildNumber: "1",
      infoPlist: {
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app needs location access to monitor patient safety and provide geofencing alerts for caregivers.",
        NSLocationWhenInUseUsageDescription: "This app needs location access to monitor patient safety and provide geofencing alerts for caregivers.",
        NSLocationAlwaysUsageDescription: "This app needs background location access to continuously monitor patient location for safety purposes.",
        NSCameraUsageDescription: "This app uses the camera to measure heart rate and oxygen saturation for health monitoring.",
        NSContactsUsageDescription: "This app needs access to contacts to set up emergency contact notifications.",
        NSMicrophoneUsageDescription: "This app may use the microphone for emergency calling features.",
        UIBackgroundModes: [
          "location",
          "background-fetch",
          "background-processing"
        ]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icons/adaptive-icon-foreground.png",
        backgroundImage: "./assets/icons/adaptive-icon-background.png"
      },
      package: brandConfig.appStore.packageName,
      versionCode: 1,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "SEND_SMS",
        "CALL_PHONE",
        "READ_CONTACTS",
        "WRITE_CONTACTS",
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "WRITE_EXTERNAL_STORAGE",
        "READ_EXTERNAL_STORAGE",
        "VIBRATE",
        "WAKE_LOCK",
        "RECEIVE_BOOT_COMPLETED",
        "FOREGROUND_SERVICE",
        "SYSTEM_ALERT_WINDOW"
      ],
      blockedPermissions: [
        "READ_PHONE_STATE",
        "RECORD_AUDIO"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      }
    },
    web: {
      favicon: "./assets/icons/favicon.png",
      bundler: "metro"
    },
    plugins: [
      "expo-location",
      "expo-camera",
      "expo-contacts",
      "expo-sms",
      "expo-font",
      "expo-notifications",
      [
        "expo-background-fetch",
        {
          android: {
            setTaskDescription: true
          }
        }
      ],
      [
        "expo-task-manager",
        {
          android: {
            setTaskDescription: true
          }
        }
      ],
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            minSdkVersion: 23
          },
          ios: {
            deploymentTarget: "13.0"
          }
        }
      ]
    ],
    extra: {
      brandConfig: brandConfig,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      eas: {
        projectId: process.env.EAS_PROJECT_ID
      }
    },
    owner: process.env.EXPO_OWNER || brandConfig.legal.entityName.toLowerCase().replace(/\s+/g, ''),
    privacy: "public",
    platforms: [
      "ios",
      "android"
    ]
  }
};