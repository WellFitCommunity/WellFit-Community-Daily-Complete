# Paper Form Scanner - Setup Instructions

## Prerequisites

Before deploying the paper form scanner, you need:

1. **Supabase Project** with Edge Functions enabled
2. **Anthropic API Key** for Claude Vision API
3. **Supabase CLI** installed and authenticated

---

## Step 1: Get Anthropic API Key

1. Go to [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign up or log in to your account
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy the API key (starts with `sk-ant-...`)
6. Store it securely - you'll need it in Step 3

**Note:** The API key provides access to Claude Sonnet 4.5 which powers the OCR functionality.

---

## Step 2: Deploy Edge Function

Deploy the `extract-patient-form` Edge Function to your Supabase project:

```bash
npx supabase functions deploy extract-patient-form --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with your Supabase project reference (found in project settings).

**Expected output:**
```
Deploying extract-patient-form (project ref: YOUR_PROJECT_REF)
✓ Deployed extract-patient-form
```

---

## Step 3: Set Environment Variables

Set the Anthropic API key as a secret in your Supabase project:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-YOUR_API_KEY_HERE --project-ref YOUR_PROJECT_REF
```

**Verify the secret was set:**
```bash
npx supabase secrets list --project-ref YOUR_PROJECT_REF
```

You should see:
```
ANTHROPIC_API_KEY
```

---

## Step 4: Test the Edge Function

Test the Edge Function with a sample image:

### Using curl:

```bash
# Create a test image (or use an actual form photo)
# Convert to base64
BASE64_IMAGE=$(base64 -i your-test-form.jpg)

# Call the function
curl -X POST \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/extract-patient-form" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"image\": \"$BASE64_IMAGE\",
    \"mimeType\": \"image/jpeg\"
  }"
```

### Expected Response:

```json
{
  "success": true,
  "extractedData": {
    "firstName": "John",
    "lastName": "Doe",
    "dob": "01/15/1950",
    "gender": "Male",
    "mrn": "MRN001",
    "phone": "555-1234",
    "roomNumber": "101",
    "acuityLevel": "3-Moderate",
    "confidence": "high",
    "uncertainFields": [],
    "notes": "All fields clearly visible and readable"
  },
  "usage": {
    "inputTokens": 1234,
    "outputTokens": 567,
    "estimatedCost": "$0.0123"
  }
}
```

---

## Step 5: Update Frontend Configuration

The frontend is already configured to use the Edge Function. No changes needed!

The `PaperFormScanner.tsx` component automatically calls:
```typescript
await supabase.functions.invoke('extract-patient-form', {
  body: { image: base64, mimeType: file.type }
});
```

---

## Step 6: Verify in Admin Panel

1. Log in as an admin user
2. Navigate to **Admin Panel**
3. Scroll to **Paper Form Scanner** section
4. Click **"Show Printable Form"** to test form printing
5. Take a test photo or upload a sample image
6. Verify AI extraction works correctly

---

## Troubleshooting

### Error: "API key not configured"

**Solution:** Make sure you set the `ANTHROPIC_API_KEY` secret:
```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref YOUR_PROJECT_REF
```

Then restart the Edge Function:
```bash
npx supabase functions deploy extract-patient-form --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

### Error: "CORS policy"

**Solution:** The Edge Function already includes CORS headers. If you still see CORS errors:

1. Check that you're calling from the correct domain
2. Verify the Supabase URL in your frontend env variables
3. Clear browser cache and try again

### Error: "Failed to parse extracted data"

**Solution:** This usually means:

1. Image quality too poor (retake with better lighting)
2. Form is blank or mostly empty (fill out form first)
3. Non-standard form layout (use the provided template)

### Error: "Timeout"

**Solution:**

1. Image file too large (compress to under 5MB)
2. Slow internet connection (retry when connection improves)
3. Claude API temporarily overloaded (retry in a few seconds)

---

## Cost Monitoring

### Track API Usage

Monitor your Anthropic API usage:
1. Go to [https://console.anthropic.com/](https://console.anthropic.com/)
2. Click **Usage** in sidebar
3. View daily/monthly usage and costs

### Set Budget Alerts

1. In Anthropic Console, go to **Settings** → **Billing**
2. Set **Budget Alert** (e.g., $100/month)
3. You'll receive email notifications when approaching limit

### Estimated Costs

With ~$0.005 per form:
- 100 forms = $0.50
- 500 forms = $2.50
- 1,000 forms = $5.00
- 10,000 forms = $50.00

**Recommendation:** Start with a $50/month budget for testing, adjust based on actual usage.

---

## Security Best Practices

### 1. Rotate API Keys Regularly

Every 90 days:
1. Create new Anthropic API key
2. Update Supabase secret
3. Delete old API key

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-NEW_KEY --project-ref YOUR_PROJECT_REF
```

### 2. Enable RLS Policies

Ensure only admin users can access the paper form scanner:

```sql
-- Already implemented in HospitalPatientEnrollment
-- Staff must have admin role to enroll patients
```

### 3. Audit Logging

All enrollment actions are logged with:
- Admin user ID (`enrolled_by` column)
- Enrollment timestamp (`enrollment_date` column)
- Enrollment notes (`enrollment_notes` column)

Query audit logs:
```sql
SELECT
  p.first_name,
  p.last_name,
  p.enrollment_date,
  p.enrolled_by,
  u.email as enrolled_by_email
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.enrolled_by
WHERE p.enrollment_type = 'hospital'
ORDER BY p.enrollment_date DESC;
```

### 4. PHI Protection

- Form images are NOT stored permanently
- Only extracted text data is saved to database
- All data transmission uses HTTPS
- Edge Function runs in secure Supabase environment
- Compliance with HIPAA guidelines

---

## Performance Optimization

### 1. Batch Processing

Process multiple forms in parallel:
- Users can upload multiple images at once
- Edge Function handles concurrent requests
- Results appear as each form completes

### 2. Image Optimization

Before uploading:
- Compress images to 1-2 MB (balance quality vs size)
- Use JPG format (smaller than PNG)
- Crop to form area only (faster processing)

### 3. Caching

The Edge Function doesn't cache results (each form is unique).
This is intentional to ensure:
- Fresh data every time
- No risk of PHI leakage
- Accurate cost tracking

---

## Maintenance

### Monthly Tasks

1. **Review usage** - Check Anthropic Console for usage trends
2. **Update budget** - Adjust budget alerts based on actual usage
3. **Check error logs** - Review Supabase logs for any errors
4. **Test functionality** - Upload a test form to verify system works

### Quarterly Tasks

1. **Rotate API key** - Create new Anthropic API key
2. **Review accuracy** - Check if staff are correcting extracted data frequently
3. **Update documentation** - Add any new tips or common issues
4. **Train staff** - Refresh training on photography best practices

### Annual Tasks

1. **Security audit** - Review access logs and permissions
2. **Cost analysis** - Compare costs to manual data entry savings
3. **Feature requests** - Gather staff feedback for improvements
4. **Update form template** - Revise form based on staff feedback

---

## Advanced Configuration

### Custom Form Templates

To create a custom form template:

1. Copy `PatientEnrollmentForm.tsx`
2. Modify field layout and labels
3. Update Edge Function prompt to match new fields
4. Test extraction accuracy
5. Deploy updated Edge Function

### Multi-Language Support

To add Spanish language support:

1. Create `PatientEnrollmentForm_ES.tsx` with Spanish labels
2. Update Edge Function to detect language
3. Adjust extraction prompt for Spanish field names
4. Test with Spanish handwriting samples

### Integration with EHR

To export extracted data to EHR:

1. Map extracted fields to EHR fields
2. Use existing FHIR integration
3. Create scheduled export job
4. Implement HL7 interface if needed

---

## Support Resources

### Documentation
- [Anthropic API Docs](https://docs.anthropic.com/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Claude Vision Guide](https://docs.anthropic.com/claude/docs/vision)

### Community
- [WellFit Community GitHub](https://github.com/WellFitCommunity)
- [Supabase Discord](https://discord.supabase.com/)
- [Anthropic Community](https://community.anthropic.com/)

### Contact
- **Technical Issues:** Open GitHub issue
- **Billing Questions:** support@anthropic.com
- **Feature Requests:** Submit to product roadmap

---

## Deployment Checklist

Before going live:

- [ ] Anthropic API key obtained and configured
- [ ] Edge Function deployed successfully
- [ ] Test upload completed with sample form
- [ ] Admin users have access to Paper Form Scanner
- [ ] Blank forms printed and stored
- [ ] Staff trained on photography best practices
- [ ] Budget alerts configured
- [ ] Audit logging verified
- [ ] User guide distributed to staff
- [ ] Emergency contact list updated

---

## Success Metrics

Track these KPIs to measure success:

1. **Time Savings**
   - Average time per form (manual vs AI)
   - Total hours saved per month

2. **Accuracy**
   - Percentage of fields extracted correctly
   - Number of corrections needed per form

3. **Adoption**
   - Number of forms processed per week
   - Percentage of staff using the feature

4. **Cost Efficiency**
   - Total AI processing costs
   - Cost savings vs manual entry

5. **User Satisfaction**
   - Staff feedback scores
   - Number of support tickets

---

## Next Steps

After successful deployment:

1. **Week 1:** Monitor closely for any issues
2. **Week 2:** Gather staff feedback
3. **Month 1:** Analyze usage patterns and costs
4. **Month 3:** Consider custom form templates
5. **Month 6:** Evaluate ROI and plan expansions

---

**Setup Complete!** Your paper form scanner is ready to save time and reduce manual data entry.

For questions or issues, refer to the troubleshooting section or contact your system administrator.
