#!/usr/bin/env bash
# 打包 monitor 主题：release/mochi-theme.tar.gz
# hub 要求 theme.json 位于压缩包根目录（安装目录名取自 theme.json 的 short），
# 文档里 <short>/ 的结构描述的是安装后在磁盘上的布局，不是包内路径。
set -euo pipefail
cd "$(dirname "$0")/.."

SHORT="mochi"
rm -rf .theme release
mkdir -p ".theme/$SHORT" release

cp theme.json ".theme/$SHORT/"
[ -f preview.png ] && cp preview.png ".theme/$SHORT/"
cp -r dist ".theme/$SHORT/dist"

# 贴图等运行期资源已在 dist/assets 内（public/ 构建时并入）

cd ".theme/$SHORT"
ENTRIES=(theme.json dist)
[ -f preview.png ] && ENTRIES+=(preview.png)
tar -czf "../../release/$SHORT-theme.tar.gz" "${ENTRIES[@]}"
cd - >/dev/null

# 结构自检（先取完整列表再匹配，避免 grep -q 提前退出触发 SIGPIPE+pipefail 误判）
LISTING="$(tar -tzf "release/$SHORT-theme.tar.gz")"
echo "$LISTING" | grep -qx "theme\.json" || { echo "FAIL: theme.json 未在压缩包根目录"; exit 1; }
echo "$LISTING" | grep -qx "dist/index\.html" || { echo "FAIL: dist/index.html 缺失"; exit 1; }

echo "OK: release/$SHORT-theme.tar.gz"
echo "$LISTING" | head -8
