# 🧠 FHIR Form Builder - User Guide

## Overview

The enhanced FHIR Form Builder allows healthcare professionals to create standardized clinical questionnaires using AI and natural language processing. It generates FHIR R4-compliant questionnaires that can be deployed to WellFit or exported to any EHR system.

## Features

### ✨ **AI-Powered Generation**
- Describe forms in natural language
- AI generates FHIR R4-compliant questionnaires
- Automatic scoring algorithms for standardized assessments
- Proper LOINC code integration

### 📚 **Template Library**
- Pre-built clinical questionnaires:
  - PHQ-9 Depression Screening
  - GAD-7 Anxiety Assessment
  - Fall Risk Assessment
  - Pain Assessment Scale
  - Medication Adherence (Morisky Scale)
- One-click template deployment
- Usage tracking and analytics

### 💾 **Database Integration**
- Save questionnaires to database
- Version control and status management
- Deployment tracking
- Response analytics

### 🚀 **Deployment Options**
- **WellFit Integration**: Deploy directly to patient dashboard
- **EHR Export**: Download FHIR JSON for external systems
- **HIPAA Compliant**: Encrypted storage and transmission

## How to Use

### 1. **Create New Questionnaire**

#### Option A: Use Templates
1. Navigate to "AI Form Builder" tab
2. Browse available templates
3. Click on desired template (e.g., "PHQ-9 Depression Screening")
4. AI automatically generates the form
5. Review and customize if needed

#### Option B: Custom Description
1. Navigate to "AI Form Builder" tab
2. In the text area, describe your form in natural language:
   ```
   Example: Create a pain assessment form with questions about pain location,
   intensity (0-10 scale), quality (sharp, dull, burning), triggers, and
   current treatments. Include conditional questions for patients rating pain above 7.
   ```
3. Click "🚀 Generate FHIR Form"
4. Review the generated questionnaire

### 2. **Save & Deploy**

1. **Save to Database**: Click "💾 Save to Database" to store permanently
2. **Deploy to WellFit**: Click "🚀 Deploy to WellFit" to make available to patients
3. **Download**: Click "📥 Download JSON" for external use

### 3. **Manage Questionnaires**

1. Navigate to "📚 My Questionnaires" tab
2. View all saved questionnaires with status:
   - **Draft**: Not yet deployed
   - **Active**: Available for use
   - **Deployed**: Currently in WellFit system
3. View, edit, or deploy existing questionnaires

## Database Schema

The system uses these core tables:

- **`fhir_questionnaires`**: Store generated forms
- **`questionnaire_responses`**: Patient answers
- **`questionnaire_templates`**: Pre-built templates
- **`questionnaire_analytics`**: Performance metrics
- **`questionnaire_deployments`**: Integration tracking

## Integration with Existing Systems

### ✅ **No Conflicts**
- Works alongside existing `risk_assessments` table
- Complements `admin_user_questions` and `self_reports`
- Additive functionality only

### 🔗 **Cross-System References**
- FHIR questionnaires can reference existing risk assessments
- Results can trigger workflows in existing systems
- Shared patient identifiers across all systems

## API Usage

```typescript
import { FHIRQuestionnaireService } from '../services/fhirQuestionnaireService';

const service = new FHIRQuestionnaireService(supabase);

// Generate questionnaire
const questionnaire = await service.generateQuestionnaire(prompt);

// Save to database
const saved = await service.saveQuestionnaire(questionnaire, options);

// Deploy to WellFit
await service.deployToWellFit(saved.id);

// Get analytics
const stats = await service.getQuestionnaireStats(saved.id);
```

## Clinical Compliance

### 📋 **FHIR R4 Standards**
- Full compliance with FHIR Questionnaire resource
- Proper use of LOINC codes
- Support for conditional logic (enableWhen)
- Standardized scoring algorithms

### 🔒 **HIPAA Compliance**
- Encrypted data storage
- Audit trails for all changes
- Role-based access control
- PHI protection mechanisms

### 🏥 **EHR Integration**
- Export to Epic, Cerner, Allscripts
- SMART on FHIR compatibility
- HL7 FHIR messaging support

## Examples

### Mental Health Screening
```
"Create a comprehensive mental health screening questionnaire including:
- PHQ-9 depression questions
- GAD-7 anxiety assessment
- Sleep quality (Pittsburgh Sleep Quality Index)
- Substance use screening
Include scoring algorithms and risk level determination."
```

### Geriatric Assessment
```
"Design a geriatric assessment form covering:
- Activities of daily living (ADLs)
- Instrumental activities of daily living (IADLs)
- Cognitive assessment (Mini-Cog)
- Fall risk factors
- Social determinants of health
Include conditional logic based on age and functional status."
```

### Chronic Disease Management
```
"Build a diabetes management questionnaire with:
- Blood glucose monitoring compliance
- Medication adherence (Morisky scale)
- Diet and exercise habits
- Symptom tracking (neuropathy, vision changes)
- Quality of life measures
Include automatic risk stratification."
```

## Troubleshooting

### Common Issues

1. **Generation Fails**
   - Check natural language prompt clarity
   - Ensure specific clinical requirements
   - Try using templates first

2. **Save Error**
   - Verify database connection
   - Check user permissions
   - Ensure valid FHIR structure

3. **Deployment Issues**
   - Save questionnaire first
   - Check admin privileges
   - Verify WellFit integration status

### Support

For technical issues or feature requests:
1. Check existing questionnaires in library
2. Review FHIR validation errors
3. Contact system administrator

## Future Enhancements

- 🤖 **Advanced AI**: Multi-language support, clinical reasoning
- 📊 **Analytics**: Real-time response monitoring, outcome tracking
- 🔄 **Integrations**: More EHR systems, mobile apps
- 🎯 **Personalization**: Adaptive questionnaires based on patient data