#!/bin/bash

# Fix session-security.ts field references

echo "Fixing session-security.ts SecurityEvent field references..."

sed -i '' 's/eventType:/type:/g' /Users/jason/Documents/Kiro/url-batch-checker/src/lib/security/session-security.ts
sed -i '' 's/timestamp:/createdAt:/g' /Users/jason/Documents/Kiro/url-batch-checker/src/lib/security/session-security.ts
sed -i '' 's/orderBy: { timestamp:/orderBy: { createdAt:/g' /Users/jason/Documents/Kiro/url-batch-checker/src/lib/security/session-security.ts

echo "Fixed session-security.ts"