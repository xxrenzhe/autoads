const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TypeScript files with isActive references
const filesWithIsActive = execSync('grep -r "isActive" --include="*.ts" --include="*.tsx" src/ | cut -d: -f1 | sort | uniq').toString().trim().split('\n');

console.log('Found files with isActive references:', filesWithIsActive);

// Process each file
filesWithIsActive.forEach(filePath => {
  if (!filePath) return;
  
  const fullPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) return;
  
  console.log(`Processing ${filePath}...`);
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Replace isActive: true with status: 'ACTIVE'
  content = content.replace(/isActive:\s*true/g, "status: 'ACTIVE'");
  
  // Replace isActive: false with status: 'INACTIVE'
  content = content.replace(/isActive:\s*false/g, "status: 'INACTIVE'");
  
  // Replace user.isActive with user.status === 'ACTIVE'
  content = content.replace(/user\.isActive/g, "user.status === 'ACTIVE'");
  
  // Replace .isActive with .status === 'ACTIVE' in other contexts
  content = content.replace(/\.isActive(?!\s*=)/g, ".status === 'ACTIVE'");
  
  // Replace isActive in select fields
  content = content.replace(/isActive,\s*/g, "status,\n");
  
  // Replace isActive in where clauses
  content = content.replace(/isActive:\s*\{[^}]*\}/g, "status: 'ACTIVE'");
  
  fs.writeFileSync(fullPath, content);
});

console.log('Fixed all isActive references');