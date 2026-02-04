# Digital Stethoscope Integration Guide

## Overview

WellFit's telehealth platform supports FDA-cleared digital stethoscopes for remote auscultation during video consultations. This enables physicians to remotely listen to heart sounds, lung sounds, and bowel sounds with clinical-grade audio quality.

## Supported Devices

### 1. Eko CORE Digital Stethoscope

**Recommended** - Best overall integration

- **Model**: Eko CORE or Eko DUO
- **Price**: ~$200-300
- **FDA Clearance**: ✅ Yes
- **Connectivity**: Bluetooth 5.0
- **Battery Life**: ~9 hours continuous use
- **Audio Quality**: 40x amplification, noise reduction
- **Integration**: Excellent - native Bluetooth streaming

**Setup Steps:**

1. **Initial Device Setup**
   ```
   - Download Eko app (iOS/Android)
   - Create Eko account
   - Pair stethoscope via app
   - Update firmware if prompted
   ```

2. **Computer Pairing**
   ```
   - Windows: Settings > Bluetooth > Add Device > Eko CORE
   - Mac: System Preferences > Bluetooth > Eko CORE
   - Linux: bluetoothctl > scan on > pair XX:XX:XX:XX
   ```

3. **Browser Configuration**
   ```
   - Chrome: chrome://settings/content/microphone
   - Allow microphone for wellfit domain
   - Select "Eko CORE" as input device
   ```

4. **WellFit Integration**
   ```
   - Start telehealth call
   - Click "Stethoscope" button
   - Select "Eko CORE" from device list
   - Green indicator shows connection
   ```

**Best Practices:**
- Fully charge before each shift (takes ~2 hours)
- Use in "streaming mode" for best audio quality
- Clean diaphragm with 70% isopropyl alcohol between patients
- Keep firmware updated via Eko app

---

### 2. 3M Littmann CORE Digital Stethoscope

**Premium Option** - Trusted brand, excellent quality

- **Model**: 3M Littmann CORE
- **Price**: ~$500
- **FDA Clearance**: ✅ Yes
- **Connectivity**: Bluetooth 5.0
- **Battery Life**: ~12 hours
- **Audio Quality**: 40x amplification, active noise cancellation
- **Integration**: Excellent - native streaming

**Setup Steps:**

1. **Initial Setup**
   ```
   - Download 3M Littmann app
   - Power on stethoscope (press button)
   - Pair via app
   - Configure amplification settings (1x-40x)
   ```

2. **Computer Pairing**
   ```
   - Enable Bluetooth on computer
   - Put stethoscope in pairing mode (hold button 5 seconds)
   - Select "Littmann CORE" in Bluetooth settings
   ```

3. **WellFit Integration**
   ```
   - Join telehealth session
   - Click "Stethoscope" button in controls
   - Select "3M Littmann CORE" from audio devices
   - Adjust amplification via stethoscope buttons
   ```

**Best Practices:**
- Use active noise cancellation in noisy environments
- Adjust amplification based on heart/lung sounds (typically 20x-30x)
- Battery lasts ~12 hours with ambient sound recording off
- Sync recordings to 3M app for patient history

---

### 3. Thinklabs One Digital Stethoscope

**Budget-Friendly** - Great for high-volume clinics

- **Model**: Thinklabs One
- **Price**: ~$400
- **FDA Clearance**: ✅ Yes
- **Connectivity**: Bluetooth 4.2 or USB
- **Battery Life**: ~10 hours
- **Audio Quality**: 100x amplification, selectable filters
- **Integration**: Good - USB preferred for telehealth

**Setup Steps:**

1. **USB Connection (Recommended for Telehealth)**
   ```
   - Connect Thinklabs One via USB cable
   - Install Thinklabs driver if prompted (Windows)
   - Device appears as "Thinklabs One USB Audio"
   ```

2. **Bluetooth Connection**
   ```
   - Press power button to enter pairing mode
   - Pair via computer Bluetooth settings
   - Select as audio input device
   ```

3. **WellFit Integration**
   ```
   - During telehealth call
   - Click "Stethoscope" button
   - Select "Thinklabs One" from device list
   - Use stethoscope controls to adjust filters
   ```

**Best Practices:**
- USB connection provides better audio quality than Bluetooth
- Use heart filter (bell mode) for cardiac auscultation
- Use lung filter (diaphragm mode) for respiratory sounds
- Amplification up to 100x - start low and increase as needed

---

## Clinical Workflow Integration

### Pre-Visit Setup

1. **Device Check** (5 minutes before visit)
   ```
   ✓ Stethoscope charged (>50% battery)
   ✓ Bluetooth/USB connection active
   ✓ Test audio in system settings
   ✓ Clean diaphragm
   ```

2. **Audio Test**
   ```
   - Start test call in Daily.co
   - Connect stethoscope
   - Listen to own heartbeat
   - Verify other participant can hear
   ```

### During Visit

1. **Patient Positioning**
   ```
   - Ask patient to expose chest area (if comfortable)
   - Ensure good lighting for visual confirmation
   - Position patient at arm's length from device
   ```

2. **Remote Auscultation**
   ```
   Provider: "I'm going to ask you to place the stethoscope
   on different areas of your chest. I'll guide you through
   each position."

   - Show patient diagram of auscultation points
   - Guide placement via video
   - Ask patient to hold still and breathe normally
   - Listen for 5-10 seconds per position
   ```

3. **Standard Auscultation Points**
   ```
   Cardiac (5 points):
   1. Aortic area (2nd right intercostal space)
   2. Pulmonic area (2nd left intercostal space)
   3. Erb's point (3rd left intercostal space)
   4. Tricuspid area (4th left intercostal space)
   5. Mitral area (5th left intercostal space, midclavicular)

   Pulmonary (6 points):
   1. Right upper anterior
   2. Left upper anterior
   3. Right middle anterior
   4. Left middle anterior
   5. Right posterior base
   6. Left posterior base
   ```

4. **Audio Quality Optimization**
   ```
   If audio is unclear:
   - Ask patient to hold stethoscope more firmly
   - Increase amplification (Eko/Littmann: 30x+)
   - Ask patient to move to quieter location
   - Check patient's internet connection
   - Ensure patient is holding breath during auscultation
   ```

### Post-Visit Documentation

SmartScribe automatically captures:
- Auscultation findings in transcript
- Suggests appropriate CPT codes:
  - **92950** - Cardiopulmonary resuscitation
  - **93303** - Transthoracic echo (if abnormal sounds detected)
  - **94010** - Spirometry (if wheezing noted)

Manual documentation:
```
Document in encounter note:
- "Remote cardiac auscultation performed via digital
  stethoscope. Normal S1 and S2, no murmurs, rubs, or
  gallops appreciated."
- Include audio recording link (if saved)
```

---

## Technical Details

### Audio Specifications

| Device | Sample Rate | Bit Depth | Frequency Range | Latency |
|--------|-------------|-----------|-----------------|---------|
| Eko CORE | 48 kHz | 16-bit | 20 Hz - 20 kHz | ~50ms |
| Littmann CORE | 48 kHz | 24-bit | 20 Hz - 2 kHz | ~40ms |
| Thinklabs One | 44.1 kHz | 16-bit | 20 Hz - 2 kHz | ~60ms (BT), ~20ms (USB) |

### Bandwidth Requirements

For optimal stethoscope audio:
- **Minimum**: 1 Mbps upload (patient), 2 Mbps download (provider)
- **Recommended**: 3 Mbps upload, 5 Mbps download
- **Codec**: Opus (Daily.co default)
- **Audio Quality**: Set to "music" mode in Daily.co for best fidelity

### Browser Compatibility

| Browser | Eko Support | Littmann Support | Thinklabs Support |
|---------|-------------|------------------|-------------------|
| Chrome 90+ | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| Edge 90+ | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| Safari 14+ | ⚠️ Good | ⚠️ Good | ⚠️ Good |
| Firefox 88+ | ✅ Good | ✅ Good | ⚠️ Limited |

**Note**: Chrome/Edge recommended for best compatibility.

---

## Troubleshooting

### Issue: Stethoscope not detected

**Solutions:**
1. Check Bluetooth is enabled and device is powered on
2. Un-pair and re-pair device in system settings
3. Restart browser
4. Grant microphone permissions to WellFit domain
5. Try different USB port (Thinklabs USB only)

### Issue: Poor audio quality / static

**Solutions:**
1. Check battery level (>20% recommended)
2. Move closer to computer (Bluetooth range: ~30 feet)
3. Reduce other Bluetooth devices nearby (interference)
4. Clean stethoscope diaphragm
5. Increase amplification on device
6. Ask patient to hold stethoscope more firmly
7. Switch to USB connection (Thinklabs)

### Issue: Echo or feedback during auscultation

**Solutions:**
1. Provider should use headphones (not speakers)
2. Mute provider microphone during auscultation
3. Reduce stethoscope amplification
4. Check for multiple audio devices enabled

### Issue: Delayed audio

**Solutions:**
1. Check internet connection speed
2. Close other applications using bandwidth
3. Switch to USB connection (if available)
4. Disable video temporarily for better audio priority
5. Reduce video quality in Daily.co settings

---

## Billing & Reimbursement

### CPT Codes for Remote Auscultation

Digital stethoscope use during telehealth can support:

- **99213-99215**: Established patient office visits
  - Document: "Remote cardiac and pulmonary auscultation performed via FDA-cleared digital stethoscope"

- **99421-99423**: Online digital evaluation
  - Include stethoscope findings in documentation

- **G2250**: Remote evaluation of recorded video/images
  - If saving and reviewing stethoscope audio recordings

### Documentation Requirements

For proper reimbursement:
```
Required documentation:
✓ Device used (e.g., "Eko CORE digital stethoscope")
✓ Areas auscultated
✓ Findings (normal vs. abnormal)
✓ Clinical decision-making based on findings
✓ Audio quality notation (if poor quality affected exam)

Example:
"Remote cardiac auscultation performed using Eko CORE
digital stethoscope. Auscultated 5 cardiac areas and 6
pulmonary fields. Normal S1/S2 heard in all areas, no
murmurs. Clear breath sounds bilaterally with good air
entry. Based on auscultation findings, no acute cardiac
or pulmonary pathology identified."
```

---

## Patient Education Materials

### Sample Script for Patients

```
"Today we'll be using a digital stethoscope for me to
listen to your heart and lungs. You'll place the
stethoscope on different areas of your chest, and I'll
be able to hear through the video call. It's the same
as a regular stethoscope, just wireless.

Here's what to expect:
1. I'll show you exactly where to place it
2. Hold it firmly against your skin
3. Stay very still and quiet
4. Breathe normally unless I ask you to hold your breath
5. We'll do about 5-6 positions total

This helps me do a thorough exam even though we're not
in the same room."
```

### Visual Guide for Patients

Create a patient handout with:
- Photo of digital stethoscope
- Diagram of placement locations
- Step-by-step instructions
- Troubleshooting tips

---

## Maintenance & Care

### Daily
- Clean diaphragm with 70% isopropyl alcohol
- Wipe down with medical-grade disinfectant
- Check battery level

### Weekly
- Deep clean entire device
- Check for firmware updates (via app)
- Test Bluetooth connection quality

### Monthly
- Full battery cycle (drain to 0%, charge to 100%)
- Inspect diaphragm for wear
- Verify audio quality with test recording

### Annually
- Send for calibration (if required by manufacturer)
- Replace batteries if not holding charge
- Consider upgrading firmware/hardware

---

## Infection Control

### Between Patients (Telehealth)
```
Since stethoscope is used by patient:
- Patient should clean hands before handling
- Wipe diaphragm with alcohol wipe before use
- Instruct patient to clean after use
```

### Between In-Person and Telehealth Use
```
- Full disinfection with hospital-grade wipes
- 1-minute contact time
- Air dry before storage
- Never immerse in liquid
```

### Approved Disinfectants
- 70% isopropyl alcohol
- Caviwipes
- Sani-Cloth AF3
- PDI Super Sani-Cloth

---

## Future Enhancements

### Planned Features
- [ ] AI-powered heart murmur detection
- [ ] Automated auscultation scoring
- [ ] Integration with ECG devices
- [ ] Phonocardiogram generation
- [ ] Audio recording library per patient
- [ ] Multi-stethoscope support (for teaching)

### Research Integration
- Heart sound analysis using AI
- Longitudinal tracking of cardiac sounds
- Predictive analytics for heart failure
- Integration with wearable devices

---

## FDA Compliance

All recommended devices are FDA-cleared:
- **Eko CORE**: FDA 510(k) K172837
- **3M Littmann CORE**: FDA 510(k) K192003
- **Thinklabs One**: FDA 510(k) K163203

**Important**: Only use FDA-cleared devices for clinical decision-making.

---

## Support Resources

### Manufacturer Support
- **Eko**: support@ekohealth.com | (510) 281-8840
- **3M Littmann**: 1-800-228-3957
- **Thinklabs**: support@thinklabs.com

### WellFit Technical Support
- GitHub Issues for bug reports
- Documentation updates at /docs/TELEHEALTH_SETUP.md

### Clinical Questions
- Consult your medical director for clinical use policies
- Review institutional telehealth guidelines
- Check state medical board telehealth regulations

---

**You're now ready to perform clinical-grade remote auscultation!**
