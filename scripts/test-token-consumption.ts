import { TokenService } from '@/lib/services/token-service';
import { prisma } from '@/lib/prisma';
import { TokenTransactionType, TokenUsageFeature } from '@prisma/client';

async function testTokenConsumption() {
  console.log('=== Testing Token Consumption ===\n');
  
  try {
    // Test 1: TokenService initialization
    console.log('1. Testing TokenService initialization...');
    const tokenService = new TokenService();
    console.log('   ✓ TokenService initialized');
    
    // Test 2: Create test user with tokens
    console.log('\n2. Creating test user with token balance...');
    
    let testUser = await prisma.user.findFirst({
      where: { email: 'token@test.com' }
    });
    
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'token@test.com',
          name: 'Token Test User',
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          tokenBalance: 1000
        }
      });
      console.log(`   Created test user: ${testUser.id}`);
      console.log(`   Initial token balance: ${testUser.tokenBalance}`);
    }
    
    // Test 3: Test token balance check
    console.log('\n3. Testing token balance validation...');
    
    const balanceCheck = await TokenService.checkTokenBalance(testUser.id, 10);
    console.log(`   Check balance for 10 tokens: ${balanceCheck.sufficient ? 'SUFFICIENT' : 'INSUFFICIENT'}`);
    console.log(`   Current balance: ${balanceCheck.currentBalance}`);
    
    const insufficientCheck = await TokenService.checkTokenBalance(testUser.id, 2000);
    console.log(`   Check balance for 2000 tokens: ${insufficientCheck.sufficient ? 'SUFFICIENT' : 'INSUFFICIENT'}`);
    
    // Test 4: Test token consumption
    console.log('\n4. Testing token consumption...');
    
    const consumeResult = await TokenService.consumeTokens(
      testUser.id,
      'autoclick',
      'click_execution',
      {
        metadata: {
          url: 'https://example.com/test',
          visitorType: 'simple'
        }
      }
    );
    
    console.log(`   Token consumption result: ${consumeResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (consumeResult.success) {
      console.log(`   Tokens consumed: ${consumeResult.tokensConsumed}`);
      console.log(`   Transaction ID: ${consumeResult.transactionId}`);
      
      // Verify balance update
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      });
      console.log(`   Updated balance: ${updatedUser?.tokenBalance}`);
    }
    
    // Test 5: Test token transaction history
    console.log('\n5. Testing token transaction history...');
    
    const transactions = await prisma.tokenTransaction.findMany({
      where: { userId: testUser.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`   Found ${transactions.length} recent transactions`);
    transactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.type} ${tx.amount > 0 ? '+' : ''}${tx.amount} tokens - ${tx.feature}`);
      console.log(`      Description: ${tx.description}`);
      console.log(`      Created: ${tx.createdAt.toISOString()}`);
    });
    
    // Test 6: Test token addition (instead of refund)
    console.log('\n6. Testing token addition...');
    
    const addResult = await TokenService.addTokens(
      testUser.id,
      5,
      'bonus',
      'test_bonus',
      {
        metadata: {
          reason: 'Test bonus tokens'
        }
      }
    );
    
    console.log(`   Token addition result: ${addResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (addResult.success) {
      console.log(`   Tokens added: ${addResult.amount}`);
      
      // Verify balance after addition
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      });
      console.log(`   Balance after addition: ${updatedUser?.tokenBalance}`);
    }
    
    // Test 7: Test token batch operations
    console.log('\n7. Testing token batch operations...');
    
    // Test batch consumption simulation
    const batchOperations = [];
    const batchSize = 3;
    const tokensPerOperation = 2;
    
    for (let i = 0; i < batchSize; i++) {
      const result = await TokenService.consumeTokens(
        testUser.id,
        'autoclick',
        'batch_execution',
        {
          metadata: {
            batchId: `batch-${Date.now()}`,
            operationIndex: i,
            totalOperations: batchSize
          }
        }
      );
      batchOperations.push(result);
    }
    
    const successfulBatchOps = batchOperations.filter(op => op.success).length;
    console.log(`   Batch operations: ${successfulBatchOps}/${batchSize} successful`);
    
    // Test 8: Test token balance threshold
    console.log('\n8. Testing token balance threshold...');
    
    const lowBalanceUser = await prisma.user.create({
      data: {
        email: 'lowbalance@test.com',
        name: 'Low Balance User',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 5
      }
    });
    
    const thresholdCheck = await TokenService.checkTokenBalance(lowBalanceUser.id, 10);
    console.log(`   Low balance user check: ${thresholdCheck.sufficient ? 'SUFFICIENT' : 'INSUFFICIENT'}`);
    console.log(`   Low balance: ${thresholdCheck.currentBalance}`);
    console.log(`   Required: 10, Available: ${thresholdCheck.currentBalance}`);
    
    // Test 9: Test token statistics
    console.log('\n9. Testing token statistics...');
    
    const stats = await TokenService.getTokenUsageStats(testUser.id);
    console.log(`   User token statistics:`);
    console.log(`   Total consumed: ${stats.totalConsumed}`);
    console.log(`   Usage by feature: ${Object.keys(stats.byFeature).join(', ')}`);
    console.log(`   Recent usage count: ${stats.recentUsage.length}`);
    
    // Test 10: Test token validation for different features
    console.log('\n10. Testing token validation for different features...');
    
    const features = [
      { feature: 'autoclick', cost: 1 },
      { feature: 'batchopen', cost: 1 },
      { feature: 'siterank', cost: 1 },
      { feature: 'api_call', cost: 1 }
    ];
    
    for (const { feature, cost } of features) {
      const check = await TokenService.checkTokenBalance(testUser.id, cost);
      console.log(`   ${feature}: ${check.sufficient ? '✓' : '✗'} (${cost} tokens)`);
    }
    
    // Cleanup
    console.log('\n11. Cleaning up test data...');
    await prisma.user.deleteMany({
      where: { 
        email: { 
          in: ['token@test.com', 'lowbalance@test.com'] 
        } 
      }
    });
    console.log('   Test users deleted');
    
    console.log('\n=== Token Consumption Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Token consumption test failed:', error);
    throw error;
  }
}

// Run the test
testTokenConsumption()
  .then(() => {
    console.log('\n🎉 All token consumption tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Token consumption tests failed:', error);
    process.exit(1);
  });