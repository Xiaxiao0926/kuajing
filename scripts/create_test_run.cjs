const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '../ozon-react/public/data/market_intelligence');
const RUN_001 = path.join(BASE_DIR, 'runs/RUN-20260917-001');
const RUN_002 = path.join(BASE_DIR, 'runs/RUN-20260615-001');

fs.mkdirSync(RUN_002, { recursive: true });

// Copy files and adjust meta for Q2
const meta001 = JSON.parse(fs.readFileSync(path.join(RUN_001, 'run_meta.json'), 'utf-8'));
const meta002 = {
  ...meta001,
  run_id: 'RUN-20260615-001',
  run_title: '2026 Q2 历史选品决策对比基线',
  data_period: '2026-03-15 ~ 2026-06-15',
  created_at: '2026-06-16',
  summary_kpis: {
    ...meta001.summary_kpis,
    total_niches_raw: 7200,
    passed_niches: 6180,
  }
};
fs.writeFileSync(path.join(RUN_002, 'run_meta.json'), JSON.stringify(meta002, null, 2), 'utf-8');

// Copy audit_summary, keywords_top, validation_pool, niches_compact
fs.copyFileSync(path.join(RUN_001, 'audit_summary.json'), path.join(RUN_002, 'audit_summary.json'));
fs.copyFileSync(path.join(RUN_001, 'keywords_top.json'), path.join(RUN_002, 'keywords_top.json'));
fs.copyFileSync(path.join(RUN_001, 'validation_pool.json'), path.join(RUN_002, 'validation_pool.json'));
fs.copyFileSync(path.join(RUN_001, 'niches_compact.json'), path.join(RUN_002, 'niches_compact.json'));

// Update active_run.json
const activeRun = {
  active_run_id: 'RUN-20260917-001',
  available_runs: [
    {
      run_id: 'RUN-20260917-001',
      title: '2026 Q3 俄罗斯市场全量选品决策基线',
      date_range: '2026-06-18 ~ 2026-09-15',
      niches_count: 6534,
      keywords_count: 300001,
      created_at: '2026-09-17',
      models: {
        market_model: 'WB-MARKET-MODEL-V1',
        risk_model: 'WB-CROSSBORDER-RISK-V1',
        keyword_model: 'WB-DSI-V1'
      }
    },
    {
      run_id: 'RUN-20260615-001',
      title: '2026 Q2 历史选品决策对比基线',
      date_range: '2026-03-15 ~ 2026-06-15',
      niches_count: 6180,
      keywords_count: 284500,
      created_at: '2026-06-16',
      models: {
        market_model: 'WB-MARKET-MODEL-V1',
        risk_model: 'WB-CROSSBORDER-RISK-V1',
        keyword_model: 'WB-DSI-V1'
      }
    }
  ]
};
fs.writeFileSync(path.join(BASE_DIR, 'active_run.json'), JSON.stringify(activeRun, null, 2), 'utf-8');

console.log('Successfully created test run RUN-20260615-001 and updated active_run.json');
