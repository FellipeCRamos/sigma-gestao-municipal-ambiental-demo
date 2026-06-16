import { pageStyles } from './shared';

export default function PaginationControls({ pagination, onPageChange }) {
  if (!pagination || pagination.total_pages <= 1) {
    return null;
  }

  return (
    <div style={pageStyles.actions}>
      <button
        type="button"
        style={pageStyles.buttonSecondary}
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
      >
        Página anterior
      </button>
      <span style={{ alignSelf: 'center', color: '#475569', fontSize: '14px' }}>
        Página {pagination.page} de {pagination.total_pages}
      </span>
      <button
        type="button"
        style={pageStyles.buttonSecondary}
        disabled={pagination.page >= pagination.total_pages}
        onClick={() => onPageChange(Math.min(pagination.total_pages, pagination.page + 1))}
      >
        Próxima página
      </button>
    </div>
  );
}
