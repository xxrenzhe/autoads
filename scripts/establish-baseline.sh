#!/bin/bash

# 基线指标建立脚本
# 用于收集架构简化前的系统性能数据

echo "🔍 建立系统基线指标..."
echo "时间: $(date)"
echo "=========================="

# 创建基线数据目录
BASELINE_DIR="./baseline-data"
mkdir -p "$BASELINE_DIR"

# 1. 代码统计
echo "📊 1. 代码统计..."
echo "--- 代码统计 ---" > "$BASELINE_DIR/code-stats.txt"

# 统计文件数量
echo "文件总数: $(find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | wc -l)" >> "$BASELINE_DIR/code-stats.txt"

# 按模块统计
echo -e "\n按模块统计:" >> "$BASELINE_DIR/code-stats.txt"
echo "SiteRank: $(find src/modules/siterank -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l) 个文件" >> "$BASELINE_DIR/code-stats.txt"
echo "BatchOpen: $(find src/modules/batchopen -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l) 个文件" >> "$BASELINE_DIR/code-stats.txt"
echo "ChangeLink: $(find src/modules/changelink -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l) 个文件" >> "$BASELINE_DIR/code-stats.txt"
echo "Admin系统: $(find src/admin -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l) 个文件" >> "$BASELINE_DIR/code-stats.txt"
echo "App Admin: $(find src/app/admin -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l) 个文件" >> "$BASELINE_DIR/code-stats.txt"

# 统计代码行数
echo -e "\n代码行数:" >> "$BASELINE_DIR/code-stats.txt"
echo "总行数: $(find src -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')" >> "$BASELINE_DIR/code-stats.txt"

# API路由统计
echo -e "\nAPI路由统计:" >> "$BASELINE_DIR/code-stats.txt"
echo "总API路由: $(find src/app/api -name "route.ts" | wc -l)" >> "$BASELINE_DIR/code-stats.txt"
echo "Admin API: $(find src/app/api/admin -name "route.ts" | wc -l)" >> "$BASELINE_DIR/code-stats.txt"

# 2. 依赖分析
echo -e "\n📦 2. 依赖分析..."
echo "--- 依赖分析 ---" > "$BASELINE_DIR/dependencies.txt"

# 统计package.json中的依赖
echo "生产依赖:" >> "$BASELINE_DIR/dependencies.txt"
npm list --depth=0 --prod >> "$BASELINE_DIR/dependencies.txt" 2>/dev/null

echo -e "\n开发依赖:" >> "$BASELINE_DIR/dependencies.txt"
npm list --depth=0 --dev >> "$BASELINE_DIR/dependencies.txt" 2>/dev/null

# 3. Bundle大小分析
echo -e "\n📦 3. Bundle大小分析..."
echo "--- Bundle大小 ---" > "$BASELINE_DIR/bundle-size.txt"

# 如果有.next目录，分析实际bundle
if [ -d ".next" ]; then
    echo "Next.js Build Size:" >> "$BASELINE_DIR/bundle-size.txt"
    du -sh .next/static >> "$BASELINE_DIR/bundle-size.txt" 2>/dev/null
    find .next/static -name "*.js" -exec du -sh {} \; | sort -hr | head -10 >> "$BASELINE_DIR/bundle-size.txt" 2>/dev/null
fi

# 4. 性能测试
echo -e "\n⚡ 4. 性能测试..."
echo "--- 性能测试 ---" > "$BASELINE_DIR/performance.txt"

# 启动服务器（如果未运行）
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "启动开发服务器..."
    npm run dev > /dev/null 2>&1 &
    SERVER_PID=$!
    sleep 10
fi

# 测试API响应时间
echo -e "\nAPI响应时间测试:" >> "$BASELINE_DIR/performance.txt"
for endpoint in "/api/health" "/api/health/database" "/api/admin/dashboard/stats"; do
    echo "测试 $endpoint:" >> "$BASELINE_DIR/performance.txt"
    curl -w "时间: %{time_total}s\n" -s http://localhost:3000$endpoint -o /dev/null >> "$BASELINE_DIR/performance.txt" 2>/dev/null
done

# 内存使用情况
echo -e "\n内存使用:" >> "$BASELINE_DIR/performance.txt"
if [ "$SERVER_PID" ]; then
    ps -p $SERVER_PID -o pid,rss,vsz,pmem >> "$BASELINE_DIR/performance.txt" 2>/dev/null
fi

# 5. 构建性能
echo -e "\n🔨 5. 构建性能..."
echo "--- 构建性能 ---" > "$BASELINE_DIR/build.txt"

echo "开始构建测试..."
time npm run build >> "$BASELINE_DIR/build.txt" 2>&1

echo "构建完成时间:" >> "$BASELINE_DIR/build.txt"
date >> "$BASELINE_DIR/build.txt"

# 6. 类型检查和linting
echo -e "\n🔍 6. 代码质量检查..."
echo "--- 代码质量 ---" > "$BASELINE_DIR/quality.txt"

echo "TypeScript错误数量:" >> "$BASELINE_DIR/quality.txt"
npm run type-check 2>&1 | grep -c "error" >> "$BASELINE_DIR/quality.txt" 2>/dev/null || echo "0" >> "$BASELINE_DIR/quality.txt"

echo "ESLint警告数量:" >> "$BASELINE_DIR/quality.txt"
npm run lint 2>&1 | grep -c "Warning" >> "$BASELINE_DIR/quality.txt" 2>/dev/null || echo "0" >> "$BASELINE_DIR/quality.txt"

# 7. 数据库查询分析（如果配置了）
echo -e "\n💾 7. 数据库分析..."
echo "--- 数据库分析 ---" > "$BASELINE_DIR/database.txt"

# 如果有Prisma，分析schema
if [ -f "prisma/schema.prisma" ]; then
    echo "模型数量: $(grep -c "^model" prisma/schema.prisma)" >> "$BASELINE_DIR/database.txt"
    echo "字段总数: $(grep -c " [A-Z]" prisma/schema.prisma)" >> "$BASELINE_DIR/database.txt"
fi

# 8. 清理进程
if [ "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null
fi

# 9. 生成报告
echo -e "\n📋 生成基线报告..."
REPORT_FILE="$BASELINE_DIR/baseline-report-$(date +%Y%m%d-%H%M%S).md"

cat > "$REPORT_FILE" << EOF
# ChangeLink 系统基线报告

**生成时间**: $(date)
**Git版本**: $(git rev-parse HEAD)

## 📊 代码统计

$(cat "$BASELINE_DIR/code-stats.txt")

## 📦 依赖分析

$(cat "$BASELINE_DIR/dependencies.txt")

## 📦 Bundle大小

$(cat "$BASELINE_DIR/bundle-size.txt")

## ⚡ 性能测试

$(cat "$BASELINE_DIR/performance.txt")

## 🔨 构建性能

$(cat "$BASELINE_DIR/build.txt")

## 🔍 代码质量

$(cat "$BASELINE_DIR/quality.txt")

## 💾 数据库分析

$(cat "$BASELINE_DIR/database.txt")

## 🎯 重构目标

基于当前基线，重构目标：

1. **代码简化**
   - 文件数量减少65%: $(find src -name "*.ts" -o -name "*.tsx" | wc -l | awk '{print $1*0.35}') 个文件
   - 代码行数减少60%: $(find src -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1*0.4}') 行

2. **API简化**
   - API路由减少76%: $(find src/app/api -name "route.ts" | wc -l | awk '{print $1*0.24}') 个路由
   - Admin API减少76%: $(find src/app/api/admin -name "route.ts" | wc -l | awk '{print $1*0.24}') 个路由

3. **性能提升**
   - 启动时间减少60%
   - 内存使用降低50%
   - 构建时间缩短65%

4. **维护性**
   - 删除重复代码
   - 简化架构层次
   - 提高代码可读性

---

*此报告将作为架构简化前的基线参考*
EOF

echo "✅ 基线指标建立完成！"
echo "📄 报告文件: $REPORT_FILE"
echo "📁 数据目录: $BASELINE_DIR"
echo ""
echo "📋 重要提醒:"
echo "1. 保存此报告作为重构前的参考"
echo "2. 重构完成后再次运行对比改进效果"
echo "3. 每个重构阶段后都应更新基线数据"
echo ""
echo "🚀 下一步: 开始第一阶段重构 - 激活React Admin系统"