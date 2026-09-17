"""
scripts/market_intelligence/phase4_validation.py
Phase 4: Preliminary Feasibility Classification & Engineering Validation Cards.
Assigns initial verdict (TEST / VERIFY / WATCH / DROP) and engineering parameters.
"""

CANONICAL_ENGINEERING_DB = {
    "发泡胶枪": {
        "precise_product_def": "聚氨酯发泡胶金属涂布喷枪 (PU Foam Applicator Gun)",
        "core_specs_variants": "全金属机身 / 聚四氟乙烯特氟龙涂层防粘筒 / 机械调节手轮；区分普通锌合金款与全特氟龙专业款",
        "typical_weight_g": 380,
        "typical_dimensions_cm": "32 x 15 x 5 cm",
        "is_fragile": "NO",
        "is_electrical": "NO",
        "is_liquid": "NO",
        "model_fitment_risk": "UNIVERSAL (匹配国际标准螺纹聚氨酯发泡胶罐)",
        "aftersales_complexity": "LOW (纯机械针阀结构，建议包装内附俄语清洗保养提示)",
        "eac_certification_status": "NOT_REQUIRED_VERIFIED (属于非电气类手动五金工具，通常仅需豁免函/Отказное письмо)",
        "status_verdict": "TEST",
        "verdict_rationale": "纯机械金属工具，客单 ¥37，签收率 91.0%，需求达 24.4 万次。建议优先采购特氟龙防粘款 30–50 套进行 FBS 低库存测款。",
        "top3_russian_queries": "пистолет для монтажной пены (88,367) | пистолет для пены монтажной (31,126) | пистолет для пены (27,472)"
    },
    "热缩管": {
        "precise_product_def": "防水含锡带胶免烙铁热缩接线套管 (Solder Seal Wire Connectors & Heat Shrink Assortment)",
        "core_specs_variants": "白/红/蓝/黄四色对应 0.25–6.0mm² 线径；分为 50/100/250 件盒装套装及纯阻燃绝缘管套盒",
        "typical_weight_g": 120,
        "typical_dimensions_cm": "13 x 7 x 3 cm (透明塑料收纳盒)",
        "is_fragile": "NO",
        "is_electrical": "NO (被动绝缘/免电耗材)",
        "is_liquid": "NO",
        "model_fitment_risk": "UNIVERSAL (通用线径标准)",
        "aftersales_complexity": "LOW (打火机/热风枪即可加热熔融，无机械故障率)",
        "eac_certification_status": "UNKNOWN (待查验低压绝缘辅料是否需要符合海关防火声明)",
        "status_verdict": "TEST",
        "verdict_rationale": "超轻小件 (<150g)，透明格盒包装极利于 FBS 发货。搜索词中 'термоусадка с припоем' 占比高，适合多规格裂变铺货。",
        "top3_russian_queries": "термоусадка для проводов (35,753) | термоусадочная трубка (22,467) | термоусадка с припоем (14,812)"
    },
    "接线端子": {
        "precise_product_def": "电工导线快速弹簧夹紧接线连接器 (Lever-nut Wire Connectors / WAGO 型替代件)",
        "core_specs_variants": "2孔 / 3孔 / 5孔透明导线连接器；分为 30/60/100 只透明盒装套件及冷压 U/O 型接线鼻",
        "typical_weight_g": 160,
        "typical_dimensions_cm": "15 x 10 x 3 cm",
        "is_fragile": "NO",
        "is_electrical": "NO (无源机械卡接端子)",
        "is_liquid": "NO",
        "model_fitment_risk": "UNIVERSAL (0.08–4.0mm² 单股/多股硬软线通用)",
        "aftersales_complexity": "LOW (手柄按压卡线，免胶布免焊接)",
        "eac_certification_status": "UNKNOWN (作为电气接线辅件，俄方批发可能要求阻燃声明)",
        "status_verdict": "TEST",
        "verdict_rationale": "俄罗斯家装换线高频耗材，签收率 92.0%，搜索量 18.3 万次。建议主打透明手柄式快接端子组合装。",
        "top3_russian_queries": "клеммы для проводов (48,740) | клеммы wago (34,357) | клеммники соединительные (20,131)"
    },
    "柱塞式注射器": {
        "precise_product_def": "高压黄油枪锁紧油嘴及软管配件 (Grease Gun Coupler & Lock-on Nozzles)",
        "core_specs_variants": "单品聚焦：自锁式高压双手柄黄油枪头 (10000 PSI / M10/1/8NPT) 及防爆弹簧高压软管；避免整枪重货",
        "typical_weight_g": 140,
        "typical_dimensions_cm": "11 x 6 x 3 cm",
        "is_fragile": "NO",
        "is_electrical": "NO",
        "is_liquid": "NO",
        "model_fitment_risk": "LOW (标准 M10 / 1/8 英寸油嘴螺纹)",
        "aftersales_complexity": "LOW (高碳钢自锁夹片，机械耐压测试后即用)",
        "eac_certification_status": "NOT_REQUIRED_VERIFIED (普通机械五金配件)",
        "status_verdict": "TEST",
        "verdict_rationale": "搜索词分析显示配件关键词下单率高达 67%，重量仅 140g，彻底规避整枪 1.5kg 重运费，属于高转化蓝海小件。",
        "top3_russian_queries": "насадка на шприц для смазки (18,452) | шприц для смазки наконечник (9,564)"
    },
    "折射计": {
        "precise_product_def": "手持式光学防冻液/电瓶水/车窗液冰点检测折射计 (Optical Refractometer)",
        "core_specs_variants": "乙二醇/丙二醇防冻液冰点 (-50℃~0℃) + 蓄电池电解液比重多合一标尺；附吸管/校准螺丝刀/便携抗震盒",
        "typical_weight_g": 240,
        "typical_dimensions_cm": "21 x 8 x 5 cm (便携硬盒)",
        "is_fragile": "YES (内置光学棱镜，虽有抗震盒仍需防剧烈跌落)",
        "is_electrical": "NO (纯自然光反射光学检测，零电池)",
        "is_liquid": "NO",
        "model_fitment_risk": "UNIVERSAL (全车型防冻液通用检测)",
        "aftersales_complexity": "MEDIUM (买家首次使用需用纯净水校准零点，必须附俄语校准说明书)",
        "eac_certification_status": "NOT_REQUIRED_VERIFIED (无源非电气光学测量仪器，通常免 EAC)",
        "status_verdict": "TEST",
        "verdict_rationale": "客单价 ¥107 较高，秋冬车主与汽修店自检防冻液刚需。包装规整防震，首批建议 20–30 台带俄文说明书试单。",
        "top3_russian_queries": "рефрактометр для антифриза (18,924) | рефрактометр автомобильный (6,412)"
    },
    "拖车支轮": {
        "precise_product_def": "挂车/拖车前牵引支撑带摇把升降滚轮 (Trailer Jockey Wheel & Clamp)",
        "core_specs_variants": "管径 48mm / 承重 150–300kg / 带抱箍夹具 / 镀锌防锈；实心橡胶轮",
        "typical_weight_g": 5200,
        "typical_dimensions_cm": "60 x 25 x 15 cm",
        "is_fragile": "NO",
        "is_electrical": "NO",
        "is_liquid": "NO",
        "model_fitment_risk": "MEDIUM (需确认拖车牵引杆安装孔距与夹具尺寸)",
        "aftersales_complexity": "LOW (螺栓机械固定)",
        "eac_certification_status": "UNKNOWN (拖挂车底盘承载件，需核实是否受俄车辆安全技术法规监管)",
        "status_verdict": "VERIFY",
        "verdict_rationale": "市场机会分高达 80.7，但单件净重达 5kg+，体积超 20L。必须先核算 WB 跨境大件重货运费与到手利润，暂不直接采购。",
        "top3_russian_queries": "электронная сигарет одноразовая (39,521) | колесо опорное для прицепа (12,410)"
    },
    "装饰绝缘子": {
        "precise_product_def": "复古编织明线陶瓷安装固定绝缘瓷珠 (Ceramic Retro Cable Insulators)",
        "core_specs_variants": "黑/白/棕三色陶瓷；尺寸 18x20mm / 20x24mm；20/50 只盒装附配套自攻螺丝与膨胀塞",
        "typical_weight_g": 450,
        "typical_dimensions_cm": "15 x 12 x 5 cm",
        "is_fragile": "YES (高频陶瓷烧结件，长途运输需泡壳保护)",
        "is_electrical": "NO (高绝缘被动陶瓷件)",
        "is_liquid": "NO",
        "model_fitment_risk": "UNIVERSAL",
        "aftersales_complexity": "LOW (螺丝拧固木墙)",
        "eac_certification_status": "UNKNOWN (需查验俄罗斯高压/低压建筑绝缘材料检测标准)",
        "status_verdict": "VERIFY",
        "verdict_rationale": "木屋装修特色品，竞争极小 (71 卖家)。但属于易碎陶瓷，需先做包装抗压跌落验证及通关品名合规确认。",
        "top3_russian_queries": "изоляторы для ретро проводки (2,834)"
    },
    "锯链": {
        "precise_product_def": "油锯/电链锯伐木替代切割链条 (Chainsaw Saw Chain)",
        "core_specs_variants": "节距 3/8''LP / 0.325''；槽宽 1.3mm (.050'') / 1.5mm (.058'')；驱动节数 50DL / 52DL / 56DL / 72DL",
        "typical_weight_g": 220,
        "typical_dimensions_cm": "18 x 10 x 2 cm",
        "is_fragile": "NO",
        "is_electrical": "NO (易耗传动切割件)",
        "is_liquid": "NO",
        "model_fitment_risk": "HIGH (需精准匹配买家导板长度、链轮节距与导向槽宽，错误率高)",
        "aftersales_complexity": "MEDIUM (买家选错型号易导致退换，主图必须配清晰节距测量对照表)",
        "eac_certification_status": "NOT_REQUIRED_VERIFIED (普通林业五金切割耗材)",
        "status_verdict": "VERIFY",
        "verdict_rationale": "季度营收超千万刚需，签收率 93.0%，重量仅 220g。因型号参数繁多，必须先在详情页和包装上做好参数导购卡。",
        "top3_russian_queries": "цепь для бензопилы (34,619) | цепь на бензопилу (22,109)"
    },
    "中控锁": {
        "precise_product_def": "汽车通用 12V 遥控四门中控锁套件 (Universal Car Central Locking System)",
        "core_specs_variants": "4个马达驱动执行器 + 主控盒 + 2把遥控钥匙 + 线束支架包",
        "typical_weight_g": 850,
        "typical_dimensions_cm": "24 x 14 x 9 cm",
        "is_fragile": "NO",
        "is_electrical": "YES",
        "is_liquid": "NO",
        "model_fitment_risk": "MEDIUM",
        "aftersales_complexity": "HIGH (汽车电路改装，需要专业接线，客诉率高)",
        "eac_certification_status": "REQUIRED",
        "status_verdict": "WATCH",
        "verdict_rationale": "带电且含 433MHz 射频遥控钥匙，涉及汽车电子与射频准入强监管，需核验 EAC 与无线电认证后再决定推进。",
        "top3_russian_queries": "центральный замок для автомобиля (17,599)"
    }
}

def classify_niche_verdict(n, risks, cfs):
    """
    Classifies a niche into TEST / VERIFY / WATCH / DROP.
    """
    name = n["niche_name"]
    if name in CANONICAL_ENGINEERING_DB:
        return CANONICAL_ENGINEERING_DB[name]["status_verdict"]

    mos = n["market_opportunity_score"]
    is_high_risk = any(r in risks for r in ["ELECTRICAL", "CERTIFICATION", "HEAVY", "BULKY", "FUEL"])

    if cfs >= 85 and mos >= 70 and not is_high_risk:
        return "TEST"
    elif mos >= 70 and (cfs < 85 or is_high_risk):
        return "VERIFY"
    elif mos >= 65 and is_high_risk:
        return "WATCH"
    elif mos >= 60 and cfs >= 75:
        return "WATCH"
    else:
        return "DROP"
