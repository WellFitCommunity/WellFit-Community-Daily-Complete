#!/bin/bash
# Unified Migration Script
# Applies all pending migrations to Supabase database
# Usage: ./scripts/migrate.sh [environment]
#   environment: local, staging, production (default: local)

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ENVIRONMENT="${1:-local}"

echo -e "${GREEN}🚀 WellFit Migration Tool${NC}"
echo "Environment: $ENVIRONMENT"
echo ""

# Set database URL based on environment
case $ENVIRONMENT in
  local)
    DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
    ;;
  staging|production)
    if [ -z "$DATABASE_URL" ]; then
      echo -e "${RED}ERROR: DATABASE_URL environment variable not set${NC}"
      exit 1
    fi
    DB_URL="$DATABASE_URL"
    ;;
  *)
    echo -e "${RED}ERROR: Invalid environment. Use: local, staging, or production${NC}"
    exit 1
    ;;
esac

# Confirm for non-local environments
if [ "$ENVIRONMENT" != "local" ]; then
  echo -e "${YELLOW}⚠️  WARNING: You are about to apply migrations to $ENVIRONMENT${NC}"
  read -p "Continue? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi
fi

# Use Supabase CLI for migrations (handles ordering automatically)
echo -e "${GREEN}📦 Applying migrations...${NC}"
npx supabase db push --db-url "$DB_URL"

echo ""
echo -e "${GREEN}✅ Migrations completed successfully!${NC}"
echo ""

# Optional: Reload PostgREST schema cache
if [ -f "scripts/reload-schema-cache.js" ]; then
  echo "🔄 Reloading PostgREST schema cache..."
  node scripts/reload-schema-cache.js
fi
