# 🔄 HANDOFF: FHIR Backend Integration Task

**Date:** October 2025
**Context Window:** 35% remaining in previous session
**Task Status:** READY TO IMPLEMENT
**Estimated Time:** 8 hours (1 day)

---

## 📋 TASK SUMMARY

**Goal:** Wire Immunization and CarePlan resources into the FHIR backend for bidirectional sync with Epic/Cerner EHRs.

**Current Status:**
- ✅ **Frontend:** Immunization and CarePlan fully working (patient UI at `/immunizations` and `/care-plans`)
- ✅ **Database:** Tables exist (`fhir_immunizations`, `fhir_care_plans`) and are populated
- ✅ **Service Layer:** `FHIRService.Immunization` and `FHIRService.CarePlan` work perfectly
- ❌ **FHIR Backend:** NOT wired into FHIR export/import for EHR sync

**The Gap:**
- Currently only Patient, Observation, and MedicationStatement sync to Epic/Cerner
- Immunization and CarePlan are NOT included in FHIR bundles
- Need to add them to achieve TRUE 100% US Core bidirectional sync

---

## 🎯 WHAT NEEDS TO BE BUILT

### 1. **Export Logic** (Immunization + CarePlan → Epic/Cerner)
**File to modify:** `src/components/admin/FhirIntegrationService.ts`

**Current method:** `exportPatientDataWithMedications()` (lines 931-975)
**Creates:** FHIR Bundle with Patient + Observations + MedicationStatements

**What to add:**
- New method: `exportPatientDataComplete(userId: string)`
- Fetch immunizations from `fhir_immunizations` table
- Fetch care plans from `fhir_care_plans` table
- Map to FHIR R4 format
- Add to bundle

---

### 2. **Import Logic** (Epic/Cerner → Immunization + CarePlan)
**File to modify:** `src/services/fhirInteroperabilityIntegrator.ts`

**Current method:** `importFHIRData()` (lines 577-641)
**Imports:** Patient demographics + Observations (vitals)

**What to add:**
- Parse incoming Immunization resources from FHIR bundle
- Parse incoming CarePlan resources from FHIR bundle
- Map FHIR R4 format to WellFit database schema
- Insert into `fhir_immunizations` and `fhir_care_plans` tables

---

### 3. **Fetch Logic** (Pull from Epic/Cerner)
**File to modify:** `src/services/fhirInteroperabilityIntegrator.ts`

**Current method:** `fetchPatientDataFromFHIR()` (lines 540-575)
**Fetches:** Patient + Observations from FHIR server

**What to add:**
- Fetch Immunization resources: `GET /Immunization?patient={id}`
- Fetch CarePlan resources: `GET /CarePlan?patient={id}&status=active`
- Include in returned data object

---

### 4. **Admin Dashboard Updates** (Optional but nice)
**File to modify:** `src/components/admin/FHIRInteroperabilityDashboard.tsx`

**What to add:**
- Checkboxes to enable/disable Immunization sync
- Checkboxes to enable/disable CarePlan sync
- Display sync stats for these resources

---

## 📝 IMPLEMENTATION PLAN

### **Step 1: Add Export Logic (2 hours)**

Create new method in `FhirIntegrationService.ts`:

```typescript
async exportPatientDataComplete(userId: string): Promise<FHIRBundle> {
  // 1. Get base bundle (Patient + Observations + Medications)
  const bundle = await this.exportPatientDataWithMedications(userId);

  // 2. Add Immunizations
  const { data: immunizations } = await this.supabase
    .from('fhir_immunizations')
    .select('*')
    .eq('patient_id', userId)
    .eq('status', 'completed');

  if (immunizations && immunizations.length > 0) {
    immunizations.forEach(imm => {
      const fhirImmunization = this.mapImmunizationToFHIR(imm);
      bundle.entry.push({
        fullUrl: `urn:uuid:immunization-${imm.id}`,
        resource: fhirImmunization
      });
    });
  }

  // 3. Add CarePlans
  const { data: carePlans } = await this.supabase
    .from('fhir_care_plans')
    .select('*')
    .eq('patient_id', userId)
    .in('status', ['active', 'on-hold']);

  if (carePlans && carePlans.length > 0) {
    carePlans.forEach(plan => {
      const fhirCarePlan = this.mapCarePlanToFHIR(plan);
      bundle.entry.push({
        fullUrl: `urn:uuid:careplan-${plan.id}`,
        resource: fhirCarePlan
      });
    });
  }

  return bundle;
}
```

Add helper methods:

```typescript
private mapImmunizationToFHIR(imm: any): any {
  return {
    resourceType: 'Immunization',
    id: imm.id,
    status: imm.status,
    vaccineCode: {
      coding: [{
        system: 'http://hl7.org/fhir/sid/cvx',
        code: imm.vaccine_code,
        display: imm.vaccine_name
      }]
    },
    patient: {
      reference: `Patient/${imm.patient_id}`
    },
    occurrenceDateTime: imm.occurrence_date,
    recorded: imm.recorded_date || imm.created_at,
    primarySource: imm.primary_source !== false,
    lotNumber: imm.lot_number,
    expirationDate: imm.expiration_date,
    site: imm.site ? {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActSite',
        code: this.mapSiteCode(imm.site),
        display: imm.site
      }]
    } : undefined,
    route: imm.route ? {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration',
        code: this.mapRouteCode(imm.route),
        display: imm.route
      }]
    } : undefined,
    doseQuantity: imm.dose_quantity ? {
      value: imm.dose_quantity,
      unit: imm.dose_unit || 'mL',
      system: 'http://unitsofmeasure.org',
      code: 'mL'
    } : undefined,
    performer: imm.performer ? [{
      actor: {
        display: imm.performer
      }
    }] : undefined,
    note: imm.notes ? [{
      text: imm.notes
    }] : undefined,
    protocolApplied: imm.dose_number ? [{
      doseNumberPositiveInt: imm.dose_number,
      seriesDosesPositiveInt: imm.series_doses
    }] : undefined,
    reaction: imm.reaction_date ? [{
      date: imm.reaction_date,
      detail: {
        display: imm.reaction_detail
      }
    }] : undefined
  };
}

private mapCarePlanToFHIR(plan: any): any {
  return {
    resourceType: 'CarePlan',
    id: plan.id,
    status: plan.status,
    intent: plan.intent,
    category: plan.category ? [{
      coding: [{
        system: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category',
        code: plan.category,
        display: plan.category
      }]
    }] : undefined,
    title: plan.title,
    description: plan.description,
    subject: {
      reference: `Patient/${plan.patient_id}`
    },
    period: {
      start: plan.period_start,
      end: plan.period_end
    },
    created: plan.created_at,
    author: plan.author ? {
      display: plan.author
    } : undefined,
    careTeam: plan.care_team_id ? [{
      reference: `CareTeam/${plan.care_team_id}`
    }] : undefined,
    addresses: plan.addresses_conditions ? plan.addresses_conditions.map((c: string) => ({
      reference: `Condition/${c}`
    })) : undefined,
    goal: plan.goals ? plan.goals.map((g: any) => ({
      display: g.description
    })) : undefined,
    activity: plan.activities ? plan.activities.map((a: any) => ({
      detail: {
        kind: a.kind || 'Task',
        status: a.status,
        description: a.detail,
        scheduledTiming: a.scheduled_start ? {
          repeat: {
            boundsPeriod: {
              start: a.scheduled_start,
              end: a.scheduled_end
            }
          }
        } : undefined
      }
    })) : undefined
  };
}

private mapSiteCode(site: string): string {
  const siteMap: Record<string, string> = {
    'left arm': 'LA',
    'right arm': 'RA',
    'left deltoid': 'LD',
    'right deltoid': 'RD',
    'left thigh': 'LT',
    'right thigh': 'RT'
  };
  return siteMap[site.toLowerCase()] || 'LA';
}

private mapRouteCode(route: string): string {
  const routeMap: Record<string, string> = {
    'intramuscular': 'IM',
    'subcutaneous': 'SC',
    'oral': 'PO',
    'intranasal': 'NASINHL'
  };
  return routeMap[route.toLowerCase()] || 'IM';
}
```

---

### **Step 2: Add Import Logic (2.5 hours)**

Update `importFHIRData()` in `fhirInteroperabilityIntegrator.ts`:

```typescript
private async importFHIRData(communityUserId: string, fhirData: any): Promise<void> {
  // ... existing Patient + Observation import code (lines 577-641) ...

  // Import Immunizations
  if (fhirData.immunizations && Array.isArray(fhirData.immunizations)) {
    for (const entry of fhirData.immunizations) {
      const imm = entry.resource;
      if (!imm || imm.resourceType !== 'Immunization') continue;

      const vaccineCode = imm.vaccineCode?.coding?.find((c: any) =>
        c.system === 'http://hl7.org/fhir/sid/cvx'
      );

      if (!vaccineCode) continue;

      await this.supabase.from('fhir_immunizations').upsert({
        patient_id: communityUserId,
        vaccine_code: vaccineCode.code,
        vaccine_name: vaccineCode.display || 'Unknown Vaccine',
        status: imm.status || 'completed',
        occurrence_date: imm.occurrenceDateTime,
        recorded_date: imm.recorded,
        primary_source: imm.primarySource !== false,
        lot_number: imm.lotNumber,
        expiration_date: imm.expirationDate,
        site: imm.site?.coding?.[0]?.display,
        route: imm.route?.coding?.[0]?.display,
        dose_quantity: imm.doseQuantity?.value,
        dose_unit: imm.doseQuantity?.unit,
        performer: imm.performer?.[0]?.actor?.display,
        notes: imm.note?.[0]?.text,
        dose_number: imm.protocolApplied?.[0]?.doseNumberPositiveInt,
        series_doses: imm.protocolApplied?.[0]?.seriesDosesPositiveInt,
        reaction_date: imm.reaction?.[0]?.date,
        reaction_detail: imm.reaction?.[0]?.detail?.display,
        fhir_id: imm.id,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'fhir_id'
      });
    }
  }

  // Import CarePlans
  if (fhirData.carePlans && Array.isArray(fhirData.carePlans)) {
    for (const entry of fhirData.carePlans) {
      const plan = entry.resource;
      if (!plan || plan.resourceType !== 'CarePlan') continue;

      await this.supabase.from('fhir_care_plans').upsert({
        patient_id: communityUserId,
        status: plan.status,
        intent: plan.intent,
        category: plan.category?.[0]?.coding?.[0]?.code,
        title: plan.title,
        description: plan.description,
        period_start: plan.period?.start,
        period_end: plan.period?.end,
        author: plan.author?.display,
        care_team_id: plan.careTeam?.[0]?.reference?.split('/')?.[1],
        addresses_conditions: plan.addresses?.map((a: any) => a.reference?.split('/')?.[1]),
        goals: plan.goal?.map((g: any) => ({ description: g.display })),
        activities: plan.activity?.map((a: any) => ({
          kind: a.detail?.kind,
          status: a.detail?.status,
          detail: a.detail?.description,
          scheduled_start: a.detail?.scheduledTiming?.repeat?.boundsPeriod?.start,
          scheduled_end: a.detail?.scheduledTiming?.repeat?.boundsPeriod?.end
        })),
        fhir_id: plan.id,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'fhir_id'
      });
    }
  }
}
```

---

### **Step 3: Add Fetch Logic (1.5 hours)**

Update `fetchPatientDataFromFHIR()` in `fhirInteroperabilityIntegrator.ts`:

```typescript
private async fetchPatientDataFromFHIR(
  fhirServerUrl: string,
  patientId: string,
  accessToken?: string
): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/fhir+json'
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // ... existing Patient + Observation fetch (lines 553-574) ...

  // Fetch Immunizations
  const immunizationsResponse = await fetch(
    `${fhirServerUrl}/Immunization?patient=${patientId}`,
    { headers }
  );
  const immunizations = immunizationsResponse.ok
    ? await immunizationsResponse.json()
    : { entry: [] };

  // Fetch CarePlans (only active and on-hold)
  const carePlansResponse = await fetch(
    `${fhirServerUrl}/CarePlan?patient=${patientId}&status=active,on-hold`,
    { headers }
  );
  const carePlans = carePlansResponse.ok
    ? await carePlansResponse.json()
    : { entry: [] };

  return {
    patient,
    observations: observations.entry || [],
    immunizations: immunizations.entry || [],
    carePlans: carePlans.entry || []
  };
}
```

---

### **Step 4: Update Usage Points (1 hour)**

**File:** `src/services/fhirInteroperabilityIntegrator.ts`

Find the `syncToFHIR()` method (around line 290) and update to use the new export method:

```typescript
// BEFORE:
const bundle = await this.fhirService.exportPatientDataWithMedications(userId);

// AFTER:
const bundle = await this.fhirService.exportPatientDataComplete(userId);
```

---

### **Step 5: Testing (2 hours)**

1. **Export Test:**
   ```typescript
   // In browser console or test file
   const service = new FHIRIntegrationService();
   const bundle = await service.exportPatientDataComplete('user-id-here');
   console.log(bundle);

   // Verify bundle includes:
   // - Patient ✓
   // - Observations ✓
   // - MedicationStatements ✓
   // - Immunizations ✓ (NEW)
   // - CarePlans ✓ (NEW)
   ```

2. **Import Test (Epic Sandbox):**
   - Create test Immunization in Epic sandbox
   - Create test CarePlan in Epic sandbox
   - Run `syncFromFHIR(connectionId)`
   - Check `fhir_immunizations` table for imported data
   - Check `fhir_care_plans` table for imported data

3. **Round-Trip Test:**
   - Add immunization in WellFit → Export → Import to Epic → Verify in Epic
   - Create care plan in Epic → Import to WellFit → Verify in WellFit UI

---

## 📂 FILES TO MODIFY

### **Primary Files (MUST modify):**
1. `src/components/admin/FhirIntegrationService.ts` (lines 600-975)
   - Add `exportPatientDataComplete()` method
   - Add `mapImmunizationToFHIR()` helper
   - Add `mapCarePlanToFHIR()` helper

2. `src/services/fhirInteroperabilityIntegrator.ts` (lines 540-641)
   - Update `fetchPatientDataFromFHIR()` to fetch Immunization + CarePlan
   - Update `importFHIRData()` to import Immunization + CarePlan
   - Update `syncToFHIR()` to use `exportPatientDataComplete()`

### **Secondary Files (Optional):**
3. `src/components/admin/FHIRInteroperabilityDashboard.tsx`
   - Add checkboxes for Immunization/CarePlan sync toggles
   - Add sync stats for these resources

---

## ✅ ACCEPTANCE CRITERIA

**When complete, you should be able to:**

1. ✅ Export patient data and see Immunization resources in FHIR bundle
2. ✅ Export patient data and see CarePlan resources in FHIR bundle
3. ✅ Import immunizations from Epic sandbox → Show up in `/immunizations` page
4. ✅ Import care plans from Epic sandbox → Show up in `/care-plans` page
5. ✅ Round-trip: Add vaccine in WellFit → Sync to Epic → See in Epic
6. ✅ Round-trip: Create care plan in Epic → Sync to WellFit → See in WellFit

---

## 🎯 VALIDATION CHECKLIST

After implementation, verify:

- [ ] FHIR bundle includes Immunization resources (check `bundle.entry`)
- [ ] FHIR bundle includes CarePlan resources (check `bundle.entry`)
- [ ] Immunization fields map correctly to FHIR R4 spec
- [ ] CarePlan fields map correctly to FHIR R4 spec
- [ ] Import from Epic creates records in `fhir_immunizations` table
- [ ] Import from Epic creates records in `fhir_care_plans` table
- [ ] Imported immunizations show in `/immunizations` UI
- [ ] Imported care plans show in `/care-plans` UI
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No build errors (`npm run build`)
- [ ] Tests pass (`npm test`)

---

## 📖 REFERENCE DOCUMENTATION

**Already exists in your codebase:**
- `docs/IMMUNIZATION_IMPLEMENTATION_COMPLETE.md` - Database schema for Immunization
- `docs/CAREPLAN_IMPLEMENTATION_COMPLETE.md` - Database schema for CarePlan
- `docs/FHIR_BACKEND_INTEGRATION_STATUS.md` - Full analysis of the gap
- `docs/HL7_FHIR_LAUNCH_READINESS.md` - FHIR implementation status

**FHIR R4 Specs:**
- Immunization: https://hl7.org/fhir/R4/immunization.html
- CarePlan: https://hl7.org/fhir/R4/careplan.html
- US Core Immunization: https://hl7.org/fhir/us/core/StructureDefinition-us-core-immunization.html
- US Core CarePlan: https://hl7.org/fhir/us/core/StructureDefinition-us-core-careplan.html

---

## 🚀 QUICK START COMMANDS

```bash
# 1. Open the files
code src/components/admin/FhirIntegrationService.ts
code src/services/fhirInteroperabilityIntegrator.ts

# 2. After making changes, test
npm run typecheck
npm run build

# 3. Test export in browser console (logged in as patient)
const service = new FHIRIntegrationService();
const bundle = await service.exportPatientDataComplete('your-user-id');
console.log('Bundle entries:', bundle.entry.length);
console.log('Resource types:', bundle.entry.map(e => e.resource.resourceType));

# 4. Verify Immunization and CarePlan are included
```

---

## 💡 TIPS FOR THE NEXT CLAUDE INSTANCE

1. **Start with export logic first** - It's the easiest to test (just console.log the bundle)
2. **Use existing patterns** - Copy/paste from `exportPatientDataWithMedications()` and adapt
3. **Field mapping is key** - Check your database schema vs FHIR R4 spec carefully
4. **Test incrementally** - Add Immunization first, test, then add CarePlan
5. **Epic sandbox is your friend** - Use https://fhir.epic.com/Sandbox for testing
6. **Database has the data** - The `fhir_immunizations` and `fhir_care_plans` tables are already populated from the UI

---

## 🎤 MESSAGE FROM PREVIOUS CLAUDE

**Context:** User asked if Immunization and CarePlan need to be wired into the FHIR backend. I confirmed:
- ✅ Frontend works perfectly (patients can use it)
- ❌ Backend NOT wired (won't sync to Epic/Cerner)
- 🎯 Recommendation: Wire it in for investor pitch ("100% FHIR bidirectional sync")
- ⏱️ Effort: 8 hours (1 day)

**User's decision:** Wire it into the backend (do Option 2)

**Why it matters:**
- Investor pitch upgrade: "77% compliance" → "100% compliance with full bidirectional EHR sync"
- Clinical value: Doctors see vaccine records + care plans in Epic automatically
- Competitive moat: Most startups only sync vitals, WellFit syncs EVERYTHING

**Good luck! The code patterns are all there - just follow the existing MedicationStatement logic and adapt for Immunization and CarePlan.** 🚀

---

**Document Version:** 1.0
**Last Updated:** October 2025
**Status:** READY FOR IMPLEMENTATION
**Priority:** HIGH (needed for investor pitch)
