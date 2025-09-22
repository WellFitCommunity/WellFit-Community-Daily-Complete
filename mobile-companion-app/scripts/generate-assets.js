#!/usr/bin/env node

// Asset Generation Script for White Label Apps
// Generates app icons, screenshots, and store graphics

const fs = require('fs');
const path = require('path');
const brandConfig = require('../config/brand-config.js').default;

// Asset specifications for app stores
const assetSpecs = {
  // App Icons
  icons: {
    'app-icon.png': { width: 1024, height: 1024 },
    'adaptive-icon.png': { width: 1024, height: 1024 },
    'adaptive-icon-foreground.png': { width: 1024, height: 1024 },
    'adaptive-icon-background.png': { width: 1024, height: 1024 },
    'favicon.png': { width: 48, height: 48 },
    'notification-icon.png': { width: 96, height: 96 }
  },

  // Splash Screens
  splash: {
    'splash.png': { width: 1284, height: 2778 }, // iPhone 12 Pro Max
    'splash-android.png': { width: 1080, height: 1920 } // Android
  },

  // Store Graphics
  store: {
    'feature-graphic.png': { width: 1024, height: 500 }, // Google Play
    'promo-graphic.png': { width: 180, height: 120 }, // Google Play small
    'tv-banner.png': { width: 1280, height: 720 } // Android TV
  },

  // Screenshots (we'll generate templates)
  screenshots: {
    'screenshot-1-dashboard.png': { width: 1080, height: 1920 },
    'screenshot-2-geofencing.png': { width: 1080, height: 1920 },
    'screenshot-3-health-monitoring.png': { width: 1080, height: 1920 },
    'screenshot-4-emergency-contacts.png': { width: 1080, height: 1920 },
    'screenshot-5-settings.png': { width: 1080, height: 1920 }
  }
};

// SVG template for app icon
const generateAppIconSVG = (config) => `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${config.colors.primary};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${config.colors.secondary};stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <dropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" rx="180" fill="url(#bg)"/>

  <!-- Main Icon - Medical Cross + Location Pin -->
  <g transform="translate(512,512)">
    <!-- Location Pin -->
    <circle cx="0" cy="-100" r="80" fill="${config.colors.background}" filter="url(#shadow)"/>
    <circle cx="0" cy="-100" r="50" fill="${config.colors.emergency}"/>
    <circle cx="0" cy="-100" r="25" fill="${config.colors.background}"/>

    <!-- Medical Cross -->
    <rect x="-15" y="-50" width="30" height="100" fill="${config.colors.background}" filter="url(#shadow)"/>
    <rect x="-50" y="-15" width="100" height="30" fill="${config.colors.background}" filter="url(#shadow)"/>

    <!-- Heart Monitor Line -->
    <path d="M -150,50 L -100,50 L -80,20 L -60,80 L -40,10 L -20,90 L 0,30 L 20,70 L 40,40 L 60,60 L 80,30 L 100,50 L 150,50"
          stroke="${config.colors.accent}" stroke-width="8" fill="none" opacity="0.8"/>
  </g>

  <!-- Company Name (if short enough) -->
  ${config.companyName.length <= 12 ? `
  <text x="512" y="900" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="48" font-weight="bold" fill="${config.colors.background}">
    ${config.companyName}
  </text>` : ''}
</svg>`;

// Create directory structure
const createDirectories = () => {
  const dirs = [
    'assets/icons',
    'assets/splash',
    'assets/store',
    'assets/screenshots',
    'assets/logos',
    'assets/generated'
  ];

  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✓ Created directory: ${dir}`);
    }
  });
};

// Generate asset templates
const generateAssetTemplates = () => {
  console.log('🎨 Generating asset templates...');

  // Generate app icon SVG
  const iconSVG = generateAppIconSVG(brandConfig);
  fs.writeFileSync(
    path.join(__dirname, '..', 'assets/generated/app-icon-template.svg'),
    iconSVG
  );

  // Generate asset specifications JSON
  const assetManifest = {
    brand: brandConfig.companyName,
    appName: brandConfig.appName,
    generated: new Date().toISOString(),
    specifications: assetSpecs,
    colors: brandConfig.colors,
    instructions: {
      icons: "Convert SVG template to PNG at required sizes using design software",
      screenshots: "Capture actual app screenshots at specified dimensions",
      store: "Create marketing graphics using brand colors and messaging",
      compliance: "Ensure all assets meet Google Play and App Store guidelines"
    }
  };

  fs.writeFileSync(
    path.join(__dirname, '..', 'assets/generated/asset-manifest.json'),
    JSON.stringify(assetManifest, null, 2)
  );

  console.log('✓ Generated app icon SVG template');
  console.log('✓ Generated asset manifest');
};

// Generate store listing content
const generateStoreListing = () => {
  console.log('📝 Generating store listing content...');

  const storeListing = {
    title: `${brandConfig.appName} - Patient Safety & Health Tracking`,
    shortDescription: brandConfig.appStore.shortDescription,
    fullDescription: generateFullDescription(brandConfig),
    keywords: brandConfig.appStore.keywords,
    category: brandConfig.appStore.category,
    contentRating: brandConfig.appStore.contentRating,
    pricing: {
      model: "one-time-purchase",
      suggestedPrice: "$39.99",
      alternatives: ["$29.99", "$49.99"]
    },
    screenshots: {
      required: 5,
      recommended: 8,
      descriptions: [
        "Main dashboard showing patient status and alerts",
        "Interactive map with geofencing zones",
        "Health monitoring interface with vital signs",
        "Emergency contacts and communication setup",
        "Settings and configuration options"
      ]
    }
  };

  fs.writeFileSync(
    path.join(__dirname, '..', 'assets/generated/store-listing.json'),
    JSON.stringify(storeListing, null, 2)
  );

  console.log('✓ Generated store listing content');
};

// Generate full app description
const generateFullDescription = (config) => `
${config.appName} is a comprehensive safety and health monitoring solution designed specifically for caregivers and healthcare professionals. Our production-grade app provides peace of mind through advanced technology and HIPAA-compliant data protection.

🛡️ ADVANCED SAFETY MONITORING
• Customizable geofencing with GPS precision
• Real-time location tracking with background monitoring
• Instant alerts when patients leave designated safe zones
• Emergency notifications to multiple contacts
• Comprehensive location history and movement analysis

❤️ HEALTH MONITORING
• Camera-based pulse oximetry for heart rate and oxygen saturation
• Continuous health trend tracking and analysis
• Automated alerts for concerning vital signs
• Historical health data for healthcare provider consultations

🔒 HIPAA COMPLIANT & SECURE
• AES-256 data encryption for maximum security
• Secure local data storage with privacy protection
• Configurable data retention policies
• No cloud storage of sensitive data without explicit consent
• Industry-standard privacy controls

🚨 EMERGENCY FEATURES
• One-touch caregiver and emergency calling
• Smart emergency contact management
• Real-time location sharing capabilities
• Direct 911 dialing integration
• Offline functionality for critical features

Perfect for family caregivers, professional healthcare facilities, assisted living communities, and medical professionals managing patient safety and monitoring.

IMPORTANT MEDICAL DISCLAIMER: This app supplements, not replaces, professional medical care and supervision. Always consult healthcare providers for medical decisions and maintain traditional emergency procedures.

Developed by ${config.companyName} with a focus on reliability, security, and user safety.`;

// Generate README with branding instructions
const generateBrandingGuide = () => {
  const guide = `# ${brandConfig.companyName} - Asset Generation Guide

## Overview
This guide helps you create all required assets for ${brandConfig.appName} app store deployment.

## Brand Configuration
Current brand: **${brandConfig.companyName}**
App name: **${brandConfig.appName}**
Primary color: **${brandConfig.colors.primary}**
Package name: **${brandConfig.appStore.packageName}**

## Required Assets Checklist

### App Icons
- [ ] app-icon.png (1024x1024) - Main app icon
- [ ] adaptive-icon.png (1024x1024) - Android adaptive icon
- [ ] favicon.png (48x48) - Small icon for web

### Store Graphics
- [ ] feature-graphic.png (1024x500) - Google Play feature graphic
- [ ] promo-graphic.png (180x120) - Google Play promo graphic

### Screenshots (5-8 required)
- [ ] Dashboard view showing main interface
- [ ] Map view with geofencing zones
- [ ] Health monitoring interface
- [ ] Emergency contacts setup
- [ ] Settings and configuration

### Legal Documents
- [ ] Privacy Policy (template provided)
- [ ] Terms of Service (template provided)
- [ ] Data Safety declarations

## Asset Creation Tools

### Recommended Software
- **Adobe Illustrator/Photoshop** - Professional design
- **Canva** - Easy templates and graphics
- **Figma** - Collaborative design
- **GIMP** - Free alternative to Photoshop

### Screenshot Generation
1. Use device simulators (Android Studio, Xcode)
2. Capture at 1080x1920 resolution
3. Show real app functionality
4. Use consistent lighting and styling
5. Include relevant data (anonymized)

### Color Guidelines
Use brand colors consistently:
- Primary: ${brandConfig.colors.primary}
- Secondary: ${brandConfig.colors.secondary}
- Accent: ${brandConfig.colors.accent}
- Emergency: ${brandConfig.colors.emergency}

## Store Listing Optimization

### Title: "${brandConfig.appName} - Patient Safety & Health Tracking"
### Keywords: ${brandConfig.appStore.keywords}
### Category: ${brandConfig.appStore.category}
### Content Rating: ${brandConfig.appStore.contentRating}

## Contact for Asset Creation
For professional asset creation services:
Email: ${brandConfig.contact.supportEmail}
Phone: ${brandConfig.contact.phone}

## Next Steps
1. Generate assets using provided templates
2. Test assets in app store preview tools
3. Validate compliance with store guidelines
4. Submit for app store review

---
Generated on ${new Date().toISOString()}
Brand: ${brandConfig.companyName}
`;

  fs.writeFileSync(
    path.join(__dirname, '..', 'assets/BRANDING_GUIDE.md'),
    guide
  );

  console.log('✓ Generated branding guide');
};

// Main execution
const main = () => {
  console.log(`🎯 Generating assets for: ${brandConfig.companyName}`);
  console.log(`📱 App name: ${brandConfig.appName}`);
  console.log(`🎨 Primary color: ${brandConfig.colors.primary}`);
  console.log('');

  createDirectories();
  generateAssetTemplates();
  generateStoreListing();
  generateBrandingGuide();

  console.log('');
  console.log('🎉 Asset generation complete!');
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Review generated templates in assets/generated/');
  console.log('2. Create actual graphics using the SVG template');
  console.log('3. Capture app screenshots at specified dimensions');
  console.log('4. Review store listing content in store-listing.json');
  console.log('5. Follow the branding guide for detailed instructions');
  console.log('');
  console.log(`📞 Need help? Contact: ${brandConfig.contact.supportEmail}`);
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateAssetTemplates, generateStoreListing, main };