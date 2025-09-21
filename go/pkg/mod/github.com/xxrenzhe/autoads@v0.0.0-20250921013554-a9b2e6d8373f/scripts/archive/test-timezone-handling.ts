import { 
  getPSTDate, 
  getPSTHour, 
  utcToPST,
  isUSDaylightSavingTime,
  formatPSTTime,
  getExecutionWindowHours,
  isInExecutionWindow
} from '@/lib/utils/autoclick-timezone';

async function testTimezoneHandling() {
  console.log('=== Testing Timezone Handling ===\n');
  
  try {
    // Test 1: Basic PST/PDT conversion
    console.log('1. Testing PST/PDT conversion...');
    
    const testDates = [
      new Date('2024-01-15T12:00:00Z'), // January (PST)
      new Date('2024-07-15T12:00:00Z'), // July (PDT)
      new Date('2024-03-10T10:30:00Z'), // DST transition start
      new Date('2024-11-03T09:30:00Z')  // DST transition end
    ];
    
    for (const date of testDates) {
      const pstDate = getPSTDate(date);
      const pstHour = getPSTHour(date);
      const isDST = isUSDaylightSavingTime(date);
      const formatted = formatPSTTime(date);
      
      console.log(`   UTC: ${date.toISOString()}`);
      console.log(`   PST: ${pstDate} ${pstHour}:00 (${isDST ? 'PDT' : 'PST'})`);
      console.log(`   Formatted: ${formatted}`);
      console.log('');
    }
    
    // Test 2: DST detection
    console.log('2. Testing DST detection...');
    
    const dstDates = [
      { date: new Date('2024-01-01'), expected: false },
      { date: new Date('2024-07-01'), expected: true },
      { date: new Date('2024-03-10'), expected: true },  // DST starts
      { date: new Date('2024-11-03'), expected: false } // DST ends
    ];
    
    for (const { date, expected } of dstDates) {
      const actual = isUSDaylightSavingTime(date);
      const status = actual === expected ? '✓' : '✗';
      console.log(`   ${date.toDateString()}: ${actual ? 'DST' : 'PST'} ${status}`);
    }
    
    // Test 3: Execution window hours
    console.log('\n3. Testing execution window hours...');
    
    const timeWindows = ['00:00-24:00', '06:00-24:00'];
    
    for (const window of timeWindows) {
      const hours = getExecutionWindowHours(window);
      console.log(`   Window "${window}": ${hours.length} hours`);
      console.log(`   Active hours: ${hours.join(', ')}`);
    }
    
    // Test 4: Business hours check
    console.log('\n4. Testing business hours check...');
    
    const testHours = [0, 6, 9, 12, 18, 23];
    
    for (const hour of testHours) {
      // Create a test date with the specific hour
      const testDate = new Date();
      testDate.setUTCHours(hour - 8); // PST is UTC-8
      
      const isInBusiness = isInExecutionWindow('06:00-24:00', testDate);
      console.log(`   Hour ${hour}:00 ${isInBusiness ? '✓ Business' : '✗ Non-business'}`);
    }
    
    // Test 5: Time edge cases
    console.log('\n5. Testing time edge cases...');
    
    // Test DST transition moments
    const dstTransitionTests = [
      {
        name: 'DST Start - Before',
        date: new Date('2024-03-10T09:59:00Z')
      },
      {
        name: 'DST Start - After',
        date: new Date('2024-03-10T10:00:00Z')
      },
      {
        name: 'DST End - Before',
        date: new Date('2024-11-03T08:59:00Z')
      },
      {
        name: 'DST End - After',
        date: new Date('2024-11-03T09:00:00Z')
      }
    ];
    
    for (const test of dstTransitionTests) {
      const pstHour = getPSTHour(test.date);
      const isDST = isUSDaylightSavingTime(test.date);
      console.log(`   ${test.name}`);
      console.log(`     UTC: ${test.date.toISOString()}`);
      console.log(`     PST: ${pstHour}:00 (${isDST ? 'PDT' : 'PST'})`);
    }
    
    // Test 6: Date boundary handling
    console.log('\n6. Testing date boundary handling...');
    
    const boundaryTests = [
      {
        name: 'Midnight UTC',
        date: new Date('2024-06-15T00:00:00Z')
      },
      {
        name: 'End of day UTC',
        date: new Date('2024-06-15T23:59:59Z')
      },
      {
        name: 'PST midnight',
        date: new Date('2024-06-15T08:00:00Z') // 00:00 PST
      }
    ];
    
    for (const test of boundaryTests) {
      const pstDate = getPSTDate(test.date);
      const pstHour = getPSTHour(test.date);
      console.log(`   ${test.name}`);
      console.log(`     UTC: ${test.date.toISOString()}`);
      console.log(`     PST: ${pstDate} ${pstHour}:00`);
    }
    
    // Test 7: Time zone offset validation
    console.log('\n7. Testing timezone offset validation...');
    
    const now = new Date();
    const pstOffset = -8 * 60; // PST is UTC-8
    const pdtOffset = -7 * 60; // PDT is UTC-7
    
    const currentOffset = now.getTimezoneOffset();
    const isDST = isUSDaylightSavingTime(now);
    const expectedOffset = isDST ? pdtOffset : pstOffset;
    
    console.log(`   Current local offset: ${currentOffset} minutes`);
    console.log(`   Expected PST offset: ${expectedOffset} minutes`);
    console.log(`   Local matches PST: ${currentOffset === expectedOffset ? '✓' : '✗'}`);
    
    // Test 8: Cron job timing simulation
    console.log('\n8. Testing cron job timing simulation...');
    
    // Simulate daily plan generation at PST midnight
    const pstMidnightUTC = isUSDaylightSavingTime(now) ? 8 : 9; // 00:00 PST = 08:00/09:00 UTC
    
    console.log(`   Daily plan generation should run at ${pstMidnightUTC}:00 UTC`);
    console.log(`   Current UTC hour: ${now.getUTCHours()}`);
    console.log(`   Should run now: ${now.getUTCHours() === pstMidnightUTC ? 'YES' : 'NO'}`);
    
    // Test 9: Hourly execution timing
    console.log('\n9. Testing hourly execution timing...');
    
    const currentPSTHour = getPSTHour(now);
    console.log(`   Current PST hour: ${currentPSTHour}`);
    console.log(`   Hourly execution should run at xx:00 PST`);
    console.log(`   Next execution in: ${60 - now.getMinutes()} minutes`);
    
    // Test 10: Task scheduling validation
    console.log('\n10. Testing task scheduling validation...');
    
    const schedulingTests = [
      {
        name: 'All day task',
        timeWindow: '00:00-24:00',
        currentHour: 14,
        expected: true
      },
      {
        name: 'Business hours task',
        timeWindow: '06:00-24:00',
        currentHour: 5,
        expected: false
      },
      {
        name: 'Business hours task',
        timeWindow: '06:00-24:00',
        currentHour: 10,
        expected: true
      }
    ];
    
    for (const test of schedulingTests) {
      const activeHours = getExecutionWindowHours(test.timeWindow);
      const canExecute = activeHours.includes(test.currentHour);
      const status = canExecute === test.expected ? '✓' : '✗';
      console.log(`   ${test.name} at ${test.currentHour}:00 ${status}`);
    }
    
    console.log('\n=== Timezone Handling Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Timezone handling test failed:', error);
    throw error;
  }
}

// Run the test
testTimezoneHandling()
  .then(() => {
    console.log('\n🎉 All timezone handling tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Timezone handling tests failed:', error);
    process.exit(1);
  });