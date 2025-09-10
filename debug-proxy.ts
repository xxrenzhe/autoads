/**
 * 调试代理响应格式
 */

async function debugProxyFormat() {
  console.log('调试代理响应格式...\n');
  
  const proxyUrl = 'https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt';
  
  try {
    console.log('正在获取代理...');
    const proxyResponse = await fetch(proxyUrl);
    const proxyText = await proxyResponse.text();
    
    console.log('原始响应:', JSON.stringify(proxyText));
    console.log('分割后的部分:', proxyText.trim().split(':'));
    
  } catch (error) {
    console.error('获取代理失败:', error);
  }
}

debugProxyFormat();