-- Quick SQL to reset user passwords via Supabase Dashboard
-- Go to SQL Editor in Supabase Dashboard and run these queries

-- Example: Reset password for a user by phone
-- Replace '+15551234567' with actual phone number
-- Replace 'newpassword123' with desired password

-- For Maria (replace with your phone):
-- UPDATE auth.users
-- SET encrypted_password = crypt('newpassword123', gen_salt('bf'))
-- WHERE phone = '+1YOUR_PHONE_NUMBER';

-- For Akima (replace with Akima's phone):
-- UPDATE auth.users
-- SET encrypted_password = crypt('akimapassword123', gen_salt('bf'))
-- WHERE phone = '+1AKIMA_PHONE_NUMBER';

-- For seniors - you'll need their phone numbers
-- UPDATE auth.users
-- SET encrypted_password = crypt('seniorpassword123', gen_salt('bf'))
-- WHERE phone = '+1SENIOR_PHONE_NUMBER';

-- To see all users and their phones:
SELECT id, phone, email, created_at
FROM auth.users
ORDER BY created_at DESC;