export function KPICard({ icon, title, value, sub, trend }) {
  const colors = { up: 'text-green-600 bg-green-50', down: 'text-red-600 bg-red-50', neutral: 'text-gray-600 bg-gray-50' }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[trend]}`}>{icon}</div>
        <div>
          <div className="text-xs text-morandi-text-light">{title}</div>
          <div className="text-lg font-bold text-morandi-text">{value}</div>
          <div className="text-xs text-morandi-text-light">{sub}</div>
        </div>
      </div>
    </div>
  )
}

export function RecommendationCard({ title, content, color }) {
  const colors = { blue: 'border-l-blue-500 bg-blue-50', green: 'border-l-green-500 bg-green-50', purple: 'border-l-purple-500 bg-purple-50', orange: 'border-l-orange-500 bg-orange-50', red: 'border-l-red-500 bg-red-50', teal: 'border-l-teal-500 bg-teal-50' }
  return (
    <div className={`p-4 rounded-lg border-l-4 ${colors[color]}`}>
      <div className="font-semibold text-morandi-text mb-1">{title}</div>
      <div className="text-sm text-morandi-text-light">{content}</div>
    </div>
  )
}
