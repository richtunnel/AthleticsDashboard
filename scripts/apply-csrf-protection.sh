#!/bin/bash

# Script to help identify routes that need CSRF protection
# This script lists all API routes with POST/PATCH/DELETE/PUT methods

echo "=== API Routes that may need CSRF protection ==="
echo ""
echo "Routes with POST/PATCH/DELETE/PUT methods:"
echo ""

# Find all route files
find src/app/api -name "route.ts" -type f | while read file; do
  # Check if file has POST, PATCH, DELETE, or PUT methods
  if grep -q "export async function \(POST\|PATCH\|DELETE\|PUT\)" "$file" 2>/dev/null; then
    # Check if already has CSRF protection
    if grep -q "withCSRFProtection" "$file" 2>/dev/null; then
      echo "✅ PROTECTED: $file"
    else
      echo "❌ NEEDS PROTECTION: $file"
      # Show the method names
      grep "export async function \(POST\|PATCH\|DELETE\|PUT\)" "$file" | sed 's/export async function /  → /'
    fi
  fi
done

echo ""
echo "=== Summary ==="
echo "Total routes to protect:"
find src/app/api -name "route.ts" -type f -exec grep -l "export async function \(POST\|PATCH\|DELETE\|PUT\)" {} \; | wc -l

echo "Already protected:"
find src/app/api -name "route.ts" -type f -exec grep -l "withCSRFProtection" {} \; | wc -l

echo ""
echo "To apply CSRF protection to a route:"
echo "1. Import: import { withCSRFProtection } from '@/lib/security/csrf';"
echo "2. Wrap: export const POST = withCSRFProtection(async (request) => { ... });"
echo "3. Close: Change final } to });"
