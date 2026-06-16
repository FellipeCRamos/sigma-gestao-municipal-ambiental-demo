import { labelStatus, statusBadgeStyle } from '../pages/shared';

export default function CuradoriaStatusBadge({ value }) {
  return <span style={statusBadgeStyle(value)}>{labelStatus(value)}</span>;
}
