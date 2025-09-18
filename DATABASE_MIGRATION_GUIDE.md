# Database Migration Guide for AI-Enhanced FHIR System

## Overview

This guide provides the necessary database migrations to support the AI-enhanced FHIR integration system for WellFit Community. The migrations add new tables, columns, and functionality while maintaining compatibility with existing data.

## Migration Files

### 1. `20250918000000_ai_enhanced_fhir_tables.sql`
Creates the core AI and FHIR analytics tables:

#### New Tables Created:
- **`emergency_alerts`** - AI-generated emergency alerts and notifications
- **`ai_risk_assessments`** - Patient risk scores and assessments
- **`care_recommendations`** - AI-generated care recommendations
- **`vitals_trends`** - Analyzed trends in vital signs
- **`population_insights`** - Population-level health analytics
- **`predictive_outcomes`** - AI predictions for patient outcomes
- **`fhir_bundles`** - Cached FHIR bundle data
- **`ai_configuration`** - AI model settings and thresholds
- **`quality_metrics`** - Data and clinical quality tracking
- **`intervention_queue`** - Required interventions and tasks

#### Key Features:
- Comprehensive RLS (Row Level Security) policies
- Performance-optimized indexes
- Automatic timestamp triggers
- Default AI configuration presets
- Helper functions for common queries

### 2. `20250918000001_update_profiles_for_fhir.sql`
Updates existing schema to support FHIR requirements:

#### Profile Table Enhancements:
Adds missing columns to `profiles` table:
- `first_name` - Patient first name
- `last_name` - Patient last name
- `email` - Patient email address
- `dob` - Date of birth
- `address` - Patient address
- `caregiver_email` - Emergency contact email
- `emergency_contact_name` - Emergency contact name
- `role` - User role (default: 'senior')

#### Core Application Tables:
Creates essential tables if they don't exist:
- **`check_ins`** - Patient vital signs and health check-ins
- **`health_entries`** - Wellness and mood entries
- **`meals`** - Meal logging and nutrition data
- **`privacy_consent`** - Privacy consent tracking
- **`phone_auth`** - Phone number verification
- **`community_moments`** - Community shared moments
- **`community_photos`** - Community photo sharing
- **`admin_notes`** - Administrative notes on patients
- **`admin_profile_view_logs`** - Admin access audit logs

#### Database Views:
- **`profiles_with_user_id`** - Simplified profile view for reporting

## Migration Execution

### Option 1: Supabase CLI (Recommended)
```bash
# Navigate to your project directory
cd /workspaces/WellFit-Community-Daily-Complete

# Run the migrations
npx supabase migration up
```

### Option 2: Manual Execution
If you prefer to run migrations manually:

1. **Connect to your Supabase database**
2. **Execute migrations in order:**
   - First: `20250918000000_ai_enhanced_fhir_tables.sql`
   - Second: `20250918000001_update_profiles_for_fhir.sql`

### Option 3: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste each migration file content
4. Execute them in the correct order

## Post-Migration Verification

### 1. Verify Tables Created
```sql
-- Check that all AI tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'emergency_alerts',
  'ai_risk_assessments',
  'care_recommendations',
  'vitals_trends',
  'population_insights',
  'predictive_outcomes',
  'fhir_bundles',
  'ai_configuration',
  'quality_metrics',
  'intervention_queue'
);
```

### 2. Verify Profile Columns
```sql
-- Check that profile columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;
```

### 3. Verify RLS Policies
```sql
-- Check RLS policies are active
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename LIKE '%ai_%' OR tablename IN ('emergency_alerts', 'care_recommendations');
```

### 4. Verify Default Configuration
```sql
-- Check default AI configuration exists
SELECT config_name, is_active, description
FROM public.ai_configuration
WHERE config_name = 'default_risk_thresholds';
```

## Data Compatibility

### Existing Data
- **✅ Safe**: All existing data is preserved
- **✅ Backward Compatible**: Existing application functionality unchanged
- **✅ Non-Breaking**: New columns have sensible defaults

### New Functionality
- **AI Analytics**: Requires patient check-in data to generate insights
- **Risk Assessments**: Auto-generated when patients submit vital signs
- **FHIR Exports**: Available immediately for all existing patients

## Security Considerations

### Row Level Security (RLS)
All new tables have comprehensive RLS policies:

- **Patient Data**: Users can only access their own data
- **Admin Data**: Admins can access all patient data
- **Super Admin**: Full access to configuration and system data
- **Audit Logs**: Restricted to admin roles only

### Data Privacy
- Patient identifiable information encrypted
- Audit logs for all admin access
- HIPAA-compliant data handling
- Automatic data expiration for temporary data

## Performance Optimizations

### Indexes Added
- Primary key indexes on all tables
- Foreign key indexes for relationships
- Composite indexes for common query patterns
- Partial indexes for filtered queries

### Automatic Cleanup
- FHIR bundles auto-expire after 24 hours
- Helper function for manual cleanup: `cleanup_expired_fhir_bundles()`

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure you have `supabase_admin` role or database owner privileges
   - Check that RLS is properly configured

2. **Table Already Exists**
   - Migrations use `IF NOT EXISTS` - safe to re-run
   - Check existing table structure matches expected schema

3. **Column Already Exists**
   - Profile updates use `ADD COLUMN IF NOT EXISTS` - safe to re-run
   - Verify column types match expectations

4. **RLS Policy Conflicts**
   - Migrations drop existing policies before creating new ones
   - Check policy names don't conflict with custom policies

### Rollback Instructions

If you need to rollback the migrations:

```sql
-- Rollback AI tables (CAUTION: Will delete all AI data)
-- Run the migrate:down section of 20250918000000_ai_enhanced_fhir_tables.sql

-- Rollback profile updates (CAUTION: Will delete added columns)
-- Run the migrate:down section of 20250918000001_update_profiles_for_fhir.sql
```

**⚠️ Warning**: Rollback will permanently delete all AI-generated data and insights.

## Testing the Migration

### 1. Basic Functionality Test
```sql
-- Test inserting a risk assessment
INSERT INTO public.ai_risk_assessments (
  patient_id,
  risk_level,
  risk_score,
  risk_factors,
  recommendations,
  priority,
  trend_direction
) VALUES (
  auth.uid(),
  'MODERATE',
  55,
  ARRAY['Elevated blood pressure', 'Low activity level'],
  ARRAY['Monitor BP daily', 'Increase physical activity'],
  3,
  'STABLE'
);
```

### 2. AI Configuration Test
```sql
-- Test AI configuration access
SELECT * FROM public.ai_configuration WHERE is_active = true;
```

### 3. FHIR Bundle Test
```sql
-- Test FHIR bundle storage
INSERT INTO public.fhir_bundles (
  patient_id,
  bundle_type,
  bundle_data,
  validation_status
) VALUES (
  auth.uid(),
  'patient_export',
  '{"resourceType": "Bundle", "id": "test"}',
  'VALID'
);
```

## Support and Monitoring

### Health Checks
- Monitor table sizes and growth patterns
- Set up alerts for emergency_alerts table
- Track AI processing performance
- Monitor FHIR bundle cache efficiency

### Maintenance Tasks
- Run `cleanup_expired_fhir_bundles()` daily
- Archive old population_insights monthly
- Monitor disk usage for FHIR bundles
- Review AI configuration effectiveness

## Next Steps

After successful migration:

1. **Test AI Dashboard**: Access admin panel to verify AI features work
2. **Generate Test Data**: Create sample check-ins to test AI analytics
3. **Configure Alerts**: Set up monitoring for emergency alerts
4. **Train Staff**: Provide training on new AI features
5. **Monitor Performance**: Watch system performance and adjust as needed

## Contact and Support

For issues with migration:
- Check the troubleshooting section above
- Review Supabase logs for detailed error messages
- Verify user permissions and RLS policies
- Ensure all dependencies are met

The database is now ready to support the full AI-enhanced FHIR integration system with intelligent analytics, real-time monitoring, and comprehensive healthcare insights.