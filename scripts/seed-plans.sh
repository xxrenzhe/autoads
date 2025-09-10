#!/bin/bash

echo "Seeding initial subscription plans..."

# Seed plans
curl -X POST http://localhost:3000/api/seed/plans \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}\n"

echo "\nDone!"