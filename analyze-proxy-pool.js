// 分析IPRocket代理池
const proxyData = [
  // 第一次请求
  '139.162.143.133:5959',
  '139.162.174.182:5959',
  '139.162.174.182:5959', // 重复
  '172.104.149.95:5959',
  '172.104.135.179:5959',
  '172.104.135.179:5959', // 重复
  '139.162.188.51:5959',
  '172.105.92.9:5959',
  '57.129.96.94:5959',
  '139.162.191.122:5959',
  
  // 第二次请求
  '139.162.158.190:5959',
  '172.105.92.9:5959', // 重复
  '139.162.143.133:5959', // 重复
  '57.129.96.94:5959', // 重复
  '172.105.92.9:5959', // 重复
  '139.162.191.122:5959', // 重复
  '139.162.174.182:5959', // 重复
  '139.162.191.122:5959', // 重复
  '172.104.135.179:5959', // 重复
  '139.162.158.190:5959', // 重复
  
  // 第三次请求
  '139.162.174.182:5959', // 重复
  '139.162.143.133:5959', // 重复
  '139.162.143.133:5959', // 重复
  '172.104.249.27:5959',
  '172.104.249.27:5959', // 重复
  '139.162.188.51:5959', // 重复
  '139.162.143.133:5959', // 重复
  '172.104.149.95:5959', // 重复
  '172.105.92.9:5959', // 重复
  '139.162.143.133:5959'  // 重复
];

// 分析结果
const uniqueIps = new Set();
const ipCounts = {};
let totalProxies = 0;

proxyData.forEach(proxy => {
  const ip = proxy.split(':')[0];
  totalProxies++;
  uniqueIps.add(ip);
  ipCounts[ip] = (ipCounts[ip] || 0) + 1;
});

console.log('📊 IPRocket代理池分析结果');
console.log('='.repeat(50));
console.log(`总请求数: 3`);
console.log(`总代理数: ${totalProxies}`);
console.log(`唯一IP数: ${uniqueIps.size}`);
console.log(`重复率: ${((totalProxies - uniqueIps.size) / totalProxies * 100).toFixed(2)}%`);

console.log('\n🔍 所有唯一代理IP:');
Array.from(uniqueIps).forEach((ip, index) => {
  console.log(`${index + 1}. ${ip}`);
});

console.log('\n📈 每个IP的出现次数:');
Object.entries(ipCounts)
  .sort(([,a], [,b]) => b - a)
  .forEach(([ip, count]) => {
    console.log(`${ip}: ${count}次`);
  });

// 计算获取50个不重复IP需要的策略
console.log('\n💡 获取50个不重复代理IP的策略分析:');
console.log('======================================');

// 方案1: 使用多个IPRocket账户（如果允许）
console.log('\n1. 多账户策略:');
const accountsNeeded = Math.ceil(50 / uniqueIps.size);
console.log(`   - 需要约 ${accountsNeeded} 个IPRocket账户`);
console.log(`   - 每个账户提供 ${uniqueIps.size} 个唯一IP`);
console.log(`   - 总计可获取: ${accountsNeeded * uniqueIps.size} 个IP`);

// 方案2: 使用多个代理提供商
console.log('\n2. 多提供商策略:');
console.log(`   - 假设每个提供商有 ${uniqueIps.size} 个IP`);
console.log(`   - 需要 ${accountsNeeded} 个类似的提供商`);
console.log(`   - 推荐提供商: BrightData, Oxylabs, Smartproxy等`);

// 方案3: 结合时间间隔
console.log('\n3. 时间间隔策略:');
console.log('   - 等待更长时间（小时级别）可能获取新IP');
console.log('   - 适合非实时批量任务');
console.log('   - 不可靠，不推荐');

// 方案4: 降低需求
console.log('\n4. 降低需求策略:');
console.log(`   - 接受 ${uniqueIps.size} 个IP的限制`);
console.log('   - 实现智能轮换使用');
console.log('   - 添加代理质量检测和淘汰机制');

console.log('\n🎯 推荐方案:');
console.log('============');
console.log('1. 短期方案: 使用2-3个代理提供商的组合');
console.log('2. 长期方案: 自建代理池或使用企业级代理服务');
console.log('3. 优化方案: 实现代理质量评分系统，动态选择最佳代理');