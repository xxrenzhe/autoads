#!/bin/bash

# Fix JSX Component Tags (most common error)
echo "Fixing JSX component tags..."

# Fix all self-closing component tags that are malformed
find . -type f -name "*.tsx" -not -path "./node_modules/*" -not -path "./.next/*" | while read file; do
  # Fix common malformed JSX tags
  sed -i '' 's|</CheckCircle\([ >]\)|<CheckCircle\1|g' "$file"
  sed -i '' 's|</Clock\([ >]\)|<Clock\1|g' "$file"
  sed -i '' 's|</AlertTriangle\([ >]\)|<AlertTriangle\1|g' "$file"
  sed -i '' 's|</RefreshCw\([ >]\)|<RefreshCw\1|g' "$file"
  sed -i '' 's|</Activity\([ >]\)|<Activity\1|g' "$file"
  sed -i '' 's|</TrendingUp\([ >]\)|<TrendingUp\1|g' "$file"
  sed -i '' 's|</Globe\([ >]\)|<Globe\1|g' "$file"
  sed -i '' 's|</Key\([ >]\)|<Key\1|g' "$file"
  sed -i '' 's|</Plus\([ >]\)|<Plus\1|g' "$file"
  sed -i '' 's|</Edit\([ >]\)|<Edit\1|g' "$file"
  sed -i '' 's|</Trash2\([ >]\)|<Trash2\1|g' "$file"
  sed -i '' 's|</Eye\([ >]\)|<Eye\1|g' "$file"
  sed -i '' 's|</Settings\([ >]\)|<Settings\1|g' "$file"
  sed -i '' 's|</Users\([ >]\)|<Users\1|g' "$file"
  sed -i '' 's|</Target\([ >]\)|<Target\1|g' "$file"
  sed -i '' 's|</Download\([ >]\)|<Download\1|g' "$file"
  sed -i '' 's|</Zap\([ >]\)|<Zap\1|g' "$file"
  sed -i '' 's|</BarChart3\([ >]\)|<BarChart3\1|g' "$file"
  sed -i '' 's|</MousePointer\([ >]\)|<MousePointer\1|g' "$file"
  sed -i '' 's|</X\([ >]\)|<X\1|g' "$file"
  sed -i '' 's|</Shield\([ >]\)|<Shield\1|g' "$file"
  sed -i '' 's|</Search\([ >]\)|<Search\1|g' "$file"
  sed -i '' 's|</Filter\([ >]\)|<Filter\1|g' "$file"
  sed -i '' 's|</Calendar\([ >]\)|<Calendar\1|g' "$file"
  sed -i '' 's|</FileText\([ >]\)|<FileText\1|g' "$file"
  sed -i '' 's|</Database\([ >]\)|<Database\1|g' "$file"
  sed -i '' 's|</Smartphone\([ >]\)|<Smartphone\1|g' "$file"
  
  # Fix Chart components
  sed -i '' 's|</CartesianGrid\([ >]\)|<CartesianGrid\1|g' "$file"
  sed -i '' 's|</XAxis\([ >]\)|<XAxis\1|g' "$file"
  sed -i '' 's|</YAxis\([ >]\)|<YAxis\1|g' "$file"
  sed -i '' 's|</Tooltip\([ >]\)|<Tooltip\1|g' "$file"
  sed -i '' 's|</Line\([ >]\)|<Line\1|g' "$file"
  sed -i '' 's|</Area\([ >]\)|<Area\1|g' "$file"
  sed -i '' 's|</Bar\([ >]\)|<Bar\1|g' "$file"
  sed -i '' 's|</Pie\([ >]\)|<Pie\1|g' "$file"
  sed -i '' 's|</Cell\([ >]\)|<Cell\1|g' "$file"
done

echo "Fixed JSX component tags"