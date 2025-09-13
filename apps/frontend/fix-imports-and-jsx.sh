#!/bin/bash

echo "Fixing import and JSX syntax errors..."

# Fix 1: Fix malformed import statements with trailing commas
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix imports with trailing commas before closing brace
  sed -i '' 's/import { \([^}]*\), }/import { \1 }/g' "$file"
  
  # Fix imports with trailing commas in the middle
  sed -i '' 's/import { \([^}]*\), \(.*\) }/import { \1, \2 }/g' "$file"
  
  # Fix imports with semicolon issues
  sed -i '' 's/import \([^;]*\);$/import \1;/g' "$file"
done

# Fix 2: Fix JSX self-closing tags that were malformed
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix components that should be self-closing
  sed -i '' 's/></Plus className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></CreditCard className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Edit className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Trash2 className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Check className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></X className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Zap className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Users className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Settings className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></DollarSign className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Calendar className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Star className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Shield className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Smartphone className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Globe className="[^"]*"[^>]*>/>/g" "$file"
  sed -i '' 's/></Activity className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></TrendingUp className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Clock className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></MousePointer className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Eye className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Target className="[^"]*"[^>]*>/>/g" "$file"
  sed -i '' 's/></Filter className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></Download className="[^"]*"[^>]*>/>/g" "$file"
  sed -i '' 's/></BarChart3 className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></RefreshCw className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></AlertTriangle className="[^"]*"[^>]*>/>/g' "$file"
  sed -i '' 's/></CheckCircle className="[^"]*"[^>]*>/>/g" "$file"
  sed -i '' 's/></Key className="[^"]*"[^>]*>/>/g' "$file"
  
  # Fix chart components
  sed -i '' 's/></LineChart>/&>/g' "$file"
  sed -i '' 's/></BarChart>/&>/g' "$file"
  sed -i '' 's/></PieChart>/&>/g' "$file"
  sed -i '' 's/></AreaChart>/&>/g' "$file"
  sed -i '' 's/></XAxis>/&>/g' "$file"
  sed -i '' 's/></YAxis>/&>/g' "$file"
  sed -i '' 's/></CartesianGrid>/&>/g' "$file"
  sed -i '' 's/></Tooltip>/&>/g' "$file"
  sed -i '' 's/></Line>/&>/g' "$file"
  sed -i '' 's/></Bar>/&>/g' "$file"
  sed -i '' 's/></Pie>/&>/g' "$file"
  sed -i '' 's/></Area>/&>/g' "$file"
  sed -i '' 's/></Cell>/&>/g' "$file"
  sed -i '' 's/></ResponsiveContainer>/&>/g' "$file"
done

# Fix 3: Fix malformed JSX with opening/closing tags
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix Plus components
  sed -i '' 's/<Plus className=\([^>]*\)>[^<]*<\/Plus>/<Plus \1\/>/g' "$file"
  
  # Fix other icon components
  sed -i '' 's/<CreditCard className=\([^>]*\)>[^<]*<\/CreditCard>/<CreditCard \1\/>/g' "$file"
  sed -i '' 's/<Edit className=\([^>]*\)>[^<]*<\/Edit>/<Edit \1\/>/g' "$file"
  sed -i '' 's/<Trash2 className=\([^>]*\)>[^<]*<\/Trash2>/<Trash2 \1\/>/g' "$file"
  sed -i '' 's/<Check className=\([^>]*\)>[^<]*<\/Check>/<Check \1\/>/g' "$file"
  sed -i '' 's/<X className=\([^>]*\)>[^<]*<\/X>/<X \1\/>/g' "$file"
  sed -i '' 's/<Zap className=\([^>]*\)>[^<]*<\/Zap>/<Zap \1\/>/g' "$file"
  sed -i '' 's/<Users className=\([^>]*\)>[^<]*<\/Users>/<Users \1\/>/g' "$file"
  sed -i '' 's/<Globe className=\([^>]*\)>[^<]*<\/Globe>/<Globe \1\/>/g' "$file"
  sed -i '' 's/<Activity className=\([^>]*\)>[^<]*<\/Activity>/<Activity \1\/>/g' "$file"
  sed -i '' 's/<TrendingUp className=\([^>]*\)>[^<]*<\/TrendingUp>/<TrendingUp \1\/>/g' "$file"
  sed -i '' 's/<Clock className=\([^>]*\)>[^<]*<\/Clock>/<Clock \1\/>/g' "$file"
  sed -i '' 's/<MousePointer className=\([^>]*\)>[^<]*<\/MousePointer>/<MousePointer \1\/>/g' "$file"
  sed -i '' 's/<Eye className=\([^>]*\)>[^<]*<\/Eye>/<Eye \1\/>/g' "$file"
  sed -i '' 's/<Target className=\([^>]*\)>[^<]*<\/Target>/<Target \1\/>/g' "$file"
  sed -i '' 's/<Filter className=\([^>]*\)>[^<]*<\/Filter>/<Filter \1\/>/g' "$file"
  sed -i '' 's/<Download className=\([^>]*\)>[^<]*<\/Download>/<Download \1\/>/g' "$file"
  sed -i '' 's/<BarChart3 className=\([^>]*\)>[^<]*<\/BarChart3>/<BarChart3 \1\/>/g' "$file"
  sed -i '' 's/<RefreshCw className=\([^>]*\)>[^<]*<\/RefreshCw>/<RefreshCw \1\/>/g' "$file"
  sed -i '' 's/<AlertTriangle className=\([^>]*\)>[^<]*<\/AlertTriangle>/<AlertTriangle \1\/>/g' "$file"
  sed -i '' 's/<CheckCircle className=\([^>]*\)>[^<]*<\/CheckCircle>/<CheckCircle \1\/>/g' "$file"
  sed -i '' 's/<Key className=\([^>]*\)>[^<]*<\/Key>/<Key \1\/>/g' "$file"
  sed -i '' 's/<Settings className=\([^>]*\)>[^<]*<\/Settings>/<Settings \1\/>/g' "$file"
  sed -i '' 's/<DollarSign className=\([^>]*\)>[^<]*<\/DollarSign>/<DollarSign \1\/>/g' "$file"
  sed -i '' 's/<Calendar className=\([^>]*\)>[^<]*<\/Calendar>/<Calendar \1\/>/g' "$file"
  sed -i '' 's/<Star className=\([^>]*\)>[^<]*<\/Star>/<Star \1\/>/g' "$file"
  sed -i '' 's/<Shield className=\([^>]*\)>[^<]*<\/Shield>/<Shield \1\/>/g' "$file"
  sed -i '' 's/<Smartphone className=\([^>]*\)>[^<]*<\/Smartphone>/<Smartphone \1\/>/g' "$file"
done

# Fix 4: Fix malformed arrow functions in event handlers
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix onClick handlers
  sed -i '' 's/onClick={(\([^)]*\)): any => {/onClick={($1) => {/g' "$file"
  sed -i '' 's/onClick={(\([^)]*\)): any =>/onClick={($1) =>/g' "$file"
  
  # Fix onChange handlers
  sed -i '' 's/onChange={(\([^)]*\)): any => {/onChange={($1) => {/g' "$file"
  sed -i '' 's/onChange={(\([^)]*\)): any =>/onChange={($1) =>/g' "$file"
  
  # Fix onKeyDown handlers
  sed -i '' 's/onKeyDown={(\([^)]*\)): any => {/onKeyDown={($1) => {/g' "$file"
  sed -i '' 's/onKeyDown={(\([^)]*\)): any =>/onKeyDown={($1) =>/g' "$file"
  
  # Fix other handlers
  sed -i '' 's/onSubmit={(\([^)]*\)): any => {/onSubmit={($1) => {/g' "$file"
  sed -i '' 's/onSubmit={(\([^)]*\)): any =>/onSubmit={($1) =>/g' "$file"
  
  sed -i '' 's/onFocus={(\([^)]*\)): any => {/onFocus={($1) => {/g' "$file"
  sed -i '' 's/onFocus={(\([^)]*\)): any =>/onFocus={($1) =>/g' "$file"
  
  sed -i '' 's/onBlur={(\([^)]*\)): any => {/onBlur={($1) => {/g' "$file"
  sed -i '' 's/onBlur={(\([^)]*\)): any =>/onBlur={($1) =>/g' "$file"
  
  sed -i '' 's/onMouseEnter={(\([^)]*\)): any => {/onMouseEnter={($1) => {/g' "$file"
  sed -i '' 's/onMouseEnter={(\([^)]*\)): any =>/onMouseEnter={($1) =>/g' "$file"
  
  sed -i '' 's/onMouseLeave={(\([^)]*\)): any => {/onMouseLeave={($1) => {/g' "$file"
  sed -i '' 's/onMouseLeave={(\([^)]*\)): any =>/onMouseLeave={($1) =>/g' "$file"
  
  sed -i '' 's/onSelect={(\([^)]*\)): any => {/onSelect={($1) => {/g' "$file"
  sed -i '' 's/onSelect={(\([^)]*\)): any =>/onSelect={($1) =>/g' "$file"
  
  sed -i '' 's/onToggle={(\([^)]*\)): any => {/onToggle={($1) => {/g' "$file"
  sed -i '' 's/onToggle={(\([^)]*\)): any =>/onToggle={($1) =>/g' "$file"
  
  sed -i '' 's/onOpen={(\([^)]*\)): any => {/onOpen={($1) => {/g' "$file"
  sed -i '' 's/onOpen={(\([^)]*\)): any =>/onOpen={($1) =>/g' "$file"
  
  sed -i '' 's/onClose={(\([^)]*\)): any => {/onClose={($1) => {/g' "$file"
  sed -i '' 's/onClose={(\([^)]*\)): any =>/onClose={($1) =>/g' "$file"
  
  sed -i '' 's/onSave={(\([^)]*\)): any => {/onSave={($1) => {/g' "$file"
  sed -i '' 's/onSave={(\([^)]*\)): any =>/onSave={($1) =>/g' "$file"
  
  sed -i '' 's/onDelete={(\([^)]*\)): any => {/onDelete={($1) => {/g' "$file"
  sed -i '' 's/onDelete={(\([^)]*\)): any =>/onDelete={($1) =>/g' "$file"
  
  sed -i '' 's/onEdit={(\([^)]*\)): any => {/onEdit={($1) => {/g' "$file"
  sed -i '' 's/onEdit={(\([^)]*\)): any =>/onEdit={($1) =>/g' "$file"
  
  sed -i '' 's/onAdd={(\([^)]*\)): any => {/onAdd={($1) => {/g' "$file"
  sed -i '' 's/onAdd={(\([^)]*\)): any =>/onAdd={($1) =>/g' "$file"
  
  sed -i '' 's/onCreate={(\([^)]*\)): any => {/onCreate={($1) => {/g' "$file"
  sed -i '' 's/onCreate={(\([^)]*\)): any =>/onCreate={($1) =>/g' "$file"
  
  sed -i '' 's/onUpdate={(\([^)]*\)): any => {/onUpdate={($1) => {/g' "$file"
  sed -i '' 's/onUpdate={(\([^)]*\)): any =>/onUpdate={($1) =>/g' "$file"
  
  sed -i '' 's/onTest={(\([^)]*\)): any => {/onTest={($1) => {/g' "$file"
  sed -i '' 's/onTest={(\([^)]*\)): any =>/onTest={($1) =>/g' "$file"
  
  sed -i '' 's/onCheck={(\([^)]*\)): any => {/onCheck={($1) => {/g' "$file"
  sed -i '' 's/onCheck={(\([^)]*\)): any =>/onCheck={($1) =>/g' "$file"
  
  sed -i '' 's/onFilter={(\([^)]*\)): any => {/onFilter={($1) => {/g' "$file"
  sed -i '' 's/onFilter={(\([^)]*\)): any =>/onFilter={($1) =>/g' "$file"
  
  sed -i '' 's/onSearch={(\([^)]*\)): any => {/onSearch={($1) => {/g' "$file"
  sed -i '' 's/onSearch={(\([^)]*\)): any =>/onSearch={($1) =>/g' "$file"
  
  sed -i '' 's/onSort={(\([^)]*\)): any => {/onSort={($1) => {/g' "$file"
  sed -i '' 's/onSort={(\([^)]*\)): any =>/onSort={($1) =>/g' "$file"
  
  sed -i '' 's/onLoad={(\([^)]*\)): any => {/onLoad={($1) => {/g' "$file"
  sed -i '' 's/onLoad={(\([^)]*\)): any =>/onLoad={($1) =>/g' "$file"
  
  sed -i '' 's/onRefresh={(\([^)]*\)): any => {/onRefresh={($1) => {/g' "$file"
  sed -i '' 's/onRefresh={(\([^)]*\)): any =>/onRefresh={($1) =>/g' "$file"
  
  sed -i '' 's/onReset={(\([^)]*\)): any => {/onReset={($1) => {/g' "$file"
  sed -i '' 's/onReset={(\([^)]*\)): any =>/onReset={($1) =>/g' "$file"
  
  sed -i '' 's/onClear={(\([^)]*\)): any => {/onClear={($1) => {/g' "$file"
  sed -i '' 's/onClear={(\([^)]*\)): any =>/onClear={($1) =>/g' "$file"
  
  sed -i '' 's/onConfirm={(\([^)]*\)): any => {/onConfirm={($1) => {/g' "$file"
  sed -i '' 's/onConfirm={(\([^)]*\)): any =>/onConfirm={($1) =>/g' "$file"
  
  sed -i '' 's/onCancel={(\([^)]*\)): any => {/onCancel={($1) => {/g' "$file"
  sed -i '' 's/onCancel={(\([^)]*\)): any =>/onCancel={($1) =>/g' "$file"
done

echo "Import and JSX fixes completed!"
echo "Running TypeScript check..."
npm run type-check 2>&1 | head -50