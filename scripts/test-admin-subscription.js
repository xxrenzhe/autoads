/**
 * Test script to verify admin subscription assignment functionality
 * 
 * This script tests:
 * 1. Getting all available plans
 * 2. Assigning a subscription to a user
 * 3. Modifying an existing subscription
 * 4. Canceling a subscription
 */

const API_BASE = 'http://localhost:3000/api';

// Test credentials - replace with actual admin credentials
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'password';

// Test user ID - replace with an actual user ID from your database
const TEST_USER_ID = 'user_id_here';

async function login() {
  console.log('🔐 Logging in as admin...');
  
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  const data = await response.json();
  console.log('✅ Login successful');
  return data.sessionToken;
}

async function getPlans(sessionToken) {
  console.log('\n📋 Getting available plans...');
  
  const response = await fetch(`${API_BASE}/admin/plans?action=list&includeInactive=false`, {
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get plans');
  }
  
  const data = await response.json();
  console.log('✅ Plans retrieved:', data.data.plans.map(p => ({ id: p.id, name: p.name, price: p.price })));
  return data.data.plans;
}

async function assignSubscription(sessionToken, userId, planId) {
  console.log(`\n📦 Assigning plan ${planId} to user ${userId}...`);
  
  const response = await fetch(`${API_BASE}/admin/users/${userId}/subscription`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      planId,
      duration: 1, // 1 month
      notes: 'Test assignment by admin'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Failed to assign subscription:', data.error);
    return null;
  }
  
  console.log('✅ Subscription assigned successfully:', data.subscription);
  return data.subscription;
}

async function modifySubscription(sessionToken, userId, extendDays = 7) {
  console.log(`\n🔄 Extending subscription by ${extendDays} days...`);
  
  const response = await fetch(`${API_BASE}/admin/users/${userId}/subscription`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      extendDays,
      notes: 'Test extension by admin'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Failed to modify subscription:', data.error);
    return null;
  }
  
  console.log('✅ Subscription modified successfully:', data);
  return data;
}

async function cancelSubscription(sessionToken, userId) {
  console.log('\n❌ Canceling subscription...');
  
  const response = await fetch(`${API_BASE}/admin/users/${userId}/subscription`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      cancelImmediately: true,
      notes: 'Test cancellation by admin'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Failed to cancel subscription:', data.error);
    return false;
  }
  
  console.log('✅ Subscription canceled successfully');
  return true;
}

async function runTests() {
  try {
    console.log('🚀 Starting admin subscription assignment tests...\n');
    
    // Login
    const sessionToken = await login();
    
    // Get available plans
    const plans = await getPlans(sessionToken);
    
    if (plans.length === 0) {
      console.log('❌ No plans available. Please create plans first.');
      return;
    }
    
    // Select the first non-free plan for testing
    const testPlan = plans.find(p => p.price > 0) || plans[0];
    
    console.log(`\n📝 Test Plan Selected: ${testPlan.name} (${testPlan.displayName})`);
    
    // Test 1: Assign subscription
    console.log('\n=== Test 1: Assign Subscription ===');
    const subscription = await assignSubscription(sessionToken, TEST_USER_ID, testPlan.id);
    
    if (!subscription) {
      console.log('❌ Skipping further tests due to assignment failure');
      return;
    }
    
    // Test 2: Modify subscription (extend)
    console.log('\n=== Test 2: Modify Subscription ===');
    await modifySubscription(sessionToken, TEST_USER_ID, 7);
    
    // Test 3: Cancel subscription
    console.log('\n=== Test 3: Cancel Subscription ===');
    await cancelSubscription(sessionToken, TEST_USER_ID);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
  }
}

// Check if we're running directly
if (require.main === module) {
  // Check for command line arguments
  const args = process.argv.slice(2);
  if (args.length >= 2) {
    ADMIN_EMAIL = args[0];
    ADMIN_PASSWORD = args[1];
  }
  if (args.length >= 3) {
    TEST_USER_ID = args[2];
  }
  
  console.log('Using:');
  console.log('  Admin Email:', ADMIN_EMAIL);
  console.log('  Test User ID:', TEST_USER_ID);
  console.log('\nTo use different credentials, run:');
  console.log('  node test-admin-subscription.js <email> <password> <userId>\n');
  
  runTests();
}

module.exports = {
  login,
  getPlans,
  assignSubscription,
  modifySubscription,
  cancelSubscription,
  runTests
};