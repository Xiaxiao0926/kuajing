"""把 wb佣金.xlsx 转换为 JSON 供前端使用"""
import pandas as pd
import json
import os

src = r'd:\ozon\运费计算\wb佣金.xlsx'
dst = r'd:\ozon\ozon-react\public\data\wb_commission.json'

df = pd.read_excel(src)
df.columns = ['category', 'product', 'commission']

# 按类目分组
data = {}
for _, row in df.iterrows():
    cat = str(row['category']).strip()
    prod = str(row['product']).strip()
    try:
        rate = float(row['commission'])
    except (ValueError, TypeError):
        continue
    if cat not in data:
        data[cat] = []
    data[cat].append({'product': prod, 'commission': rate})

# 简化：类目列表 + 商品列表
categories = sorted(data.keys())
items = []
for cat, prods in data.items():
    for p in prods:
        items.append({'category': cat, 'product': p['product'], 'commission': p['commission']})

out = {
    'categories': categories,
    'items': items,
    'categoryCount': len(categories),
    'itemCount': len(items),
}

os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"已生成: {dst}")
print(f"类目数: {len(categories)}")
print(f"商品数: {len(items)}")
print(f"示例: {items[0]}")
