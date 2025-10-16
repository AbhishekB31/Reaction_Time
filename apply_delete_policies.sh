#!/bin/bash
# Script to apply DELETE policies to Supabase database

echo "Applying DELETE policies to Supabase database..."

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Try to apply the migration
echo "Attempting to apply migration..."
supabase db push

echo "If the above command failed, please run the SQL manually in your Supabase dashboard:"
echo ""
echo "1. Go to your Supabase project dashboard"
echo "2. Navigate to SQL Editor"
echo "3. Copy and paste this SQL:"
echo ""
cat manual_delete_policies.sql
