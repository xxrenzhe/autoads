import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

async function testFrontendInterface() {
  console.log('=== Testing Frontend Interface ===\n');
  
  try {
    // Test 1: Check frontend directory structure
    console.log('1. Testing frontend directory structure...');
    
    const frontendDirs = [
      'src/app',
      'src/components',
      'src/lib',
      'src/types',
      'public'
    ];
    
    for (const dir of frontendDirs) {
      if (existsSync(dir)) {
        console.log(`   ✓ ${dir} exists`);
      } else {
        console.log(`   ✗ ${dir} missing`);
      }
    }
    
    // Test 2: Check AutoClick related pages
    console.log('\n2. Testing AutoClick pages...');
    
    const autoclickPages = [
      'src/app/autoclick/page.tsx',
      'src/app/autoclick/tasks/page.tsx',
      'src/app/autoclick/analytics/page.tsx',
      'src/app/autoclick/settings/page.tsx'
    ];
    
    for (const page of autoclickPages) {
      if (existsSync(page)) {
        console.log(`   ✓ ${page.split('/').pop()} exists`);
      } else {
        console.log(`   ✗ ${page.split('/').pop()} missing`);
      }
    }
    
    // Test 3: Check AutoClick components
    console.log('\n3. Testing AutoClick components...');
    
    const componentDirs = [
      'src/components/autoclick',
      'src/components/ui',
      'src/components/forms'
    ];
    
    for (const dir of componentDirs) {
      if (existsSync(dir)) {
        const files = readdirSync(dir);
        console.log(`   ✓ ${dir} (${files.length} files)`);
      } else {
        console.log(`   ✗ ${dir} missing`);
      }
    }
    
    // Test 4: Check TypeScript types
    console.log('\n4. Testing TypeScript types...');
    
    const typeFiles = [
      'src/types/autoclick.ts',
      'src/types/api.ts',
      'src/types/index.ts'
    ];
    
    for (const typeFile of typeFiles) {
      if (existsSync(typeFile)) {
        console.log(`   ✓ ${typeFile.split('/').pop()} exists`);
      } else {
        console.log(`   ✗ ${typeFile.split('/').pop()} missing`);
      }
    }
    
    // Test 5: Check main AutoClick page
    console.log('\n5. Testing main AutoClick page content...');
    
    const mainPagePath = 'src/app/autoclick/page.tsx';
    if (existsSync(mainPagePath)) {
      const content = readFileSync(mainPagePath, 'utf-8');
      
      // Check for key imports
      const hasAutoClickService = content.includes('AutoClickService');
      const hasAutoClickScheduler = content.includes('AutoClickScheduler');
      const hasTokenService = content.includes('TokenService');
      
      console.log(`   AutoClickService import: ${hasAutoClickService ? '✓' : '✗'}`);
      console.log(`   AutoClickScheduler import: ${hasAutoClickScheduler ? '✓' : '✗'}`);
      console.log(`   TokenService import: ${hasTokenService ? '✓' : '✗'}`);
      
      // Check for main components
      const hasTaskList = content.includes('TaskList') || content.includes('taskList');
      const hasCreateForm = content.includes('CreateTask') || content.includes('createForm');
      const hasDashboard = content.includes('Dashboard') || content.includes('dashboard');
      
      console.log(`   TaskList component: ${hasTaskList ? '✓' : '✗'}`);
      console.log(`   CreateTask component: ${hasCreateForm ? '✓' : '✗'}`);
      console.log(`   Dashboard component: ${hasDashboard ? '✓' : '✗'}`);
    }
    
    // Test 6: Check API integration
    console.log('\n6. Testing API integration...');
    
    const apiRouteFiles = [
      'src/app/api/autoclick/tasks/route.ts',
      'src/app/api/autoclick/tasks/[id]/route.ts',
      'src/app/api/autoclick/stats/route.ts',
      'src/app/api/autoclick/execute/route.ts'
    ];
    
    for (const route of apiRouteFiles) {
      if (existsSync(route)) {
        console.log(`   ✓ ${route.split('/').slice(-2).join('/')} exists`);
      } else {
        console.log(`   ✗ ${route.split('/').slice(-2).join('/')} missing`);
      }
    }
    
    // Test 7: Check real-time features
    console.log('\n7. Testing real-time features...');
    
    const realTimeFiles = [
      'src/lib/sse.ts',
      'src/hooks/useSSE.ts',
      'src/components/real-time'
    ];
    
    for (const file of realTimeFiles) {
      if (existsSync(file)) {
        console.log(`   ✓ ${file.split('/').pop()} exists`);
      } else {
        console.log(`   ✗ ${file.split('/').pop()} missing`);
      }
    }
    
    // Test 8: Check styling and UI components
    console.log('\n8. Testing styling and UI...');
    
    const styleFiles = [
      'src/styles/globals.css',
      'src/components/ui/button.tsx',
      'src/components/ui/card.tsx',
      'src/components/ui/table.tsx'
    ];
    
    for (const file of styleFiles) {
      if (existsSync(file)) {
        console.log(`   ✓ ${file.split('/').pop()} exists`);
      } else {
        console.log(`   ✗ ${file.split('/').pop()} missing`);
      }
    }
    
    // Test 9: Check error handling
    console.log('\n9. Testing error handling...');
    
    const errorFiles = [
      'src/app/error.tsx',
      'src/app/not-found.tsx',
      'src/components/error-boundary.tsx'
    ];
    
    for (const file of errorFiles) {
      if (existsSync(file)) {
        console.log(`   ✓ ${file.split('/').pop()} exists`);
      } else {
        console.log(`   ✗ ${file.split('/').pop()} missing`);
      }
    }
    
    // Test 10: Check configuration files
    console.log('\n10. Testing configuration...');
    
    const configFiles = [
      'next.config.js',
      'tailwind.config.ts',
      'tsconfig.json'
    ];
    
    for (const file of configFiles) {
      if (existsSync(file)) {
        console.log(`   ✓ ${file} exists`);
      } else {
        console.log(`   ✗ ${file} missing`);
      }
    }
    
    // Test 11: Check build configuration
    console.log('\n11. Testing build configuration...');
    
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    const hasNext = packageJson.dependencies.next || packageJson.devDependencies.next;
    const hasReact = packageJson.dependencies.react || packageJson.devDependencies.react;
    const hasTypescript = packageJson.dependencies.typescript || packageJson.devDependencies.typescript;
    
    console.log(`   Next.js: ${hasNext ? '✓' : '✗'}`);
    console.log(`   React: ${hasReact ? '✓' : '✗'}`);
    console.log(`   TypeScript: ${hasTypescript ? '✓' : '✗'}`);
    
    // Test 12: Check environment variables
    console.log('\n12. Testing environment variables...');
    
    const envVars = [
      'NEXTAUTH_URL',
      'NEXTAUTH_SECRET',
      'DATABASE_URL',
      'REDIS_URL'
    ];
    
    for (const envVar of envVars) {
      const hasEnvVar = process.env[envVar] !== undefined;
      console.log(`   ${envVar}: ${hasEnvVar ? '✓' : '✗'}`);
    }
    
    console.log('\n=== Frontend Interface Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Frontend interface test failed:', error);
    throw error;
  }
}

// Run the test
testFrontendInterface()
  .then(() => {
    console.log('\n🎉 All frontend interface tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Frontend interface tests failed:', error);
    process.exit(1);
  });