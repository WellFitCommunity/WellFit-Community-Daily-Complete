#!/bin/bash

# This script is for testing the Supabase migrations.
# It will reset the local database and apply all migrations.
#
# IMPORTANT: This script is intended for local development and testing only.
# DO NOT run this script in a production environment.

set -e

echo "Starting Supabase..."
supabase start

echo "Resetting database..."
supabase db reset

echo "Migrations applied successfully."

echo "You can now inspect the database schema in Supabase Studio."
echo "URL: http://localhost:54323"
