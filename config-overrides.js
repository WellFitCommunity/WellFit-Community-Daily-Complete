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

module.exports = function override(config) {
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
};
