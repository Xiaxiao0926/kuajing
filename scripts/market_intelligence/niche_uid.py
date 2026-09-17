"""
scripts/market_intelligence/niche_uid.py
Stable Niche UID & Alias Management for Cross-Run State Inheritance
"""
import os
import json
import hashlib
from pathlib import Path

DEFAULT_ALIAS_FILE = Path(__file__).resolve().parent.parent.parent / "ozon-react" / "public" / "data" / "market_intelligence" / "niche_aliases.json"

def generate_niche_uid(platform: str, category: str, niche_name: str) -> str:
    """
    Generates a deterministic 12-char hex UID:
    e.g. wb_niche_8f3c2a91e502
    """
    plat = (platform or "wb").strip().lower()
    cat = (category or "").strip()
    name = (niche_name or "").strip()
    raw_str = f"{plat}::{cat}::{name}"
    digest = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()[:12]
    return f"{plat}_niche_{digest}"

def load_alias_registry(alias_file=None):
    """
    Loads alias registry mapping:
    Format:
    {
      "aliases": {
        "手动工具及配件::聚氨酯泡沫枪": "wb_niche_7b8a1c9e2f41",
        "手动工具及配件::泡沫填缝剂施工枪": "wb_niche_7b8a1c9e2f41"
      },
      "uid_map": {
        "wb_niche_7b8a1c9e2f41": {
          "canonical_name": "发泡胶枪",
          "category": "手动工具及配件",
          "aliases": ["聚氨酯泡沫枪", "泡沫填缝剂施工枪"]
        }
      }
    }
    """
    path = Path(alias_file or DEFAULT_ALIAS_FILE)
    if not path.exists():
        return {"aliases": {}, "uid_map": {}}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"aliases": {}, "uid_map": {}}

def save_alias_registry(registry, alias_file=None):
    path = Path(alias_file or DEFAULT_ALIAS_FILE)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_p = path.with_suffix(".tmp")
    with open(temp_p, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)
    os.replace(temp_p, path)

def resolve_niche_uid(platform: str, category: str, niche_name: str, alias_file=None):
    """
    Resolves a niche to its stable UID and canonical name.
    1. Checks alias registry for category::niche_name.
    2. Checks alias registry for global niche_name.
    3. If not found in aliases, computes deterministic UID.
    """
    plat = (platform or "wb").strip().lower()
    cat = (category or "").strip()
    name = (niche_name or "").strip()

    if isinstance(alias_file, dict):
        reg = alias_file
    else:
        reg = load_alias_registry(alias_file)
    aliases = reg.get("aliases", {})
    uid_map = reg.get("uid_map", {})

    key1 = f"{cat}::{name}"
    key2 = name

    matched_uid = aliases.get(key1) or aliases.get(key2)
    if matched_uid:
        canonical_info = uid_map.get(matched_uid, {})
        canonical_name = canonical_info.get("canonical_name", name)
        return matched_uid, canonical_name

    computed_uid = generate_niche_uid(plat, cat, name)
    return computed_uid, name

def register_niche_alias(uid_or_reg, alias_name: str = None, category: str = "", canonical_name: str = "", alias_file=None):
    """
    Registers an alias for a niche UID.
    Supports:
      register_niche_alias(uid, alias_name, category, canonical_name, alias_file)
      register_niche_alias(reg_dict, uid, alias_name, category, canonical_name)
    """
    if isinstance(uid_or_reg, dict):
        reg = uid_or_reg
        uid = alias_name
        # in this overload: (reg, uid, alias_name, category, canonical_name)
        # category might be passed as 4th param and canonical_name as 5th param
        real_alias = category
        real_cat = canonical_name
        real_canonical = alias_file or real_alias
        key = f"{real_cat.strip()}::{real_alias.strip()}" if real_cat else real_alias.strip()
        reg.setdefault("aliases", {})[key] = uid
        reg["aliases"][real_alias.strip()] = uid
        if "uid_map" not in reg:
            reg["uid_map"] = {}
        if uid not in reg["uid_map"]:
            reg["uid_map"][uid] = {
                "canonical_name": real_canonical,
                "category": real_cat,
                "aliases": []
            }
        if real_alias not in reg["uid_map"][uid].get("aliases", []):
            reg["uid_map"][uid]["aliases"].append(real_alias)
        return reg

    uid = uid_or_reg
    reg = load_alias_registry(alias_file)
    key = f"{category.strip()}::{alias_name.strip()}" if category else alias_name.strip()
    reg.setdefault("aliases", {})[key] = uid
    reg["aliases"][alias_name.strip()] = uid

    if "uid_map" not in reg:
        reg["uid_map"] = {}
    if uid not in reg["uid_map"]:
        reg["uid_map"][uid] = {
            "canonical_name": canonical_name,
            "category": category,
            "aliases": []
        }
    if alias_name not in reg["uid_map"][uid].get("aliases", []):
        reg["uid_map"][uid]["aliases"].append(alias_name)

    save_alias_registry(reg, alias_file)
    return reg
