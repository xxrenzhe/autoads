// 分析IPRocket代理池（完整格式 host:port:username:password）
const proxyData = [
  // 第一次请求
  '139.162.143.133:5959:com49692430-res-ROW-sid-94734628:ApL72Exh03L0tgTLcb12',
  '139.162.174.182:5959:com49692430-res-ROW-sid-7496112:ApL72Exh03L0tgTLcb12',
  '139.162.174.182:5959:com49692430-res-ROW-sid-74749357:ApL72Exh03L0tgTLcb12',
  '172.104.149.95:5959:com49692430-res-ROW-sid-49608666:ApL72Exh03L0tgTLcb12',
  '172.104.135.179:5959:com49692430-res-ROW-sid-82162281:ApL72Exh03L0tgTLcb12',
  '172.104.135.179:5959:com49692430-res-ROW-sid-50669109:ApL72Exh03L0tgTLcb12',
  '139.162.188.51:5959:com49692430-res-ROW-sid-8223715:ApL72Exh03L0tgTLcb12',
  '172.105.92.9:5959:com49692430-res-ROW-sid-82058681:ApL72Exh03L0tgTLcb12',
  '57.129.96.94:5959:com49692430-res-ROW-sid-73887735:ApL72Exh03L0tgTLcb12',
  '139.162.191.122:5959:com49692430-res-ROW-sid-66705350:ApL72Exh03L0tgTLcb12',
  
  // 第二次请求
  '139.162.158.190:5959:com49692430-res-ROW-sid-16654558:ApL72Exh03L0tgTLcb12',
  '172.105.92.9:5959:com49692430-res-ROW-sid-52728246:ApL72Exh03L0tgTLcb12',
  '139.162.143.133:5959:com49692430-res-ROW-sid-24507295:ApL72Exh03L0tgTLcb12',
  '57.129.96.94:5959:com49692430-res-ROW-sid-53653432:ApL72Exh03L0tgTLcb12',
  '172.105.92.9:5959:com49692430-res-ROW-sid-13833194:ApL72Exh03L0tgTLcb12',
  '139.162.191.122:5959:com49692430-res-ROW-sid-2859205:ApL72Exh03L0tgTLcb12',
  '139.162.174.182:5959:com49692430-res-ROW-sid-53577384:ApL72Exh03L0tgTLcb12',
  '139.162.191.122:5959:com49692430-res-ROW-sid-37172029:ApL72Exh03L0tgTLcb12',
  '172.104.135.179:5959:com49692430-res-ROW-sid-4152709:ApL72Exh03L0tgTLcb12',
  '139.162.158.190:5959:com49692430-res-ROW-sid-19786221:ApL72Exh03L0tgTLcb12',
  
  // 第三次请求
  '139.162.174.182:5959:com49692430-res-ROW-sid-31038840:ApL72Exh03L0tgTLcb12',
  '139.162.143.133:5959:com49692430-res-ROW-sid-96301583:ApL72Exh03L0tgTLcb12',
  '139.162.143.133:5959:com49692430-res-ROW-sid-19144637:ApL72Exh03L0tgTLcb12',
  '172.104.249.27:5959:com49692430-res-ROW-sid-72456553:ApL72Exh03L0tgTLcb12',
  '172.104.249.27:5959:com49692430-res-ROW-sid-63923315:ApL72Exh03L0tgTLcb12',
  '139.162.188.51:5959:com49692430-res-ROW-sid-92726100:ApL72Exh03L0tgTLcb12',
  '139.162.143.133:5959:com49692430-res-ROW-sid-18092428:ApL72Exh03L0tgTLcb12',
  '172.104.149.95:5959:com49692430-res-ROW-sid-96866207:ApL72Exh03L0tgTLcb12',
  '172.105.92.9:5959:com49692430-res-ROW-sid-38432680:ApL72Exh03L0tgTLcb12',
  '139.162.143.133:5959:com49692430-res-ROW-sid-14279073:ApL72Exh03L0tgTLcb12'
];

// 解析代理字符串
function parseProxy(proxyString) {
  const [host, port, username, password] = proxyString.split(':');
  
  // 从username中提取sid
  const sidMatch = username.match(/sid-(\d+)/);
  const sid = sidMatch ? sidMatch[1] : null;
  
  return {
    full: proxyString,
    host,
    port,
    username,
    password,
    sid,
    // 唯一标识符
    uniqueKey: `${host}:${port}:${sid}`
  };
}

// 分析结果
const parsedProxies = proxyData.map(parseProxy);
const uniqueHosts = new Set();
const uniqueConnections = new Set();
const hostCounts = {};
const hostSessionMap = {};

parsedProxies.forEach(proxy => {
  uniqueHosts.add(proxy.host);
  uniqueConnections.add(proxy.uniqueKey);
  
  // 统计每个host的出现次数
  hostCounts[proxy.host] = (hostCounts[proxy.host] || 0) + 1;
  
  // 统计每个host的session数量
  if (!hostSessionMap[proxy.host]) {
    hostSessionMap[proxy.host] = new Set();
  }
  hostSessionMap[proxy.host].add(proxy.sid);
});

console.log('📊 IPRocket代理池完整分析');
console.log('='.repeat(50));
console.log(`总请求数: 3`);
console.log(`总代理数: ${proxyData.length}`);
console.log(`唯一Host数: ${uniqueHosts.size}`);
console.log(`唯一连接数: ${uniqueConnections.size}`);
console.log(`每个Host平均Session数: ${(uniqueConnections.size / uniqueHosts.size).toFixed(2)}`);

console.log('\n🔍 所有唯一Host及其Session数量:');
Array.from(uniqueHosts).sort().forEach(host => {
  const sessionCount = hostSessionMap[host].size;
  console.log(`${host}: ${sessionCount} 个Session`);
});

console.log('\n📈 每个Host的Session分布:');
Object.entries(hostSessionMap)
  .sort(([,a], [,b]) => b.size - a.size)
  .forEach(([host, sessions]) => {
    console.log(`${host}: ${sessions.size}个Session (${Array.from(sessions).join(', ')})`);
  });

// 生成完整的代理对象示例
console.log('\n💡 代理对象格式示例:');
console.log('='.repeat(50));
const example = parsedProxies[0];
console.log(JSON.stringify(example, null, 2));

// 策略分析
console.log('\n🚀 获取50个不重复代理的最优策略:');
console.log('='.repeat(50));

// 计算每次请求平均获取的唯一连接数
const avgUniquePerRequest = uniqueConnections.size / 3;
console.log(`\n每次请求平均获得: ${avgUniquePerRequest} 个唯一连接`);

// 不同并发策略的预期结果
const strategies = [
  { name: '保守策略', concurrency: 3, delay: 1000 },
  { name: '标准策略', concurrency: 5, delay: 1000 },
  { name: '激进策略', concurrency: 8, delay: 500 },
  { name: '极限策略', concurrency: 10, delay: 200 }
];

strategies.forEach(strategy => {
  const expectedUnique = Math.round(avgUniquePerRequest * strategy.concurrency);
  const roundsNeeded = Math.ceil(50 / expectedUnique);
  
  console.log(`\n${strategy.name} (并发${strategy.concurrency}次，延迟${strategy.delay}ms):`);
  console.log(`   - 预期单轮获取: ${expectedUnique} 个唯一连接`);
  console.log(`   - 需要轮数: ${roundsNeeded}`);
  console.log(`   - 预期总耗时: ${roundsNeeded * (strategy.delay + 3000)}ms`);
});

console.log('\n🎯 最终建议:');
console.log('============');
console.log('1. **使用标准策略**: 并发5次请求，每次10个IP');
console.log('   - 单轮可获得约50个唯一代理连接');
console.log('   - 总耗时约5秒');
console.log('');
console.log('2. **关键实现点**:');
console.log('   - 解析格式: host:port:username:password');
console.log('   - 唯一性判断: 基于 host:port:sid');
console.log('   - 并发请求: 使用Promise.all');
console.log('');
console.log('3. **代理使用格式**:');
console.log('   - HTTP代理: http://username:password@host:port');
console.log('   - 或者分别使用: host, port, username, password');

// 生成测试用的代理列表
console.log('\n📝 前10个完整的代理连接:');
parsedProxies.slice(0, 10).forEach((proxy, index) => {
  console.log(`${index + 1}. ${proxy.full}`);
  console.log(`   HTTP格式: http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`);
  console.log(`   唯一标识: ${proxy.uniqueKey}`);
  console.log('');
});