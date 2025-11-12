#!/bin/bash
set -e

echo "========================================="
echo "PHI ENCRYPTION DEPLOYMENT SCRIPT"
echo "========================================="
echo ""
echo "This script will help you deploy PHI encryption to your Supabase database."
echo ""
echo "STEP 1: Copy the SQL to your clipboard"
echo "----------------------------------------"

# Copy SQL to clipboard if possible
if command -v xclip &> /dev/null; then
  cat deploy-encryption-complete.sql | xclip -selection clipboard
  echo "✅ SQL copied to clipboard!"
elif command -v pbcopy &> /dev/null; then
  cat deploy-encryption-complete.sql | pbcopy
  echo "✅ SQL copied to clipboard!"
else
  echo "⚠️  Could not auto-copy to clipboard. Please manually copy the file."
fi

echo ""
echo "STEP 2: Open Supabase SQL Editor"
echo "----------------------------------------"
echo "Opening: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/sql/new"
echo ""

# Try to open the browser
if command -v xdg-open &> /dev/null; then
  xdg-open "https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/sql/new" 2>/dev/null &
elif command -v open &> /dev/null; then
  open "https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/sql/new" &
else
  echo "Please open this URL manually in your browser:"
  echo "https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/sql/new"
fi

echo ""
echo "STEP 3: In the SQL Editor"
echo "----------------------------------------"
echo "1. Paste the SQL (Ctrl+V or Cmd+V)"
echo "2. Click the 'Run' button"
echo "3. Check the 'Messages' tab for success confirmation"
echo ""
echo "Expected output:"
echo "  ✅ Step 1: pgcrypto extension enabled"
echo "  ✅ Step 2: All conflicting functions dropped"
echo "  ✅ Step 3: encrypt_data function created"
echo "  ✅ Step 4: decrypt_data function created"
echo "  ✅ Step 5: Permissions granted"
echo "  ✅ ✅ ✅ SUCCESS! PHI ENCRYPTION IS WORKING CORRECTLY"
echo ""
echo "========================================="
echo "If you see the SUCCESS message, you're done!"
echo "========================================="
