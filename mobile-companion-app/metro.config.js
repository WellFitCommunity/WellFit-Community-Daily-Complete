const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for additional asset types
config.resolver.assetExts.push(
  // Add svg support
  'svg',
  // Add additional image formats
  'webp'
);

// Customize transformer to handle specific file types
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;