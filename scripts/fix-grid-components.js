const fs = require('fs');
const path = require('path');

// 读取文件
const filePath = path.join(__dirname, 'src/admin/components/statistics/SimplifiedStatsDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 替换 Grid container
content = content.replace(
  /<Grid container([^>]*)>/g,
  '<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '$1' === ' spacing={3}' ? '24px' : '$1' === ' spacing={2}' ? '16px' : '8px'$1 }}>'
);

// 替换 Grid item
content = content.replace(
  /<Grid xs={(\d+)} md={(\d+)}([^>]*)>/g,
  '<Box sx={{ width: { xs: '100%', md: '$2%' }$3 }}>'
);

// 替换 Grid item with only xs
content = content.replace(
  /<Grid xs={(\d+)}([^>]*)>/g,
  '<Box sx={{ width: '100%'$2 }}>'
);

// 替换 </Grid>
content = content.replace(/<\/Grid>/g, '</Box>');

// 写回文件
fs.writeFileSync(filePath, content);

console.log('Grid components replaced with Box components');