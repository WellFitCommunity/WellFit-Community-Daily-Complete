#!/usr/bin/env node

// Build and deployment script for white label apps
// Handles brand-specific builds and app store submissions

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  platforms: ['android', 'ios'],
  profiles: ['development', 'preview', 'production'],
  brands: ['wellfit', 'custom']
};

// Utility functions
const log = (message) => console.log(`📱 ${message}`);
const error = (message) => console.error(`❌ ${message}`);
const success = (message) => console.log(`✅ ${message}`);

// Validate environment
const validateEnvironment = (brand, platform, profile) => {
  log('Validating environment...');

  // Check required tools
  const requiredTools = ['npx', 'expo', 'eas'];
  requiredTools.forEach(tool => {
    try {
      execSync(`which ${tool}`, { stdio: 'ignore' });
    } catch (e) {
      error(`Required tool not found: ${tool}`);
      process.exit(1);
    }
  });

  // Check environment file
  const envFile = `.env.${brand}`;
  if (!fs.existsSync(envFile)) {
    error(`Environment file not found: ${envFile}`);
    error('Create this file with brand-specific configuration');
    process.exit(1);
  }

  // Validate brand config
  if (!config.brands.includes(brand)) {
    error(`Invalid brand: ${brand}. Available: ${config.brands.join(', ')}`);
    process.exit(1);
  }

  if (!config.platforms.includes(platform)) {
    error(`Invalid platform: ${platform}. Available: ${config.platforms.join(', ')}`);
    process.exit(1);
  }

  if (!config.profiles.includes(profile)) {
    error(`Invalid profile: ${profile}. Available: ${config.profiles.join(', ')}`);
    process.exit(1);
  }

  success('Environment validation passed');
};

// Setup brand environment
const setupBrandEnvironment = (brand) => {
  log(`Setting up ${brand} brand environment...`);

  // Copy brand-specific environment
  const envFile = `.env.${brand}`;
  const targetEnv = '.env';

  if (fs.existsSync(envFile)) {
    fs.copyFileSync(envFile, targetEnv);
    success(`Copied ${envFile} to ${targetEnv}`);
  } else {
    log(`No specific env file found for ${brand}, using defaults`);
  }

  // Validate brand configuration is loaded
  try {
    delete require.cache[require.resolve('../config/brand-config.js')];
    const brandConfig = require('../config/brand-config.js').default;
    log(`Brand loaded: ${brandConfig.companyName}`);
    log(`App name: ${brandConfig.appName}`);
    log(`Package: ${brandConfig.appStore.packageName}`);
  } catch (e) {
    error(`Failed to load brand config: ${e.message}`);
    process.exit(1);
  }
};

// Pre-build checks
const preBuildChecks = (platform, profile) => {
  log('Running pre-build checks...');

  // Check assets exist
  const requiredAssets = [
    'assets/icons/app-icon.png',
    'assets/splash/splash.png'
  ];

  if (platform === 'android') {
    requiredAssets.push(
      'assets/icons/adaptive-icon-foreground.png',
      'assets/icons/adaptive-icon-background.png'
    );
  }

  const missingAssets = requiredAssets.filter(asset => !fs.existsSync(asset));
  if (missingAssets.length > 0) {
    error('Missing required assets:');
    missingAssets.forEach(asset => error(`  - ${asset}`));
    error('Run: npm run generate-assets');
    process.exit(1);
  }

  // Production-specific checks
  if (profile === 'production') {
    // Check legal documents exist
    const legalDocs = [
      'docs/PRIVACY_POLICY.md',
      'docs/TERMS_OF_SERVICE.md'
    ];

    const missingDocs = legalDocs.filter(doc => !fs.existsSync(doc));
    if (missingDocs.length > 0) {
      error('Missing legal documents for production build:');
      missingDocs.forEach(doc => error(`  - ${doc}`));
      process.exit(1);
    }

    // Check environment variables
    const requiredEnvVars = ['GOOGLE_MAPS_API_KEY', 'EAS_PROJECT_ID'];
    const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
    if (missingEnvVars.length > 0) {
      error('Missing environment variables for production:');
      missingEnvVars.forEach(env => error(`  - ${env}`));
      process.exit(1);
    }
  }

  success('Pre-build checks passed');
};

// Build the app
const buildApp = (platform, profile) => {
  log(`Building ${platform} app with ${profile} profile...`);

  try {
    const buildCommand = `npx eas build --platform ${platform} --profile ${profile} --non-interactive`;
    log(`Running: ${buildCommand}`);

    execSync(buildCommand, {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: profile }
    });

    success(`${platform} build completed successfully`);
  } catch (e) {
    error(`Build failed: ${e.message}`);
    process.exit(1);
  }
};

// Submit to app store
const submitToStore = (platform) => {
  log(`Submitting ${platform} build to app store...`);

  try {
    const submitCommand = `npx eas submit --platform ${platform} --non-interactive`;
    log(`Running: ${submitCommand}`);

    execSync(submitCommand, {
      stdio: 'inherit'
    });

    success(`${platform} submission completed`);
  } catch (e) {
    error(`Submission failed: ${e.message}`);
    process.exit(1);
  }
};

// Generate store assets
const generateStoreAssets = (brand) => {
  log('Generating store assets...');

  try {
    execSync('node scripts/generate-assets.js', { stdio: 'inherit' });
    success('Store assets generated');
  } catch (e) {
    error(`Asset generation failed: ${e.message}`);
    process.exit(1);
  }
};

// Main build process
const main = () => {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Usage: node build-and-deploy.js <brand> <platform> <profile> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  brand:    wellfit | custom');
    console.log('  platform: android | ios');
    console.log('  profile:  development | preview | production');
    console.log('');
    console.log('Options:');
    console.log('  --submit      Submit to app store after build');
    console.log('  --assets      Generate assets before build');
    console.log('  --skip-checks Skip pre-build validation');
    console.log('');
    console.log('Examples:');
    console.log('  node build-and-deploy.js wellfit android production');
    console.log('  node build-and-deploy.js custom ios preview --assets');
    console.log('  node build-and-deploy.js wellfit android production --submit');
    process.exit(1);
  }

  const [brand, platform, profile] = args;
  const options = {
    submit: args.includes('--submit'),
    assets: args.includes('--assets'),
    skipChecks: args.includes('--skip-checks')
  };

  log(`Starting build process for ${brand} ${platform} ${profile}`);

  // Validation
  if (!options.skipChecks) {
    validateEnvironment(brand, platform, profile);
  }

  // Setup
  setupBrandEnvironment(brand);

  // Generate assets if requested
  if (options.assets) {
    generateStoreAssets(brand);
  }

  // Pre-build checks
  if (!options.skipChecks) {
    preBuildChecks(platform, profile);
  }

  // Build
  buildApp(platform, profile);

  // Submit if requested
  if (options.submit && profile === 'production') {
    submitToStore(platform);
  }

  success('Build process completed successfully!');

  if (profile === 'production' && !options.submit) {
    log('');
    log('🏪 Ready for app store submission!');
    log(`To submit: node build-and-deploy.js ${brand} ${platform} ${profile} --submit`);
  }
};

// Error handling
process.on('uncaughtException', (error) => {
  error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  validateEnvironment,
  setupBrandEnvironment,
  buildApp,
  submitToStore,
  main
};