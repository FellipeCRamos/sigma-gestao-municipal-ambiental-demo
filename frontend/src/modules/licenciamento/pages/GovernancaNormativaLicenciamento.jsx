import { useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import {
  getGovernancaNormativaDivergencias,
  getGovernancaNormativaHomologacao,
  getGovernancaNormativaMatrizes,
  getGovernancaNormativaNormas,
  getGovernancaNormativaStatus,
  getGovernancaNormativaTabelasTaxas,
  runGovernancaNormativaSeedFase2C,
  updateGovernancaNormativaHomologacao,
} from '../services/licenciamentoGovernancaApi';
import { formatDate, pageStyles } from './shared';

const STATUS_LABELS = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  aprovado_com_observacao: 'Aprovado com observacao',
  nao_aplicavel: 'Nao aplicavel',
  operacional_piloto: 'Operacional piloto',
  vigente_validada: 'Vigente validada',
  vigente_em_conferencia: 'Vigente em conferencia',
  historica: 'Historica',
  divergente: 'Divergente',
  vigente: 'Vigente',
  vigente_preferencial: 'Vigente preferencial',
  referencia_comparativa: 'Referencia comparativa',
  pendente_validacao_juridica: 'Pendente de validacao juridica',
  pendente_conferencia_visual: 'Pendente de conferencia visual',
  registrada: 'Registrada',
  ok: 'OK',
  bloqueado: 'Bloqueado',
};

function boolLabel(value) {
  return value ? 'Sim' : 'Nao';
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '-';
}

function statusStyle(status) {
  const danger = ['reprovado', 'critica', 'alta', 'divergente', 'pendente_conferencia_visual', 'bloqueado'];
  const success = ['aprovado', 'vigente_validada', 'vigente_preferencial', 'ok'];
  const warning = ['pendente', 'aprovado_com_observacao', 'operacional_piloto', 'vigente_em_conferencia', 'pendente_validacao_juridica'];

  if (danger.includes(status)) return { ...pageStyles.pill, background: '#fee2e2', color: '#991b1b' };
  if (success.includes(status)) return { ...pageStyles.pill, background: '#dcfce7', color: '#166534' };
  if (warning.includes(status)) return { ...pageStyles.pill, background: '#fef3c7', color: '#92400e' };
  return { ...pageStyles.pill, background: '#e5e7eb', color: '#374151' };
}

function MetricCard({ label, value, tone = 'default' }) {
  const valueColor = tone === 'danger' ? '#991b1b' : tone === 'ok' ? '#166534' : '#0d3f8f';
  return (
    <div style={pageStyles.cardMetric}>
      <p style={pageStyles.metricLabel}>{label}</p>
      <p style={{ ...pageStyles.metricValue, color: valueColor }}>{value}</p>
    </div>
  );
}

function Table({ columns, rows, emptyMessage }) {
  return (
    <div style={pageStyles.tableWrap}>
      <table style={pageStyles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={pageStyles.th}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.id || row.codigo}>
              {columns.map((column) => (
                <td key={column.key} style={pageStyles.td}>
                  {column.render ? column.render(row) : row[column.key] || '-'}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td style={pageStyles.td} colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function GovernancaNormativaLicenciamento({ usuarioInterno }) {
  const [status, setStatus] = useState(null);
  const [normas, setNormas] = useState([]);
  const [tabelasTaxas, setTabelasTaxas] = useState([]);
  const [matrizes, setMatrizes] = useState([]);
  const [divergencias, setDivergencias] = useState([]);
  const [homologacao, setHomologacao] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canManageHomologacao = hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_MANAGE);
  const canManageGovernanca = hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_GOVERNANCA_NORMATIVA_MANAGE);

  const homologacaoPorGrupo = useMemo(() => homologacao.reduce((acc, item) => {
    if (!acc[item.grupo]) acc[item.grupo] = [];
    acc[item.grupo].push(item);
    return acc;
  }, {}), [homologacao]);
  const readyForFase2D = status?.ready_for_fase2d;

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const [
        statusResponse,
        normasResponse,
        tabelasResponse,
        matrizesResponse,
        divergenciasResponse,
        homologacaoResponse,
      ] = await Promise.all([
        getGovernancaNormativaStatus(),
        getGovernancaNormativaNormas(),
        getGovernancaNormativaTabelasTaxas(),
        getGovernancaNormativaMatrizes(),
        getGovernancaNormativaDivergencias(),
        getGovernancaNormativaHomologacao(),
      ]);

      setStatus(statusResponse.data || null);
      setNormas(normasResponse.data || []);
      setTabelasTaxas(tabelasResponse.data || []);
      setMatrizes(matrizesResponse.data || []);
      setDivergencias(divergenciasResponse.data || []);
      setHomologacao(homologacaoResponse.data || []);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a governanca normativa.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleHomologacao(item, nextStatus) {
    setMessage('');
    try {
      await updateGovernancaNormativaHomologacao(item.id, {
        status: nextStatus,
        resultado: nextStatus === 'aprovado' ? 'Validado na homologacao funcional.' : item.resultado,
      });
      await load();
      setMessage('Item de homologacao atualizado.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel atualizar o item de homologacao.');
    }
  }

  async function handleSeedFase2C() {
    setMessage('');
    setLoading(true);
    try {
      await runGovernancaNormativaSeedFase2C();
      await load();
      setMessage('Seed da Fase 2C executado sem duplicar registros.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel executar o seed da Fase 2C.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h2 style={pageStyles.sectionTitle}>Governanca Normativa</h2>
        <p style={pageStyles.sectionSubtitle}>
          Nucleo de governanca legal do Licenciamento Ambiental: normas municipais, tabelas versionadas, matrizes,
          divergencias, homologacao funcional e bloqueios de producao.
        </p>
        {message ? (
          <div style={{ ...pageStyles.message, marginTop: 14, background: '#f8fbff' }}>{message}</div>
        ) : null}
        {canManageGovernanca ? (
          <div style={pageStyles.actions}>
            <button type="button" disabled={loading} onClick={handleSeedFase2C} style={pageStyles.buttonSecondary}>
              Reexecutar seed Fase 2C
            </button>
          </div>
        ) : null}
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Status Geral</h3>
        <div style={pageStyles.grid3}>
          <MetricCard label="Normas municipais" value={status?.normas ? Object.values(status.normas).filter(Boolean).length : '-'} />
          <MetricCard label="Lei de taxas preferencial" value={boolLabel(status?.normas?.lei_1192)} tone={status?.normas?.lei_1192 ? 'ok' : 'danger'} />
          <MetricCard label="Tabela operacional" value={boolLabel(status?.taxas?.tabela_operacional_piloto)} />
          <MetricCard label="Tabela validada para cobranca" value={boolLabel(status?.taxas?.validada_para_cobranca)} tone={status?.taxas?.validada_para_cobranca ? 'ok' : 'danger'} />
          <MetricCard label="Divergencias pendentes" value={status?.taxas?.divergencias_pendentes ?? '-'} tone={status?.taxas?.divergencias_pendentes ? 'danger' : 'ok'} />
          <MetricCard label="Homologacao aprovada" value={`${status?.homologacao?.aprovados ?? 0}/${status?.homologacao?.total ?? 0}`} />
          <MetricCard label="DAM real" value={status?.bloqueios_operacionais?.dam_real ? 'Bloqueado' : 'Liberado'} tone="danger" />
          <MetricCard label="Protocolo definitivo" value={status?.bloqueios_operacionais?.protocolo_definitivo ? 'Bloqueado' : 'Liberado'} tone="danger" />
          <MetricCard
            label="Prontidão Fase 2D"
            value={readyForFase2D?.ready ? 'Apta' : 'Pendente'}
            tone={readyForFase2D?.ready ? 'ok' : 'danger'}
          />
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Prontidão para Fase 2D</h3>
        <p style={pageStyles.sectionSubtitle}>
          Critérios conservadores para iniciar a Parametrização Completa Controlada do Decreto nº 021/2020 por grupos.
        </p>
        <div style={{ ...pageStyles.message, marginTop: 14, background: readyForFase2D?.ready ? '#ecfdf5' : '#fff8e7' }}>
          {readyForFase2D?.recomendacao || 'Status de prontidão em processamento.'}
        </div>
        <Table
          rows={(readyForFase2D?.criterios || []).map((criterio, index) => ({ id: criterio.codigo || index, ...criterio }))}
          emptyMessage="Critérios de prontidão ainda não retornados pelo backend."
          columns={[
            { key: 'descricao', label: 'Critério' },
            { key: 'status', label: 'Status', render: (row) => <span style={statusStyle(row.status)}>{statusLabel(row.status)}</span> },
            { key: 'detalhe', label: 'Detalhe' },
          ]}
        />
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Normas Municipais</h3>
        <Table
          rows={normas}
          emptyMessage="Nenhuma norma cadastrada."
          columns={[
            { key: 'codigo', label: 'Codigo' },
            { key: 'titulo', label: 'Norma' },
            { key: 'tipo_norma', label: 'Tipo' },
            { key: 'ano', label: 'Ano' },
            { key: 'status_normativo', label: 'Status', render: (row) => <span style={statusStyle(row.status_normativo)}>{statusLabel(row.status_normativo)}</span> },
            { key: 'preferencial_taxas', label: 'Pref. taxas', render: (row) => boolLabel(row.preferencial_taxas) },
            { key: 'referencia_comparativa', label: 'Comparativa', render: (row) => boolLabel(row.referencia_comparativa) },
            { key: 'norma_historica', label: 'Historica', render: (row) => boolLabel(row.norma_historica) },
            { key: 'modulos_vinculados', label: 'Modulos', render: (row) => (row.modulos_vinculados || []).map((item) => item.modulo).join(', ') || '-' },
          ]}
        />
      </section>

      <section style={pageStyles.grid2}>
        <div style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Tabelas de Taxas</h3>
          <Table
            rows={tabelasTaxas}
            emptyMessage="Nenhuma tabela versionada cadastrada."
            columns={[
              { key: 'codigo', label: 'Codigo' },
              { key: 'status', label: 'Status', render: (row) => <span style={statusStyle(row.status)}>{statusLabel(row.status)}</span> },
              { key: 'operacional', label: 'Operacional', render: (row) => boolLabel(row.operacional) },
              { key: 'piloto', label: 'Piloto', render: (row) => boolLabel(row.piloto) },
              { key: 'validada_para_cobranca', label: 'Cobranca', render: (row) => boolLabel(row.validada_para_cobranca) },
              { key: 'regras_vinculadas', label: 'Regras' },
            ]}
          />
        </div>

        <div style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Matrizes de Enquadramento</h3>
          <Table
            rows={matrizes}
            emptyMessage="Nenhuma matriz versionada cadastrada."
            columns={[
              { key: 'codigo', label: 'Codigo' },
              { key: 'norma_codigo', label: 'Norma' },
              { key: 'status', label: 'Status', render: (row) => <span style={statusStyle(row.status)}>{statusLabel(row.status)}</span> },
              { key: 'operacional', label: 'Operacional', render: (row) => boolLabel(row.operacional) },
              { key: 'regras_cadastradas', label: 'Regras' },
            ]}
          />
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Divergencias Normativas</h3>
        <Table
          rows={divergencias}
          emptyMessage="Nenhuma divergencia cadastrada."
          columns={[
            { key: 'codigo', label: 'Codigo' },
            { key: 'titulo', label: 'Titulo' },
            { key: 'criticidade', label: 'Criticidade', render: (row) => <span style={statusStyle(row.criticidade)}>{row.criticidade}</span> },
            { key: 'status', label: 'Status', render: (row) => <span style={statusStyle(row.status)}>{statusLabel(row.status)}</span> },
            { key: 'impacto_sistema', label: 'Impacto' },
            { key: 'recomendacao', label: 'Recomendacao' },
          ]}
        />
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Homologacao</h3>
        <p style={pageStyles.sectionSubtitle}>
          Checklist funcional da Fase 2C. Os itens podem ser marcados conforme validacao visual e tecnica controlada.
        </p>
        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          {Object.entries(homologacaoPorGrupo).map(([grupo, itens]) => (
            <div key={grupo} style={{ ...pageStyles.tableWrap, padding: 0 }}>
              <div style={{ padding: 14, background: '#eaf3ff', fontWeight: 900, color: '#0d1b3d' }}>{grupo}</div>
              <table style={pageStyles.table}>
                <tbody>
                  {itens.map((item) => (
                    <tr key={item.id}>
                      <td style={pageStyles.td}>
                        <strong>{item.item}</strong>
                        <div style={pageStyles.muted}>{item.rota_relacionada || '-'}</div>
                        {item.resultado ? <div style={pageStyles.muted}>{item.resultado}</div> : null}
                      </td>
                      <td style={pageStyles.td}><span style={statusStyle(item.status)}>{statusLabel(item.status)}</span></td>
                      <td style={pageStyles.td}>{item.validado_em ? formatDate(item.validado_em) : '-'}</td>
                      <td style={pageStyles.td}>
                        {canManageHomologacao ? (
                          <div style={{ ...pageStyles.actions, marginTop: 0 }}>
                            <button type="button" onClick={() => handleHomologacao(item, 'aprovado')} style={pageStyles.buttonSecondary}>Aprovar</button>
                            <button
                              type="button"
                              onClick={() => setMessage('Use a tela Homologacao assistida para registrar observacao obrigatoria, reprovacao ou nao aplicabilidade.')}
                              style={pageStyles.buttonSecondary}
                            >
                              Abrir assistida
                            </button>
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Bloqueios de Producao</h3>
        <div style={pageStyles.grid3}>
          <MetricCard label="DAM real" value="Bloqueado nesta fase" tone="danger" />
          <MetricCard label="Cobranca oficial" value="Bloqueada nesta fase" tone="danger" />
          <MetricCard label="Protocolo definitivo por simulacao" value="Bloqueado nesta fase" tone="danger" />
          <MetricCard label="Parametrizacao completa dos grupos" value="Pendente Fase 2D" />
        </div>
      </section>
    </div>
  );
}
