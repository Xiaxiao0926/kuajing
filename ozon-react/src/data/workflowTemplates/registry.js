/**
 * workflowTemplates/registry.js — 模板注册表（唯一入口）
 * 新增版本（roadmap-v2…）只需在此 import 并登记；已冻结的 roadmap-v1.js 不得回改。
 */
import { ROADMAP_V1 } from './roadmap-v1.js'

export const WORKFLOW_TEMPLATES = Object.freeze({
  'roadmap-v1': ROADMAP_V1,
})

/** 按版本读取模板（不存在返回 null，调用方 fail-close） */
export function getWorkflowTemplate(version) {
  return WORKFLOW_TEMPLATES[version] || null
}
