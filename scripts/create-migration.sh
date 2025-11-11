#!/bin/bash
# Create New Migration Script
# Generates a properly timestamped migration file
# Usage: ./scripts/create-migration.sh "description_of_migration"

set -e

if [ -z "$1" ]; then
  echo "❌ ERROR: Migration description required"
  echo "Usage: ./scripts/create-migration.sh \"description_of_migration\""
  echo "Example: ./scripts/create-migration.sh \"add_user_preferences\""
  exit 1
fi

DESCRIPTION="$1"
TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")
FILENAME="${TIMESTAMP}_${DESCRIPTION}.sql"
FILEPATH="supabase/migrations/${FILENAME}"

# Create migration file with template
cat > "$FILEPATH" << EOF
-- Migration: ${DESCRIPTION}
-- Created: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Description: TODO - Add migration description here

-- Add your SQL here
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Don't forget to add comments for documentation
-- COMMENT ON TABLE example_table IS 'Description of what this table does';
EOF

echo "✅ Migration created: $FILEPATH"
echo ""
echo "Next steps:"
echo "  1. Edit $FILEPATH and add your SQL"
echo "  2. Test locally: ./scripts/migrate.sh local"
echo "  3. Commit the migration file to git"
echo "  4. Deploy: ./scripts/migrate.sh staging  (or production)"
