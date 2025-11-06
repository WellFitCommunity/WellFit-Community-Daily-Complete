#!/bin/bash
# =====================================================
# DEPLOY MCP COST TRACKING MIGRATION
# Run this script to apply the MCP cost tracking schema
# =====================================================

echo "🚀 Deploying MCP Cost Tracking Migration..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

echo "📊 Applying migration: 20251106000000_mcp_cost_tracking.sql"
echo ""

# Option 1: Try using environment variable
if [ -n "$SUPABASE_DB_URL" ]; then
    echo "Using SUPABASE_DB_URL from environment..."
    npx supabase db push --db-url "$SUPABASE_DB_URL"

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Migration applied successfully!"
        echo ""
        echo "📈 Next steps:"
        echo "1. View cost savings in Admin Panel → MCP Cost Dashboard"
        echo "2. Start using MCP-optimized services:"
        echo "   import { mcpServices } from './services/mcp/mcpMigrationHelper';"
        echo "3. Monitor your savings!"
        exit 0
    fi
fi

# Option 2: Manual psql connection
echo ""
echo "⚠️  Automatic deployment failed. Please run manually:"
echo ""
echo "Option A - Using psql:"
echo "  PGPASSWORD='your_password' psql -h db.xkybsjnvuohpqpbkikyn.supabase.co \\"
echo "    -p 5432 -d postgres -U postgres \\"
echo "    -f supabase/migrations/20251106000000_mcp_cost_tracking.sql"
echo ""
echo "Option B - Using Supabase Dashboard:"
echo "  1. Go to https://supabase.com/dashboard"
echo "  2. Select your project"
echo "  3. Go to SQL Editor"
echo "  4. Copy contents of supabase/migrations/20251106000000_mcp_cost_tracking.sql"
echo "  5. Paste and run"
echo ""
echo "Option C - Using Supabase CLI:"
echo "  npx supabase db push --db-url 'postgresql://postgres:[PASSWORD]@db.xkybsjnvuohpqpbkikyn.supabase.co:5432/postgres'"
echo ""

exit 1
