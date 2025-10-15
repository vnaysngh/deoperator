#!/bin/bash

# Script to check that all tool return statements include message fields
# Run this before committing changes to route.ts

echo "🔍 Checking tool return statements for required message fields..."
echo ""

ROUTE_FILE="src/app/api/chat/route.ts"
ERRORS=0

if [ ! -f "$ROUTE_FILE" ]; then
  echo "❌ Error: $ROUTE_FILE not found"
  exit 1
fi

# Extract all tool definitions and their return statements
# This is a simple heuristic check - not perfect but catches obvious issues

echo "Checking for return statements without 'message' or 'userMessage'..."
echo ""

# Find all return statements within tool execute functions
# Look for patterns like: return { success: ...
grep -n "return {" "$ROUTE_FILE" | while read -r line; do
  LINE_NUM=$(echo "$line" | cut -d: -f1)
  LINE_CONTENT=$(echo "$line" | cut -d: -f2-)

  # Get the next 10 lines after this return statement
  CONTEXT=$(sed -n "${LINE_NUM},$((LINE_NUM + 10))p" "$ROUTE_FILE")

  # Check if this return statement has 'message' or 'userMessage'
  if echo "$CONTEXT" | grep -q "message:"; then
    # Has message field - good!
    :
  else
    # Check if it's a tool-related return (not just any return in the file)
    if echo "$CONTEXT" | grep -q "success:"; then
      # This is a tool return without a message field
      echo "⚠️  Line $LINE_NUM: Return statement without 'message' or 'userMessage'"
      echo "   Context: $LINE_CONTENT"
      echo ""
      ERRORS=$((ERRORS + 1))
    fi
  fi
done

echo ""
echo "----------------------------------------"

if [ $ERRORS -eq 0 ]; then
  echo "✅ All tool return statements appear to have message fields"
  echo ""
  echo "Note: This is a heuristic check. Please manually verify:"
  echo "  1. All success returns have 'message' field"
  echo "  2. All error returns have 'userMessage' field"
  echo "  3. Messages are user-friendly and actionable"
  exit 0
else
  echo "❌ Found $ERRORS potential issue(s)"
  echo ""
  echo "Please ensure ALL tool returns include:"
  echo "  • success: true → must have 'message' field"
  echo "  • success: false → must have 'userMessage' field"
  echo ""
  echo "See TOOL_CONVENTION.md for details"
  exit 1
fi
