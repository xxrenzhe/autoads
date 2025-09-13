#!/bin/bash

echo "Starting comprehensive TypeScript error fixes..."

# Fix 1: Fix malformed arrow functions in if statements
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix if statements with arrow functions
  sed -i '' 's/if (([^)]*):[^)]*) => {/if ($1) {/g' "$file"
  sed -i '' 's/if (([^)]*):[^)]*) =>/if ($1/g' "$file"
  
  # Fix switch statements with arrow functions
  sed -i '' 's/switch (([^)]*):[^)]*) => {/switch ($1) {/g' "$file"
  sed -i '' 's/switch (([^)]*):[^)]*) =>/switch ($1/g' "$file"
  
  # Fix catch blocks with arrow functions
  sed -i '' 's/catch (([^)]*):[^)]*) => {/catch ($1) {/g' "$file"
  sed -i '' 's/catch (([^)]*):[^)]*) =>/catch ($1/g' "$file"
done

# Fix 2: Fix malformed JSX event handlers
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix onClick handlers with malformed arrow functions
  sed -i '' 's/onClick={(([^)]*):[^)]*) =>/onClick={($1) =>/g' "$file"
  sed -i '' 's/onChange={(([^)]*):[^)]*) =>/onChange={($1) =>/g' "$file"
  sed -i '' 's/onKeyDown={(([^)]*):[^)]*) =>/onKeyDown={($1) =>/g' "$file"
  sed -i '' 's/onSubmit={(([^)]*):[^)]*) =>/onSubmit={($1) =>/g' "$file"
  sed -i '' 's/onFocus={(([^)]*):[^)]*) =>/onFocus={($1) =>/g' "$file"
  sed -i '' 's/onBlur={(([^)]*):[^)]*) =>/onBlur={($1) =>/g' "$file"
  sed -i '' 's/onMouseEnter={(([^)]*):[^)]*) =>/onMouseEnter={($1) =>/g' "$file"
  sed -i '' 's/onMouseLeave={(([^)]*):[^)]*) =>/onMouseLeave={($1) =>/g' "$file"
  sed -i '' 's/onSelect={(([^)]*):[^)]*) =>/onSelect={($1) =>/g' "$file"
  sed -i '' 's/onToggle={(([^)]*):[^)]*) =>/onToggle={($1) =>/g' "$file"
  sed -i '' 's/onOpen={(([^)]*):[^)]*) =>/onOpen={($1) =>/g' "$file"
  sed -i '' 's/onClose={(([^)]*):[^)]*) =>/onClose={($1) =>/g' "$file"
  sed -i '' 's/onSave={(([^)]*):[^)]*) =>/onSave={($1) =>/g' "$file"
  sed -i '' 's/onDelete={(([^)]*):[^)]*) =>/onDelete={($1) =>/g' "$file"
  sed -i '' 's/onEdit={(([^)]*):[^)]*) =>/onEdit={($1) =>/g' "$file"
  sed -i '' 's/onAdd={(([^)]*):[^)]*) =>/onAdd={($1) =>/g' "$file"
  sed -i '' 's/onCreate={(([^)]*):[^)]*) =>/onCreate={($1) =>/g' "$file"
  sed -i '' 's/onUpdate={(([^)]*):[^)]*) =>/onUpdate={($1) =>/g' "$file"
  sed -i '' 's/onTest={(([^)]*):[^)]*) =>/onTest={($1) =>/g' "$file"
  sed -i '' 's/onCheck={(([^)]*):[^)]*) =>/onCheck={($1) =>/g' "$file"
  sed -i '' 's/onFilter={(([^)]*):[^)]*) =>/onFilter={($1) =>/g' "$file"
  sed -i '' 's/onSearch={(([^)]*):[^)]*) =>/onSearch={($1) =>/g' "$file"
  sed -i '' 's/onSort={(([^)]*):[^)]*) =>/onSort={($1) =>/g' "$file"
  sed -i '' 's/onLoad={(([^)]*):[^)]*) =>/onLoad={($1) =>/g' "$file"
  sed -i '' 's/onRefresh={(([^)]*):[^)]*) =>/onRefresh={($1) =>/g' "$file"
  sed -i '' 's/onReset={(([^)]*):[^)]*) =>/onReset={($1) =>/g' "$file"
  sed -i '' 's/onClear={(([^)]*):[^)]*) =>/onClear={($1) =>/g' "$file"
  sed -i '' 's/onConfirm={(([^)]*):[^)]*) =>/onConfirm={($1) =>/g' "$file"
  sed -i '' 's onCancel={(([^)]*):[^)]*) =>/onCancel={($1) =>/g' "$file"
  
  # Fix inline event handlers with stopPropagation
  sed -i '' 's/onClick={((e[^)]*):[^)]*) => {/onClick={($1) => {/g' "$file"
  sed -i '' 's/onClick={((e[^)]*):[^)]*) =>/onClick={($1) =>/g' "$file"
  sed -i '' 's/onChange={((e[^)]*):[^)]*) => {/onChange={($1) => {/g' "$file"
  sed -i '' 's/onChange={((e[^)]*):[^)]*) =>/onChange={($1) =>/g' "$file"
done

# Fix 3: Fix incorrect function declarations (arrow function instead of function declaration)
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix function declarations that were incorrectly written as arrow functions
  sed -i '' 's/^export const \([A-Z][a-zA-Z0-9]*\) = (\([^)]*\)): \([^ {]*\) => {/export function \1(\2): \3 {/g' "$file"
  sed -i '' 's/^const \([A-Z][a-zA-Z0-9]*\) = (\([^)]*\)): \([^ {]*\) => {/function \1(\2): \3 {/g' "$file"
  
  # Fix interface function declarations
  sed -i '' 's/ \([a-zA-Z][a-zA-Z0-9]*\): (\([^)]*\)): \([^ {]*\) => {/ \1(\2): \3 {/g' "$file"
done

# Fix 4: Fix Props type annotations
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix component Props type annotations
  sed -i '' 's/function \([A-Z][a-zA-Z0-9]*\)({ \([^}]*\) }: Props)/function \1({ \2 }: \1Props)/g' "$file"
  sed -i '' 's/function \([A-Z][a-zA-Z0-9]*\)({ \([^}]*\) }: Props)/function \1({ \2 }: Props)/g' "$file"
  sed -i '' 's/export function \([A-Z][a-zA-Z0-9]*\)({ \([^}]*\) }: Props)/export function \1({ \2 }: \1Props)/g' "$file"
  
  # Fix Props in destructuring
  sed -i '' 's/}: Props {/}: Props {/g' "$file"
  
  # Define missing Props interfaces
  sed -i '' 's/export function \([A-Z][a-zA-Z0-9]*\)({ className }: Props) {/export function \1({ className }: { className?: string }) {/g' "$file"
done

# Fix 5: Fix import/export issues
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix missing semicolons in imports
  sed -i '' 's/import \([^;]*\)$/import \1;/g' "$file"
  
  # Fix malformed exports
  sed -i '' 's/export default function \([A-Z][a-zA-Z0-9]*\)(/export default function \1(/g' "$file"
  sed -i '' 's/export function \([A-Z][a-zA-Z0-9]*\)(/export function \1(/g' "$file"
done

# Fix 6: Fix JSX syntax issues
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix malformed JSX attributes
  sed -i '' 's/className={`\([^`]*\)`}/className="\1"/g' "$file"
  
  # Fix missing JSX closing tags
  sed -i '' 's/<\([^>]*\) \/>$/<\/\1>/g' "$file"
  
  # Fix self-closing tags that should not be
  sed -i '' 's/<\/\([^>]*\)>/<\/\1>/g' "$file"
done

# Fix 7: Fix type annotation issues
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix React event handler types
  sed -i '' 's/: (e: any): any =>/: (e: React.MouseEvent) =>/g' "$file"
  sed -i '' 's/: (e: any)/: (e: React.MouseEvent)/g' "$file"
  sed -i '' 's/: (event: any): any =>/: (event: React.MouseEvent) =>/g' "$file"
  sed -i '' 's/: (event: any)/: (event: React.MouseEvent)/g' "$file"
  
  # Fix FormEvent handlers
  sed -i '' 's/: (e: React.FormEvent) =>/: (e: React.FormEvent<HTMLFormElement>) =>/g' "$file"
  
  # Fix KeyboardEvent handlers
  sed -i '' 's/: (e: KeyboardEvent) =>/: (e: React.KeyboardEvent) =>/g' "$file"
  
  # Fix ChangeEvent handlers
  sed -i '' 's/: (e: React.ChangeEvent) =>/: (e: React.ChangeEvent<HTMLInputElement>) =>/g' "$file"
  sed -i '' 's/: (e: React.ChangeEvent) =>/: (e: React.ChangeEvent<HTMLSelectElement>) =>/g' "$file"
  sed -i '' 's/: (e: React.ChangeEvent) =>/: (e: React.ChangeEvent<HTMLTextAreaElement>) =>/g' "$file"
done

# Fix 8: Fix callback function types
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix useCallback types
  sed -i '' 's/useCallback(([^)]*) =>/useCallback(($1) =>/g' "$file"
  sed -i '' 's/useCallback(([^)]*):[^)]* =>/useCallback(($1) =>/g' "$file"
  
  # Fix useEffect dependencies
  sed -i '' 's/useEffect(() => {/useEffect(() => {/g' "$file"
  
  # Fix useState types
  sed -i '' 's/useState<\([^>]*\)>(([^)]*))/useState<\1>(\2)/g' "$file"
done

# Fix 9: Fix interface and type issues
find . -name "*.tsx" -type f -not -path "./node_modules/*" -not -path "./.next/*" | while read -r file; do
  # Fix optional properties in interfaces
  sed -i '' 's/\([a-zA-Z][a-zA-Z0-9]*\): \([^;]*);\([a-zA-Z]\)/\1?: \2;\n3/g' "$file"
  
  # Fix missing interface definitions
  sed -i '' 's/export function \([A-Z][a-zA-Z0-9]*\)([^)]*): \([^ {]*\) {/export function \1(\2): \3 {/g' "$file"
done

echo "Comprehensive TypeScript fixes completed!"
echo "Running TypeScript check to see remaining errors..."
npm run type-check 2>&1 | head -50