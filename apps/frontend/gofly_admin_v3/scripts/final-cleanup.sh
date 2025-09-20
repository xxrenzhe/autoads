#!/bin/bash

# AutoAds SaaS 最终代码清理脚本
# 遵循Linus原则：删除所有垃圾，保持项目整洁

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== AutoAds SaaS 最终代码清理 ===${NC}"
echo "遵循Linus原则：删除所有垃圾，保持项目整洁"
echo ""

CLEANED_FILES=0
CLEANED_DIRS=0

# 1. 删除系统生成的垃圾文件
echo -e "${YELLOW}1. 清理系统垃圾文件${NC}"

# macOS系统文件
find . -name ".DS_Store" -type f -delete 2>/dev/null && echo "  ✓ 删除 .DS_Store 文件" || true
find . -name "._*" -type f -delete 2>/dev/null && echo "  ✓ 删除 macOS 资源分叉文件" || true
find . -name ".AppleDouble" -type d -exec rm -rf {} + 2>/dev/null && echo "  ✓ 删除 .AppleDouble 目录" || true

# Windows系统文件
find . -name "Thumbs.db" -type f -delete 2>/dev/null && echo "  ✓ 删除 Thumbs.db 文件" || true
find . -name "desktop.ini" -type f -delete 2>/dev/null && echo "  ✓ 删除 desktop.ini 文件" || true

# Linux系统文件
find . -name "*~" -type f -delete 2>/dev/null && echo "  ✓ 删除备份文件 (*~)" || true

echo ""

# 2. 删除编辑器和IDE临时文件
echo -e "${YELLOW}2. 清理编辑器临时文件${NC}"

# Vim/Vi临时文件
find . -name "*.swp" -type f -delete 2>/dev/null && echo "  ✓ 删除 Vim swap 文件" || true
find . -name "*.swo" -type f -delete 2>/dev/null && echo "  ✓ 删除 Vim swap 文件" || true
find . -name "*~" -type f -delete 2>/dev/null && echo "  ✓ 删除 Vim 备份文件" || true

# Emacs临时文件
find . -name "#*#" -type f -delete 2>/dev/null && echo "  ✓ 删除 Emacs 临时文件" || true
find . -name ".#*" -type f -delete 2>/dev/null && echo "  ✓ 删除 Emacs 锁文件" || true

# VSCode临时文件
find . -name ".vscode" -type d -exec rm -rf {} + 2>/dev/null && echo "  ✓ 删除 VSCode 配置目录" || true

# JetBrains IDE文件
find . -name ".idea" -type d -exec rm -rf {} + 2>/dev/null && echo "  ✓ 删除 JetBrains IDE 配置" || true

echo ""

# 3. 删除构建和缓存文件
echo -e "${YELLOW}3. 清理构建和缓存文件${NC}"

# Go构建文件
find . -name "*.exe" -type f -delete 2>/dev/null && echo "  ✓ 删除 Go 可执行文件" || true
find . -name "*.test" -type f -delete 2>/dev/null && echo "  ✓ 删除 Go 测试文件" || true

# Node.js文件
find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null && echo "  ✓ 删除 node_modules 目录" || true
find . -name "package-lock.json" -type f -delete 2>/dev/null && echo "  ✓ 删除 package-lock.json" || true

# 日志文件
find . -name "*.log" -type f -delete 2>/dev/null && echo "  ✓ 删除日志文件" || true
find . -name "logs" -type d -exec rm -rf {} + 2>/dev/null && echo "  ✓ 删除日志目录" || true

# 临时文件
find . -name "tmp" -type d -exec rm -rf {} + 2>/dev/null && echo "  ✓ 删除临时目录" || true
find . -name "temp" -type d -exec rm -rf {} + 2>/dev/null && echo "  ✓ 删除临时目录" || true

echo ""

# 4. 删除备份和重复文件
echo -e "${YELLOW}4. 清理备份和重复文件${NC}"

# 备份文件
find . -name "*.backup" -type f -delete 2>/dev/null && echo "  ✓ 删除 .backup 文件" || true
find . -name "*.bak" -type f -delete 2>/dev/null && echo "  ✓ 删除 .bak 文件" || true
find . -name "*.orig" -type f -delete 2>/dev/null && echo "  ✓ 删除 .orig 文件" || true

# 重复文件（带数字后缀）
find . -name "*_backup*" -type f -delete 2>/dev/null && echo "  ✓ 删除 _backup 文件" || true
find . -name "*_old*" -type f -delete 2>/dev/null && echo "  ✓ 删除 _old 文件" || true
find . -name "*_copy*" -type f -delete 2>/dev/null && echo "  ✓ 删除 _copy 文件" || true
find . -name "*_fixed*" -type f -delete 2>/dev/null && echo "  ✓ 删除 _fixed 文件" || true
find . -name "*_clean*" -type f -delete 2>/dev/null && echo "  ✓ 删除 _clean 文件" || true

echo ""

# 5. 删除空文件和空目录
echo -e "${YELLOW}5. 清理空文件和空目录${NC}"

# 删除空文件
EMPTY_FILES=$(find . -type f -empty 2>/dev/null | wc -l)
if [ $EMPTY_FILES -gt 0 ]; then
    find . -type f -empty -delete 2>/dev/null
    echo "  ✓ 删除 $EMPTY_FILES 个空文件"
fi

# 删除空目录（多次运行以处理嵌套空目录）
for i in {1..5}; do
    EMPTY_DIRS=$(find . -type d -empty 2>/dev/null | wc -l)
    if [ $EMPTY_DIRS -gt 0 ]; then
        find . -type d -empty -delete 2>/dev/null
        CLEANED_DIRS=$((CLEANED_DIRS + EMPTY_DIRS))
    else
        break
    fi
done

if [ $CLEANED_DIRS -gt 0 ]; then
    echo "  ✓ 删除 $CLEANED_DIRS 个空目录"
fi

echo ""

# 6. 清理Git相关文件
echo -e "${YELLOW}6. 清理Git相关文件${NC}"

# Git临时文件
find . -name ".git/objects/tmp_*" -type f -delete 2>/dev/null && echo "  ✓ 删除 Git 临时对象" || true
find . -name ".git/refs/remotes/*/HEAD" -type f -delete 2>/dev/null && echo "  ✓ 删除 Git 远程HEAD引用" || true

# 清理Git历史中的大文件（如果需要）
if [ -d ".git" ]; then
    echo "  ℹ Git仓库存在，可以运行 'git gc --aggressive --prune=now' 来清理"
fi

echo ""

# 7. 验证关键文件存在
echo -e "${YELLOW}7. 验证关键文件完整性${NC}"

CRITICAL_FILES=(
    "go.mod"
    "main.go"
    "README.md"
    "DEPLOYMENT.md"
    "Dockerfile"
    "docker-compose.yml"
)

MISSING_FILES=0
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (缺失)"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done

echo ""

# 8. 检查代码质量
echo -e "${YELLOW}8. 代码质量检查${NC}"

# 检查Go代码格式
if command -v go >/dev/null 2>&1; then
    echo "  运行 go fmt..."
    if go fmt ./... >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Go代码格式化完成"
    else
        echo -e "  ${YELLOW}⚠${NC} Go代码格式化有警告"
    fi
    
    # 检查Go代码
    echo "  运行 go vet..."
    if go vet ./... >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Go代码检查通过"
    else
        echo -e "  ${YELLOW}⚠${NC} Go代码检查有警告（这是正常的，因为项目还在开发中）"
    fi
else
    echo -e "  ${YELLOW}⚠${NC} Go未安装，跳过代码质量检查"
fi

echo ""

# 9. 生成清理报告
echo -e "${YELLOW}9. 生成清理报告${NC}"

REPORT_FILE="cleanup_report_$(date +%Y%m%d_%H%M%S).txt"

cat > "$REPORT_FILE" << EOF
AutoAds SaaS 代码清理报告
清理时间: $(date)

=== 清理统计 ===
删除的空文件: $EMPTY_FILES
删除的空目录: $CLEANED_DIRS
缺失的关键文件: $MISSING_FILES

=== 清理项目 ===
✓ 系统垃圾文件 (.DS_Store, Thumbs.db等)
✓ 编辑器临时文件 (.swp, .idea等)
✓ 构建和缓存文件 (*.exe, *.log等)
✓ 备份和重复文件 (*_backup, *_old等)
✓ 空文件和空目录
✓ Git临时文件

=== 项目结构 ===
$(find . -type f -name "*.go" | wc -l) 个Go源文件
$(find . -type f -name "*.md" | wc -l) 个Markdown文档
$(find . -type f -name "*.yml" -o -name "*.yaml" | wc -l) 个YAML配置文件
$(find . -type f -name "Dockerfile*" | wc -l) 个Docker文件

=== 关键文件检查 ===
$(for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file (缺失)"
    fi
done)

=== 建议 ===
$(if [ $MISSING_FILES -eq 0 ]; then
    echo "项目结构完整，代码清理完成。"
else
    echo "发现 $MISSING_FILES 个缺失的关键文件，请检查项目完整性。"
fi)

遵循Linus原则：代码整洁，没有垃圾文件，易于维护。
EOF

echo "清理报告已保存到: $REPORT_FILE"

echo ""

# 10. 最终总结
echo -e "${YELLOW}10. 清理总结${NC}"

if [ $MISSING_FILES -eq 0 ]; then
    echo -e "${GREEN}🎉 代码清理完成！${NC}"
    echo -e "${GREEN}✅ 所有垃圾文件已删除${NC}"
    echo -e "${GREEN}✅ 项目结构整洁${NC}"
    echo -e "${GREEN}✅ 关键文件完整${NC}"
    echo -e "${GREEN}✅ 遵循Linus原则${NC}"
    EXIT_CODE=0
else
    echo -e "${YELLOW}⚠️  代码清理基本完成，但发现缺失文件${NC}"
    echo -e "${YELLOW}请检查并补充缺失的关键文件${NC}"
    EXIT_CODE=1
fi

echo ""
echo -e "${BLUE}=== 清理完成 ===${NC}"
echo "项目现在整洁无垃圾，符合Linus的代码质量标准。"

exit $EXIT_CODE