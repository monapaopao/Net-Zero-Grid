# =====================================================================
# 截图互差校验 —— 证明"每一张确实拍到了不同的状态"
#
#   <ppt-master venv>/python.exe tests/shots-diff.py                 默认 1920x1080 / after
#   <ppt-master venv>/python.exe tests/shots-diff.py --prefix after1366
#
# 为什么需要它：截图运行器只能核对页面自报的状态字段，核不到"画面里
# 真的变了"。本脚本逐张与同批 default 图做像素差分，低于该张声明的最小
# 差值即判失败。曾有一次 12 张里 9 张逐像素相同（meanDiff ≈ 0.01），
# 当时只靠人眼看 PNG 名单，没发现。
# =====================================================================
import argparse, json, os, sys
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'screenshots')

ap = argparse.ArgumentParser()
ap.add_argument('--prefix', default='after')
ap.add_argument('--base', default='default')
ap.add_argument('--json', default=None)
a = ap.parse_args()

# 每张声明"相对 default 至少要有多少比例的像素发生变化"，单位 %。
# 依据：光照切换/画质切换/抽屉开合/镜头切换都是全局性变化（≥5%），
# 只有 reduce-motion 是纯状态位（画面本就静止，几乎不变），单独列。
MIN_PCT = {
    'day-lab': 20.0,
    'night': 20.0,
    'sim-night': 20.0,
    'hydrogen-closeup': 20.0,
    'focus-datacenter': 20.0,
    'focus-with-drawer': 20.0,
    'drawer-ledger': 5.0,
    'drawer-devices': 5.0,
    'drawer-policy': 5.0,
    'tour-chapter3': 0.3,
    'quality-standard': 20.0,
    'quality-high-bloom': 20.0,
    'trend-panel': 2.0,
    'reduce-motion': 0.0,   # 静态画面下与 default 本就可以逐像素一致
}

base_path = os.path.join(SHOTS, f'{a.prefix}-{a.base}.png')
if not os.path.exists(base_path):
    print(f'缺基准图 {base_path}'); sys.exit(2)
base = np.asarray(Image.open(base_path).convert('RGB')).astype(np.int16)

rows, fails = [], 0
for name, minpct in MIN_PCT.items():
    p = os.path.join(SHOTS, f'{a.prefix}-{name}.png')
    if not os.path.exists(p):
        rows.append({'name': name, 'ok': False, 'why': '缺图'}); fails += 1; continue
    img = np.asarray(Image.open(p).convert('RGB')).astype(np.int16)
    if img.shape != base.shape:
        rows.append({'name': name, 'ok': False,
                     'why': f'尺寸不一致 {img.shape[1]}x{img.shape[0]} vs {base.shape[1]}x{base.shape[0]}'})
        fails += 1; continue
    d = np.abs(img - base).max(axis=2)
    pct = float((d > 8).mean() * 100)
    ok = pct >= minpct
    if not ok: fails += 1
    rows.append({'name': name, 'ok': ok, 'pct': round(pct, 2),
                 'minPct': minpct, 'meanDiff': round(float(np.abs(img - base).mean()), 3)})

w = max(len(r['name']) for r in rows)
print(f'基准：{os.path.relpath(base_path, ROOT)}')
for r in rows:
    if r['ok']:
        print(f"  ✓ {r['name']:<{w}}  变化 {r['pct']:6.2f}%  ≥ {r['minPct']:5.1f}%   meanDiff {r['meanDiff']:7.3f}")
    else:
        print(f"  ✗ {r['name']:<{w}}  {r.get('why') or ('变化 %s%% < %s%%' % (r['pct'], r['minPct']))}")
print(f"\n互差校验：{len(rows) - fails}/{len(rows)} 张通过（阈值见 tests/shots-diff.py 的 MIN_PCT）")

out = a.json or os.path.join(SHOTS, f'_diff-{a.prefix}.json')
with open(out, 'w', encoding='utf-8') as f:
    json.dump({'prefix': a.prefix, 'base': a.base, 'rows': rows,
               'pass': len(rows) - fails, 'total': len(rows)}, f, ensure_ascii=False, indent=2)
print('结果文件：' + os.path.relpath(out, ROOT))
sys.exit(1 if fails else 0)
