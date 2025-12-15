/**
 * Webpack Configuration Overrides
 *
 * Provides polyfills for Node.js modules used by the MCP SDK
 * that are not available in browser environments.
 *
 * The MCP SDK uses stdio transport which requires child_process
 * but these calls only happen server-side via Edge Functions.
 * Browser imports just need empty polyfills to compile.
 */

/**
 * Override dev server to fix webpack-dev-server 5.x compatibility.
 * react-scripts 5.0.1 uses deprecated options:
 * - onAfterSetupMiddleware/onBeforeSetupMiddleware -> setupMiddlewares
 */
function overrideDevServer(configFunction) {
  return function (proxy, allowedHost) {
    const config = configFunction(proxy, allowedHost);

    // Extract and remove all deprecated options
    const {
      onBeforeSetupMiddleware,
      onAfterSetupMiddleware,
      https,
      ...cleanConfig
    } = config;

    // Convert to new setupMiddlewares API
    cleanConfig.setupMiddlewares = (middlewares, devServer) => {
      if (onBeforeSetupMiddleware) {
        onBeforeSetupMiddleware(devServer);
      }
      if (onAfterSetupMiddleware) {
        onAfterSetupMiddleware(devServer);
      }
      return middlewares;
    };

    // Convert https option to server option (webpack-dev-server 5.x)
    if (https) {
      cleanConfig.server = {
        type: 'https',
        options: typeof https === 'object' ? https : {},
      };
    }

    return cleanConfig;
  };
}

function override(config) {
  // Add fallbacks for Node.js modules (both node: protocol and standard)
  config.resolve.fallback = {
    ...config.resolve.fallback,
    'child_process': false,
    'fs': false,
    'net': false,
    'tls': false,
    'dns': false,
    'path': false,
    'os': false,
    'crypto': false,
    'stream': false,
    'http': false,
    'https': false,
    'zlib': false,
    'util': false,
    'buffer': false,
    'url': false,
    'assert': false,
    'querystring': false,
    'events': false,
    'process': false,
    // node: protocol equivalents
    'node:process': false,
    'node:child_process': false,
    'node:fs': false,
    'node:path': false,
    'node:os': false,
    'node:crypto': false,
    'node:stream': false,
    'node:http': false,
    'node:https': false,
    'node:util': false,
    'node:buffer': false,
    'node:url': false,
    'node:events': false,
    'node:net': false,
    'node:tls': false,
    'node:dns': false,
  };

  // Handle node: protocol imports
  config.resolve.alias = {
    ...config.resolve.alias,
    'node:process': false,
    'node:child_process': false,
    'node:fs': false,
    'node:path': false,
    'node:os': false,
    'node:crypto': false,
    'node:stream': false,
    'node:http': false,
    'node:https': false,
    'node:util': false,
    'node:buffer': false,
    'node:url': false,
    'node:events': false,
  };

  return config;
}

module.exports = {
  webpack: override,
  devServer: overrideDevServer,
};
