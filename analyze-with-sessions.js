// 分析IPRocket代理池（考虑Session ID）
const proxyData = [
  // 第一次请求
  { ip: '139.162.143.133', port: '5959', sid: '94734628' },
  { ip: '139.162.174.182', port: '5959', sid: '7496112' },
  { ip: '139.162.174.182', port: '5959', sid: '74749357' }, // 相同IP，不同sid
  { ip: '172.104.149.95', port: '5959', sid: '49608666' },
  { ip: '172.104.135.179', port: '5959', sid: '82162281' },
  { ip: '172.104.135.179', port: '5959', sid: '50669109' }, // 相同IP，不同sid
  { ip: '139.162.188.51', port: '5959', sid: '8223715' },
  { ip: '172.105.92.9', port: '5959', sid: '82058681' },
  { ip: '57.129.96.94', port: '5959', sid: '73887735' },
  { ip: '139.162.191.122', port: '5959', sid: '66705350' },
  
  // 第二次请求
  { ip: '139.162.158.190', port: '5959', sid: '16654558' },
  { ip: '172.105.92.9', port: '5959', sid: '52728246' }, // 相同IP，不同sid
  { ip: '139.162.143.133', port: '5959', sid: '24507295' }, // 相同IP，不同sid
  { ip: '57.129.96.94', port: '5959', sid: '53653432' }, // 相同IP，不同sid
  { ip: '172.105.92.9', port: '5959', sid: '13833194' }, // 相同IP，不同sid
  { ip: '139.162.191.122', port: '5959', sid: '2859205' }, // 相同IP，不同sid
  { ip: '139.162.174.182', port: '5959', sid: '53577384' }, // 相同IP，不同sid
  { ip: '139.162.191.122', port: '5959', sid: '37172029' }, // 相同IP，不同sid
  { ip: '172.104.135.179', port: '5959', sid: '4152709' }, // 相同IP，不同sid
  { ip: '139.162.158.190', port: '5959', sid: '19786221' }, // 相同IP，不同sid
  
  // 第三次请求
  { ip: '139.162.174.182', port: '5959', sid: '31038840' }, // 相同IP，不同sid
  { ip: '139.162.143.133', port: '5959', sid: '96301583' }, // 相同IP，不同sid
  { ip: '139.162.143.133', port: '5959', sid: '19144637' }, // 相同IP，不同sid
  { ip: '172.104.249.27', port: '5959', sid: '72456553' },
  { ip: '172.104.249.27', port: '5959', sid: '63923315' }, // 相同IP，不同sid
  { ip: '139.162.188.51', port: '5959', sid: '92726100' }, // 相同IP，不同sid
  { ip: '139.162.143.133', port: '5959', sid: '18092428' }, // 相同IP，不同sid
  { ip: '172.104.149.95', port: '5959', sid: '96866207' }, // 相同IP，不同sid
  { ip: '172.105.92.9', port: '5959', sid: '38432680' }, // 相同IP，不同sid
  { ip: '139.162.143.133', port: '5959', sid: '14279073' }  // 相同IP，不同sid
];

// 分析结果
const uniqueIps = new Set();
const uniqueSessions = new Set();
const ipCounts = {};
const sessionCounts = {};
const ipSessionMap = {};

proxyData.forEach(proxy => {
  const ipKey = proxy.ip;
  const sessionKey = `${proxy.ip}:${proxy.sid}`;
  
  uniqueIps.add(ipKey);
  uniqueSessions.add(sessionKey);
  
  // 统计IP出现次数
  ipCounts[ipKey] = (ipCounts[ipKey] || 0) + 1;
  
  // 统计每个IP的Session数量
  if (!ipSessionMap[ipKey]) {
    ipSessionMap[ipKey] = new Set();
  }
  ipSessionMap[ipKey].add(proxy.sid);
});

console.log('📊 IPRocket代理池详细分析（考虑Session ID）');
console.log('='.repeat(60));
console.log(`总请求数: 3`);
console.log(`总代理数: ${proxyData.length}`);
console.log(`唯一IP数: ${uniqueIps.size}`);
console.log(`唯一会话数: ${uniqueSessions.size}`);
console.log(`每个IP平均会话数: ${(uniqueSessions.size / uniqueIps.size).toFixed(2)}`);
console.log(`实际可用代理数: ${uniqueSessions.size}（考虑Session ID）`);

console.log('\n🔍 所有唯一代理IP及其Session数量:');
Array.from(uniqueIps).forEach(ip => {
  const sessionCount = ipSessionMap[ip].size;
  console.log(`${ip}: ${sessionCount} 个Session`);
});

console.log('\n📈 每个IP的出现频率统计:');
Object.entries(ipCounts)
  .sort(([,a], [,b]) => b - a)
  .forEach(([ip, count]) => {
    console.log(`${ip}: ${count}次出现`);
  });

// 分析获取50个代理的实际策略
console.log('\n💡 修正后的获取50个代理策略分析:');
console.log('===================================');

// 计算每次请求平均能获得的唯一代理数
const avgUniquePerRequest = uniqueSessions.size / 3;
console.log(`\n每次请求平均获得: ${avgUniquePerRequest.toFixed(2)} 个唯一代理（考虑Session ID）`);

// 需要的请求数
const requestsNeeded = Math.ceil(50 / avgUniquePerRequest);
console.log(`获取50个代理需要约: ${requestsNeeded} 次请求`);

// 并发策略分析
console.log('\n🚀 并发请求策略分析:');
console.log('1. 保守策略 (并发3次，延迟1秒):');
console.log(`   - 预期获取: ${Math.round(avgUniquePerRequest * 3)} 个唯一代理`);
console.log(`   - 需要重复: ${Math.ceil(50 / (avgUniquePerRequest * 3))} 轮`);

console.log('\n2. 标准策略 (并发5次，延迟1秒):');
console.log(`   - 预期获取: ${Math.round(avgUniquePerRequest * 5)} 个唯一代理`);
console.log(`   - 需要重复: ${Math.ceil(50 / (avgUniquePerRequest * 5))} 轮`);

console.log('\n3. 激进策略 (并发10次，延迟200ms):');
console.log(`   - 预期获取: ${Math.round(avgUniquePerRequest * 10)} 个唯一代理`);
console.log(`   - 需要重复: ${Math.ceil(50 / (avgUniquePerRequest * 10))} 轮`);

// 实际建议
console.log('\n🎯 修正后的实际建议:');
console.log('===================');
console.log('1. **关键发现**: IPRocket使用Session ID区分相同IP的不同连接');
console.log('2. **去重策略**: 应基于 IP:Port:SessionID 而非仅IP');
console.log('3. **并发请求**: 有效！每次请求都能获得新的Session');
console.log('4. **最优配置**: 并发5-10次，每次10个IP');
console.log('5. **预期结果**: 单轮可获得25-50个唯一代理连接');

console.log('\n📝 实施建议:');
console.log('- 修改去重逻辑，保留相同IP的不同Session');
console.log('- 实现并发请求机制');
console.log('- 添加Session ID到代理对象中');
console.log('- 考虑Session的生命周期管理');