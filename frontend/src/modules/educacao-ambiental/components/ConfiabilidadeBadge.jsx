import { labelStatus, statusBadgeStyle } from '../pages/shared';

export default function ConfiabilidadeBadge({ value }) {
  return <span style={statusBadgeStyle(value)}>{labelStatus(value)}</span>;
}
