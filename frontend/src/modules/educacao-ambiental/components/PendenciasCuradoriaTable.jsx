import ConfiabilidadeBadge from './ConfiabilidadeBadge';
import CuradoriaStatusBadge from './CuradoriaStatusBadge';
import { formatDate, styles } from '../pages/shared';

function alertText(item) {
  const alerts = [];
  if (item.alerta_sem_fonte) alerts.push('sem fonte');
  if (item.alerta_confiabilidade_baixa) alerts.push('confiabilidade baixa');
  if (item.alerta_validacao_tecnica) alerts.push('validacao tecnica');
  if (item.alerta_validacao_juridica) alerts.push('validacao juridica');
  if (item.alerta_revisao_vencida) alerts.push('revisao vencida');
  if (item.alerta_nao_apto_ia) alerts.push('nao apto IA');
  return alerts.join(', ') || 'sem alerta critico';
}

export default function PendenciasCuradoriaTable({ items = [], onAction }) {
  if (!items.length) {
    return <p style={styles.message}>Nenhuma pendencia encontrada para os filtros atuais.</p>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Conteudo</th>
            <th style={styles.th}>Curadoria</th>
            <th style={styles.th}>Confiabilidade</th>
            <th style={styles.th}>Fonte</th>
            <th style={styles.th}>Alertas</th>
            <th style={styles.th}>Atualizado</th>
            <th style={styles.th}>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={styles.td}>
                <strong>{item.titulo}</strong>
                <p style={styles.sectionSubtitle}>{item.categoria || item.eixo_tematico || 'Sem tema'}</p>
              </td>
              <td style={styles.td}><CuradoriaStatusBadge value={item.status_curadoria} /></td>
              <td style={styles.td}><ConfiabilidadeBadge value={item.grau_confiabilidade} /></td>
              <td style={styles.td}>
                {item.fonte_principal_nome || item.fonte_referencia || '-'}
                <p style={styles.sectionSubtitle}>{Number(item.referencias_total || 0)} referencia(s)</p>
              </td>
              <td style={styles.td}>{alertText(item)}</td>
              <td style={styles.td}>{formatDate(item.updated_at)}</td>
              <td style={styles.td}>
                <div style={styles.actions}>
                  <button type="button" style={styles.buttonSecondary} onClick={() => onAction(item, 'em_curadoria')}>
                    Iniciar
                  </button>
                  <button type="button" style={styles.buttonSecondary} onClick={() => onAction(item, 'pendente_fonte')}>
                    Pendente fonte
                  </button>
                  <button
                    type="button"
                    style={styles.buttonSecondary}
                    onClick={() => onAction(item, 'pendente_validacao_tecnica')}
                  >
                    Enviar tecnica
                  </button>
                  <button type="button" style={styles.buttonSecondary} onClick={() => onAction(item, 'validar_tecnica')}>
                    Validar tecnica
                  </button>
                  <button type="button" style={styles.buttonSecondary} onClick={() => onAction(item, 'apto_portal')}>
                    Apto portal
                  </button>
                  <button type="button" style={styles.buttonSecondary} onClick={() => onAction(item, 'apto_ia')}>
                    Apto IA
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
