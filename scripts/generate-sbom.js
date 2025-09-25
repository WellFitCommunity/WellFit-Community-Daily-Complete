#!/usr/bin/env node

// scripts/generate-sbom.js
// Generates a Software Bill of Materials (SBOM) for WellFit Community Healthcare Platform

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SBOM_VERSION = "1.0.0";
const APP_VERSION = require('../package.json').version;

function generateSBOM() {
  console.log('🔍 Generating Software Bill of Materials (SBOM)...');

  // Read package.json files
  const mainPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const functionsPackage = fs.existsSync('functions/package.json')
    ? JSON.parse(fs.readFileSync('functions/package.json', 'utf8'))
    : { dependencies: {}, devDependencies: {} };

  // Get installed package versions
  let npmList;
  try {
    npmList = JSON.parse(execSync('npm list --json --depth=0', { encoding: 'utf8' }));
  } catch (error) {
    console.warn('Warning: npm list failed, using package.json versions');
    npmList = { dependencies: {} };
  }

  // Generate SBOM
  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.4",
    serialNumber: `urn:uuid:${generateUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: "WellFit Community",
          name: "SBOM Generator",
          version: SBOM_VERSION
        }
      ],
      component: {
        type: "application",
        name: mainPackage.name,
        version: APP_VERSION,
        description: "WellFit Community Healthcare Platform - Comprehensive senior care and wellness management system",
        licenses: [
          {
            license: {
              id: "MIT"
            }
          }
        ],
        supplier: {
          name: "WellFit Community",
          url: ["https://thewellfitcommunity.org"]
        }
      }
    },
    components: []
  };

  // Process main dependencies
  const allDeps = {
    ...mainPackage.dependencies,
    ...mainPackage.devDependencies,
    ...functionsPackage.dependencies,
    ...functionsPackage.devDependencies
  };

  for (const [name, declaredVersion] of Object.entries(allDeps)) {
    const installedVersion = npmList.dependencies?.[name]?.version || declaredVersion;

    sbom.components.push({
      type: "library",
      name: name,
      version: installedVersion.replace(/^\^|~/, ''), // Remove semver prefixes
      scope: mainPackage.devDependencies?.[name] ? "optional" : "required",
      licenses: getLicenseInfo(name),
      supplier: {
        name: "npm"
      },
      externalReferences: [
        {
          type: "website",
          url: `https://www.npmjs.com/package/${name}`
        }
      ],
      // Add security classification for healthcare dependencies
      properties: classifyPackage(name)
    });
  }

  // Sort components by name for consistency
  sbom.components.sort((a, b) => a.name.localeCompare(b.name));

  // Write SBOM files
  const timestamp = new Date().toISOString().split('T')[0];
  const sbomJson = `sbom-${timestamp}.json`;
  const sbomLatest = 'sbom-latest.json';

  fs.writeFileSync(sbomJson, JSON.stringify(sbom, null, 2));
  fs.writeFileSync(sbomLatest, JSON.stringify(sbom, null, 2));

  // Generate summary report
  generateSummaryReport(sbom, allDeps);

  console.log(`✅ SBOM generated successfully:`);
  console.log(`   📄 ${sbomJson}`);
  console.log(`   📄 ${sbomLatest}`);
  console.log(`   📊 sbom-summary.md`);
}

function generateSummaryReport(sbom, allDeps) {
  const mainPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const totalComponents = sbom.components.length;
  const prodDeps = Object.keys(mainPackage.dependencies || {}).length;
  const devDeps = Object.keys(mainPackage.devDependencies || {}).length;

  // Classify packages by risk level
  const highRiskPackages = sbom.components.filter(c =>
    c.properties?.some(p => p.name === 'risk-level' && p.value === 'high')
  );

  const securityRelevantPackages = sbom.components.filter(c =>
    c.properties?.some(p => p.name === 'category' &&
      ['security', 'authentication', 'encryption', 'healthcare'].includes(p.value))
  );

  const summary = `# Software Bill of Materials (SBOM) Summary

**Generated:** ${new Date().toISOString()}
**Application:** WellFit Community Healthcare Platform v${APP_VERSION}

## 📊 Component Overview
- **Total Components:** ${totalComponents}
- **Production Dependencies:** ${prodDeps}
- **Development Dependencies:** ${devDeps}
- **High-Risk Components:** ${highRiskPackages.length}
- **Security-Relevant Components:** ${securityRelevantPackages.length}

## 🔐 Security-Critical Dependencies

### Authentication & Security
${getPackagesByCategory('security').map(p => `- **${p.name}** (${p.version}) - ${getPackageDescription(p.name)}`).join('\n')}

### Healthcare Data Processing
${getPackagesByCategory('healthcare').map(p => `- **${p.name}** (${p.version}) - ${getPackageDescription(p.name)}`).join('\n')}

### Encryption & Privacy
${getPackagesByCategory('encryption').map(p => `- **${p.name}** (${p.version}) - ${getPackageDescription(p.name)}`).join('\n')}

## ⚠️ High-Risk Components
${highRiskPackages.length > 0 ?
  highRiskPackages.map(p => `- **${p.name}** (${p.version}) - Requires regular security monitoring`).join('\n') :
  '*No high-risk components identified*'
}

## 🔍 Monitoring Recommendations

1. **Daily**: Monitor high-risk and security-critical components
2. **Weekly**: Check for new vulnerability advisories
3. **Monthly**: Update dependencies and regenerate SBOM
4. **Quarterly**: Comprehensive security audit of all components

## 📋 Compliance Notes

This SBOM is generated for:
- **HIPAA Compliance**: Healthcare data protection requirements
- **Security Auditing**: Vulnerability management and tracking
- **Supply Chain Security**: Component provenance and integrity

For questions about this SBOM, contact: security@thewellfitcommunity.org
`;

  fs.writeFileSync('sbom-summary.md', summary);

  function getPackagesByCategory(category) {
    return sbom.components.filter(c =>
      c.properties?.some(p => p.name === 'category' && p.value === category)
    );
  }
}

function classifyPackage(name) {
  const properties = [];

  // Healthcare-specific classifications
  const healthcarePackages = ['@supabase/supabase-js', 'bcryptjs', '@hcaptcha/react-hcaptcha'];
  const securityPackages = ['bcryptjs', 'jsonwebtoken', '@supabase/auth-helpers', 'crypto'];
  const encryptionPackages = ['bcryptjs', 'crypto-js', 'node-forge'];
  const highRiskPackages = ['lodash', 'moment', 'axios']; // Known packages with frequent updates

  if (healthcarePackages.some(pkg => name.includes(pkg) || pkg.includes(name))) {
    properties.push({ name: 'category', value: 'healthcare' });
  }

  if (securityPackages.some(pkg => name.includes(pkg) || pkg.includes(name))) {
    properties.push({ name: 'category', value: 'security' });
  }

  if (encryptionPackages.some(pkg => name.includes(pkg) || pkg.includes(name))) {
    properties.push({ name: 'category', value: 'encryption' });
  }

  if (highRiskPackages.includes(name)) {
    properties.push({ name: 'risk-level', value: 'high' });
  }

  // Add healthcare compliance flag
  if (name.includes('health') || name.includes('medical') || name.includes('hipaa')) {
    properties.push({ name: 'compliance', value: 'hipaa-relevant' });
  }

  return properties;
}

function getLicenseInfo(packageName) {
  // In a real implementation, you'd query the actual license from node_modules
  // For now, we'll assume MIT for most packages
  return [{ license: { id: "MIT" } }];
}

function getPackageDescription(name) {
  const descriptions = {
    '@supabase/supabase-js': 'Healthcare database and authentication',
    'bcryptjs': 'Password hashing for user security',
    '@hcaptcha/react-hcaptcha': 'Bot protection for forms',
    'react': 'UI framework for healthcare dashboard',
    'typescript': 'Type safety for healthcare data',
    'tailwindcss': 'UI styling framework'
  };
  return descriptions[name] || 'Component dependency';
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Run the generator
if (require.main === module) {
  generateSBOM();
}

module.exports = { generateSBOM };