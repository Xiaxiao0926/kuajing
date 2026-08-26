// 自动生成 - 勿手改。来源: config/ozon_channels.json（唯一事实源）。
// 重新生成: node scripts/sync-config.js
export default {
  "source": "CEL产品资费表 V7.24.xlsx (OZON-rFBS sheet)",
  "source_date": "2026-08-26",
  "verified_by": "T2-Gate0-CEL-HK核验报告.md (HK规则沿用) + V7.24逐渠道提取核对(2026-08-26)",
  "groups": [
    {
      "group_id": "extra_small",
      "group_name": "Extra Small",
      "group_name_zh": "超级轻小件",
      "channels": [
        {
          "id": "express_xs",
          "name": "Express Extra Small",
          "speed": "5-10天",
          "kg_rate_cny": 50.5,
          "fixed_fee_cny": 3.37,
          "weight_max_kg": 0.5,
          "sum_max_cm": 90,
          "side_max_cm": 60,
          "price_max_rub": 1500,
          "volumetric": false
        },
        {
          "id": "standard_xs",
          "name": "Standard Extra Small",
          "speed": "10-15天",
          "kg_rate_cny": 39.3,
          "fixed_fee_cny": 3.37,
          "weight_max_kg": 0.5,
          "sum_max_cm": 90,
          "side_max_cm": 60,
          "price_max_rub": 1500,
          "volumetric": false
        },
        {
          "id": "economy_xs",
          "name": "Economy Extra Small",
          "speed": "15-25天",
          "kg_rate_cny": 28.1,
          "fixed_fee_cny": 3.37,
          "weight_max_kg": 0.5,
          "sum_max_cm": 90,
          "side_max_cm": 60,
          "price_max_rub": 1500,
          "volumetric": false
        }
      ]
    },
    {
      "group_id": "budget",
      "group_name": "Budget",
      "group_name_zh": "低客单价标准件",
      "channels": [
        {
          "id": "express_budget",
          "name": "Express Budget",
          "speed": "5-10天",
          "kg_rate_cny": 37.1,
          "fixed_fee_cny": 25.83,
          "weight_min_kg": 0.5,
          "weight_max_kg": 30,
          "sum_max_cm": 150,
          "side_max_cm": 60,
          "price_max_rub": 1500,
          "volumetric": false
        },
        {
          "id": "standard_budget",
          "name": "Standard Budget",
          "speed": "10-15天",
          "kg_rate_cny": 28.1,
          "fixed_fee_cny": 25.83,
          "weight_min_kg": 0.5,
          "weight_max_kg": 30,
          "sum_max_cm": 150,
          "side_max_cm": 60,
          "price_max_rub": 1500,
          "volumetric": false
        },
        {
          "id": "economy_budget",
          "name": "Economy Budget",
          "speed": "15-25天",
          "kg_rate_cny": 19.1,
          "fixed_fee_cny": 25.83,
          "weight_min_kg": 0.5,
          "weight_max_kg": 30,
          "sum_max_cm": 150,
          "side_max_cm": 60,
          "price_max_rub": 1500,
          "volumetric": false
        }
      ]
    },
    {
      "group_id": "small",
      "group_name": "Small",
      "group_name_zh": "小件",
      "channels": [
        {
          "id": "express_small",
          "name": "Express Small",
          "speed": "5-10天",
          "kg_rate_cny": 50.5,
          "fixed_fee_cny": 17.97,
          "weight_max_kg": 2,
          "sum_max_cm": 150,
          "side_max_cm": 60,
          "price_min_rub": 1501,
          "price_max_rub": 7000,
          "volumetric": false
        },
        {
          "id": "standard_small",
          "name": "Standard Small",
          "speed": "10-15天",
          "kg_rate_cny": 39.3,
          "fixed_fee_cny": 17.97,
          "weight_max_kg": 2,
          "sum_max_cm": 150,
          "side_max_cm": 60,
          "price_min_rub": 1501,
          "price_max_rub": 7000,
          "volumetric": false
        },
        {
          "id": "economy_small",
          "name": "Economy Small",
          "speed": "15-25天",
          "kg_rate_cny": 28.1,
          "fixed_fee_cny": 17.97,
          "weight_max_kg": 2,
          "sum_max_cm": 150,
          "side_max_cm": 60,
          "price_min_rub": 1501,
          "price_max_rub": 7000,
          "volumetric": false
        }
      ]
    },
    {
      "group_id": "big",
      "group_name": "Big",
      "group_name_zh": "大件",
      "channels": [
        {
          "id": "standard_big",
          "name": "Standard Big",
          "speed": "10-15天",
          "kg_rate_cny": 28.1,
          "fixed_fee_cny": 40.44,
          "weight_min_kg": 2,
          "weight_max_kg": 30,
          "sum_max_cm": 310,
          "side_max_cm": 150,
          "price_min_rub": 1501,
          "price_max_rub": 7000,
          "volumetric": true,
          "vol_div": 12000,
          "charge_weight_max_kg": 31
        },
        {
          "id": "economy_big",
          "name": "Economy Big",
          "speed": "15-25天",
          "kg_rate_cny": 19.1,
          "fixed_fee_cny": 40.44,
          "weight_min_kg": 2,
          "weight_max_kg": 30,
          "sum_max_cm": 310,
          "side_max_cm": 150,
          "price_min_rub": 1501,
          "price_max_rub": 7000,
          "volumetric": true,
          "vol_div": 12000,
          "charge_weight_max_kg": 31
        }
      ]
    },
    {
      "group_id": "premium_small",
      "group_name": "Premium Small",
      "group_name_zh": "高客单价小件",
      "channels": [
        {
          "id": "express_psmall",
          "name": "Express Premium Small",
          "speed": "5-10天",
          "kg_rate_cny": 50.5,
          "fixed_fee_cny": 24.71,
          "weight_max_kg": 5,
          "sum_max_cm": 250,
          "side_max_cm": 150,
          "price_min_rub": 7001,
          "price_max_rub": 250000,
          "volumetric": false
        },
        {
          "id": "standard_psmall",
          "name": "Standard Premium Small",
          "speed": "10-15天",
          "kg_rate_cny": 39.3,
          "fixed_fee_cny": 24.71,
          "weight_max_kg": 5,
          "sum_max_cm": 250,
          "side_max_cm": 150,
          "price_min_rub": 7001,
          "price_max_rub": 250000,
          "volumetric": false
        },
        {
          "id": "economy_psmall",
          "name": "Economy Premium Small",
          "speed": "15-25天",
          "kg_rate_cny": 28.1,
          "fixed_fee_cny": 24.71,
          "weight_max_kg": 5,
          "sum_max_cm": 250,
          "side_max_cm": 150,
          "price_min_rub": 7001,
          "price_max_rub": 250000,
          "volumetric": false
        }
      ]
    },
    {
      "group_id": "premium_big",
      "group_name": "Premium Big",
      "group_name_zh": "高客单价大件",
      "channels": [
        {
          "id": "standard_pbig",
          "name": "Standard Premium Big",
          "speed": "10-15天",
          "kg_rate_cny": 31.4,
          "fixed_fee_cny": 69.64,
          "weight_min_kg": 5,
          "weight_max_kg": 30,
          "sum_max_cm": 310,
          "side_max_cm": 150,
          "price_min_rub": 7001,
          "price_max_rub": 250000,
          "volumetric": true,
          "vol_div": 12000,
          "charge_weight_max_kg": 80
        },
        {
          "id": "economy_pbig",
          "name": "Economy Premium Big",
          "speed": "15-25天",
          "kg_rate_cny": 25.8,
          "fixed_fee_cny": 69.64,
          "weight_min_kg": 5,
          "weight_max_kg": 30,
          "sum_max_cm": 310,
          "side_max_cm": 150,
          "price_min_rub": 7001,
          "price_max_rub": 250000,
          "volumetric": true,
          "vol_div": 12000,
          "charge_weight_max_kg": 80
        }
      ]
    },
    {
      "group_id": "hk",
      "group_name": "HK",
      "group_name_zh": "中国香港",
      "channels": [
        {
          "id": "express_hk",
          "name": "Express HK 香港空运",
          "speed": "7-12天",
          "kg_rate_cny": 96,
          "fixed_fee_cny": 19,
          "weight_rounding_g": 100,
          "weight_max_kg": 25,
          "sum_max_cm": 310,
          "side_max_cm": 150,
          "price_min_rub": 1,
          "price_max_rub": 500000,
          "volumetric": "conditional",
          "vol_div": 6000,
          "vol_threshold_sum_cm": 60
        }
      ]
    }
  ]
}
