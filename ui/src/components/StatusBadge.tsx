import type { CaseStatus } from '../api'

export default function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className={`badge-dot dot-${status}`} />
      {status}
    </span>
  )
}
