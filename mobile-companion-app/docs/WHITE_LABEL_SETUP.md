# White Label Setup Guide

## Complete Guide to Creating Your Branded Healthcare Monitoring App

This guide walks you through setting up a fully branded version of the Dementia Care Monitor app for your healthcare organization.

---

## 📋 Pre-Setup Checklist

Before starting, ensure you have:

- [ ] Healthcare organization legal entity established
- [ ] Google Play Developer account ($25 one-time fee)
- [ ] Apple Developer account ($99/year)
- [ ] Company branding assets (logo, colors, fonts)
- [ ] Legal review capabilities for privacy policy/terms
- [ ] Technical team or contractor for app store submission

---

## 🎯 Step 1: Brand Configuration

### 1.1 Create Your Brand Environment File

```bash
# Copy the template
cp .env.template .env.yourcompany

# Edit with your brand details
nano .env.yourcompany
```

### 1.2 Essential Brand Information

Fill out these critical fields in your `.env.yourcompany` file:

```bash
# Replace "YourCompany" with your actual company name
BRAND_COMPANY_NAME="MediCare Solutions LLC"
BRAND_APP_NAME="Patient Safety Monitor"

# Your primary brand color (hex code)
BRAND_PRIMARY_COLOR="#1976D2"

# Contact information (critical for app store approval)
BRAND_SUPPORT_EMAIL="support@medicare-solutions.com"
BRAND_EMERGENCY_EMAIL="emergency@medicare-solutions.com"

# Unique package name (reverse domain notation)
BRAND_PACKAGE_NAME="com.medicare.patientsafety"
```

### 1.3 Legal Information

```bash
# Your legal business entity
BRAND_LEGAL_ENTITY="MediCare Solutions LLC"
BRAND_WEBSITE="https://medicare-solutions.com"

# Where you'll host legal documents
BRAND_PRIVACY_URL="https://medicare-solutions.com/privacy"
BRAND_TERMS_URL="https://medicare-solutions.com/terms"
```

---

## 🎨 Step 2: Asset Creation

### 2.1 Generate Asset Templates

```bash
# This creates templates and guides
npm run generate-assets
```

### 2.2 Required Assets to Create

#### App Icons (Critical)
- **app-icon.png**: 1024x1024 main app icon
- **adaptive-icon-foreground.png**: 1024x1024 Android adaptive icon
- **adaptive-icon-background.png**: 1024x1024 Android background

#### Store Graphics
- **feature-graphic.png**: 1024x500 Google Play feature image
- **promo-graphic.png**: 180x120 Google Play promotional image

#### Screenshots (5+ required)
1. **Dashboard**: Main app interface
2. **Map View**: Geofencing setup
3. **Health Monitoring**: Pulse oximetry interface
4. **Emergency Contacts**: Contact management
5. **Settings**: Configuration options

### 2.3 Professional Asset Creation

**Option A: Use Generated SVG Template**
- Open `assets/generated/app-icon-template.svg`
- Modify colors and add your logo
- Export to required PNG sizes

**Option B: Professional Design Services**
- Hire designer using `assets/BRANDING_GUIDE.md`
- Provide brand guidelines and color palette
- Request all formats specified in asset manifest

**Option C: Design Tools**
- Canva Pro: Use medical app templates
- Adobe Creative Suite: Professional quality
- Figma: Collaborative design platform

---

## 📄 Step 3: Legal Documents

### 3.1 Privacy Policy Customization

1. Edit `docs/PRIVACY_POLICY.md`
2. Replace all `{{BRAND_*}}` placeholders
3. Review with legal counsel
4. Host on your website at the URL specified in your env file

### 3.2 Terms of Service Customization

1. Edit `docs/TERMS_OF_SERVICE.md`
2. Replace all `{{BRAND_*}}` placeholders
3. Review liability limitations with legal counsel
4. Host on your website

### 3.3 Critical Legal Requirements

#### Medical Disclaimers (Required)
- "Not a medical device"
- "Supplements, not replaces professional care"
- "Call 911 for emergencies"

#### HIPAA Compliance Statements
- Data encryption standards
- User consent procedures
- Data retention policies
- Access control measures

---

## 🔧 Step 4: Technical Setup

### 4.1 Development Environment

```bash
# Install dependencies
npm install

# Install Expo CLI
npm install -g @expo/cli eas-cli

# Login to Expo
expo login
eas login
```

### 4.2 Configure External Services

#### Google Maps API Key
1. Visit Google Cloud Console
2. Enable Maps SDK for Android/iOS
3. Create API key with restrictions
4. Add to your `.env.yourcompany` file

#### EAS Project Setup
```bash
# Configure EAS for your brand
eas build:configure

# Update your .env file with project ID
EAS_PROJECT_ID="your-generated-project-id"
```

---

## 🏗️ Step 5: Building Your App

### 5.1 Test Build (Development)

```bash
# Test your brand configuration
BRAND_CONFIG=yourcompany npm run build:android:dev
```

### 5.2 Production Build

```bash
# Build for Google Play Store
npm run build:custom:android

# Build for Apple App Store
npm run build:custom:ios
```

### 5.3 Build Verification

After build completes:
- [ ] Download and install test APK
- [ ] Verify all branding appears correctly
- [ ] Test core functionality (location, health monitoring)
- [ ] Verify emergency features work
- [ ] Check privacy policy links work

---

## 🏪 Step 6: App Store Setup

### 6.1 Google Play Console

#### App Creation
1. Create new app in Play Console
2. App name: Your `BRAND_APP_NAME`
3. Category: Medical
4. Target audience: Adults

#### Store Listing
- **Title**: "{{Your App Name}} - Patient Safety & Health Tracking"
- **Short description**: Your `BRAND_SHORT_DESC`
- **Full description**: Use generated description from `store-listing.json`
- **Screenshots**: Upload your 5+ screenshots
- **Feature graphic**: Upload your 1024x500 graphic

#### Content Rating
- Complete questionnaire for medical app
- Select "Contains health/medical information: YES"
- Age rating will be "Teen" for medical content

#### Data Safety Section
Declare data collection:
- **Location data**: Precise location (required for geofencing)
- **Health data**: Health info (required for pulse oximetry)
- **Personal info**: Name, email, phone (emergency contacts)
- **Device identifiers**: For app functionality

### 6.2 Apple App Store Connect

#### App Information
- Name: Your `BRAND_APP_NAME`
- Bundle ID: Your `BRAND_PACKAGE_NAME`
- Category: Medical
- Age Rating: 17+ (medical app)

#### App Privacy
- Complete privacy nutrition labels
- Declare location and health data collection
- Link to your hosted privacy policy

---

## 💰 Step 7: Pricing Strategy

### Recommended Pricing
- **Consumer Market**: $29.99 - $39.99 one-time purchase
- **Professional Market**: $49.99 - $79.99 one-time purchase
- **Enterprise**: Custom licensing

### Pricing Considerations
- No subscription (builds trust for medical apps)
- Higher price = higher perceived quality
- One-time purchase preferred for healthcare

---

## 🚀 Step 8: Launch Process

### 8.1 Soft Launch (Recommended)

1. **Internal Testing**: Team members test thoroughly
2. **Closed Beta**: 20-50 healthcare professionals
3. **Limited Geographic Launch**: One state/region first
4. **Full Launch**: After validation and feedback

### 8.2 Marketing Preparation

#### Target Audiences
- **Primary**: Family caregivers of dementia patients
- **Secondary**: Professional caregivers and facilities
- **Tertiary**: Healthcare providers and doctors

#### Marketing Channels
- Healthcare trade publications
- Caregiver support groups and forums
- Medical conference exhibitions
- Digital health industry publications
- LinkedIn advertising to healthcare professionals

---

## 📊 Step 9: Success Metrics

### Technical KPIs
- **App Stability**: >99.5% crash-free sessions
- **Location Accuracy**: ±5 meters 95% of time
- **Emergency Response**: <30 second alert delivery
- **Battery Efficiency**: <5% drain per hour

### Business KPIs
- **Download Conversion**: % of store visitors who download
- **User Retention**: % still using after 7 days
- **Support Tickets**: Volume of support requests
- **App Store Rating**: Target 4.5+ stars
- **Revenue per Download**: Track pricing effectiveness

---

## 🔧 Step 10: Post-Launch Support

### 10.1 Monitoring Setup

```bash
# Add crash reporting (optional)
expo install expo-firebase-crashlytics

# Add analytics (anonymized)
expo install expo-firebase-analytics
```

### 10.2 Update Schedule

- **Security Patches**: Within 48 hours
- **Bug Fixes**: Weekly releases as needed
- **Feature Updates**: Monthly releases
- **OS Compatibility**: With each major iOS/Android release

### 10.3 Support Infrastructure

#### Customer Support
- Dedicated support email
- FAQ documentation
- Video tutorials for setup
- Healthcare provider training materials

#### Technical Support
- Crash monitoring and response
- Performance optimization
- App store compliance maintenance
- Security vulnerability monitoring

---

## 🚨 Common Issues & Solutions

### Build Failures
```bash
# Clear Expo cache
expo r -c

# Reset EAS configuration
eas build:configure --force

# Check environment variables are set
cat .env.yourcompany
```

### App Store Rejection
- **Medical Claims**: Ensure disclaimers are prominent
- **Privacy Policy**: Must be accessible before download
- **Age Rating**: Must be appropriate for health content
- **Screenshots**: Must show actual app functionality

### Legal Compliance
- **HIPAA**: Ensure encryption and privacy controls
- **FDA**: Confirm app doesn't diagnose or treat
- **State Laws**: Check local healthcare app regulations
- **International**: Consider GDPR if serving EU users

---

## 💡 Success Tips

### 1. Professional Presentation
- Use consistent branding throughout
- Professional screenshots with real (anonymized) data
- Clear, medical-grade descriptions
- Professional customer support

### 2. Healthcare Industry Standards
- Emphasize HIPAA compliance
- Include medical disclaimers prominently
- Price appropriately for healthcare market
- Build trust through transparency

### 3. Quality Assurance
- Test extensively on real devices
- Verify emergency features work reliably
- Ensure offline functionality
- Performance test with background location

### 4. Legal Protection
- Professional liability insurance
- Terms of service liability limitations
- Privacy policy legal review
- Intellectual property protection

---

## 📞 Support & Assistance

### Technical Support
**Email**: tech@wellfitcommunity.org
**Phone**: 1-800-WELLFIT ext. 2

### White Label Licensing
**Email**: enterprise@wellfitcommunity.org
**Phone**: 1-800-WELLFIT ext. 3

### Professional Services
- App store submission assistance
- Legal document review
- Professional asset creation
- Marketing strategy consultation

---

## 🎯 Quick Reference Checklist

Use this checklist to ensure you've completed all steps:

### Brand Setup ✅
- [ ] Environment file created and configured
- [ ] Brand colors and assets defined
- [ ] Contact information updated
- [ ] Package name unique and appropriate

### Legal Documents ✅
- [ ] Privacy policy customized and hosted
- [ ] Terms of service customized and hosted
- [ ] Medical disclaimers reviewed by legal counsel
- [ ] HIPAA compliance verified

### Technical Setup ✅
- [ ] Google Maps API key configured
- [ ] EAS project created and configured
- [ ] Build environment tested
- [ ] All external services configured

### Assets Created ✅
- [ ] App icon (1024x1024)
- [ ] Adaptive icons for Android
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (5+ professional quality)
- [ ] Splash screen branded

### App Store Preparation ✅
- [ ] Google Play Console account ready
- [ ] Apple Developer account ready
- [ ] Store listings prepared
- [ ] Content ratings completed
- [ ] Pricing strategy decided

### Build & Test ✅
- [ ] Development build successful
- [ ] Production build successful
- [ ] App tested on real devices
- [ ] Emergency features verified
- [ ] Privacy policy links working

### Launch Ready ✅
- [ ] Legal review completed
- [ ] Support infrastructure ready
- [ ] Marketing materials prepared
- [ ] Success metrics defined
- [ ] Post-launch plan established

---

**Your white label healthcare monitoring app is now ready for app store submission!**

*Estimated time to complete: 2-4 weeks with professional design assistance*