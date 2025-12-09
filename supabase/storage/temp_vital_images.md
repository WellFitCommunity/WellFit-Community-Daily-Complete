# temp_vital_images Storage Bucket Configuration

## Purpose
Private storage bucket for temporary vital sign images captured via the photo flow.
Images are processed for OCR and automatically deleted after 24 hours.

## Bucket Settings

### Create Bucket (Supabase Dashboard)
1. Go to Storage > New Bucket
2. Name: `temp_vital_images`
3. Public: **OFF** (Private only)
4. File size limit: 10MB
5. Allowed MIME types: `image/jpeg, image/png, image/webp`

### Storage Policies

#### 1. Users can upload their own images
```sql
-- Policy: Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own temp vital images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'temp_vital_images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### 2. Users can view their own images
```sql
-- Policy: Allow authenticated users to view their own images
CREATE POLICY "Users can view own temp vital images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'temp_vital_images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### 3. Users can delete their own images
```sql
-- Policy: Allow authenticated users to delete their own images
CREATE POLICY "Users can delete own temp vital images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'temp_vital_images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### 4. Service role has full access (for cleanup)
```sql
-- Policy: Service role can manage all files (for cleanup job)
-- Note: Service role bypasses RLS by default, but explicit policy helps document intent
CREATE POLICY "Service role full access to temp vital images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'temp_vital_images');
```

## File Path Convention

Files should be stored using this path pattern:
```
temp_vital_images/{user_id}/{timestamp}_{vital_type}.{ext}
```

Example:
```
temp_vital_images/a1b2c3d4-e5f6-7890-abcd-ef1234567890/1702134000000_blood_pressure.jpg
```

## Frontend Upload Example

```typescript
import { supabase } from '../lib/supabaseClient';

async function uploadVitalImage(file: File, vitalType: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${user.id}/${timestamp}_${vitalType}.${ext}`;

  const { error } = await supabase.storage
    .from('temp_vital_images')
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;
  return path;
}
```

## Cleanup Schedule

The `cleanup-temp-images` Edge Function runs hourly to:
1. Delete all `temp_image_jobs` records where `expires_at < now()`
2. Delete corresponding files from this bucket
3. Clean up any orphaned files older than 25 hours

## Security Notes

- Bucket is PRIVATE - no public URLs
- Users can only access files in their own folder (user_id subfolder)
- All access is logged in Supabase audit logs
- Images contain PHI - handle with HIPAA compliance
- 24-hour TTL ensures minimal PHI exposure window
