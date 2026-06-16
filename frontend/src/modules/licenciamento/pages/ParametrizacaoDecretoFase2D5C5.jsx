import { useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import {
  aplicarLicenciamentoParametrizacaoFase2D5C5Grupo21SeedControlado,
  getLicenciamentoParametrizacaoFase2D5C5Grupo21PreviaSeedControlado,
} from '../services/licenciamentoAdminApi';
import { formatNumber, pageStyles } from './shared';

const badgeColors = {
  neutral: { background: '#eef2ff', color: '#1e3a8a' },
  ok: { background: '#dcfce7', color: '#166534' },
  warn: { background: '#fef3c7', color: '#92400e' },
  danger: { background: '#fee2e2', color: '#991b1b' },
  info: { background: '#e0f2fe', color: '#075985' },
  muted: { background: '#e5e7eb', color: '#374151' },
};

const cardStyle = {
  border: '1px solid #d8e5f2',
  borderRadius: '8px',
  background: '#ffffff',
  padding: '16px',
  display: 'grid',
  gap: '10px',
};

const riskStyle = {
  border: '1px solid #fed7aa',
  background: '#fff7ed',
  color: '#7c2d12',
  borderRadius: '8px',
  padding: '14px 16px',
  display: 'grid',
  gap: '8px',
};

function badge(text, tone = 'neutral') {
  return <span style={{ ...pageStyles.pill, ...(badgeColors[tone] || badgeColors.neutral) }}>{text}</span>;
}

function statusTone(status) {
  if (status === 'aplicado_idempotente') return 'ok';
  if (status === 'apto_para_aplicacao_controlada') return 'info';
  return 'danger';
}

function InlineList({ items = [], tone = 'neutral', empty = 'Sem registro.' }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p style={pageStyles.sectionSubtitle}>{empty}</p>;
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map((item) => badge(item, tone))}
    </div>
  );
}

function ValidationItem({ label, ok }) {
  return (
    <div style={cardStyle}>
      <strong>{label}</strong>
      <div>{badge(ok ? 'Conforme' : 'Bloqueado', ok ? 'ok' : 'danger')}</div>
    </div>
  );
}

function SeedTable({ rows = [] }) {
  if (!rows.length) {
    return <p style={pageStyles.sectionSubtitle}>Nenhuma atividade prevista.</p>;
  }

  return (
    <div style={pageStyles.tableWrap}>
      <table style={pageStyles.table}>
        <thead>
          <tr>
            <th style={pageStyles.th}>Código</th>
            <th style={pageStyles.th}>Descrição</th>
            <th style={pageStyles.th}>Parâmetro</th>
            <th style={pageStyles.th}>Potencial</th>
            <th style={pageStyles.th}>Ato/Classe</th>
            <th style={pageStyles.th}>Status</th>
            <th style={pageStyles.th}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.codigo}>
              <td style={pageStyles.td}><strong>{item.codigo}</strong></td>
              <td style={pageStyles.td}>{item.descricao}</td>
              <td style={pageStyles.td}>
                {item.parametro?.label || item.parametro?.nome || '-'}
                {item.parametro?.unidade ? ` (${item.parametro.unidade})` : ''}
              </td>
              <td style={pageStyles.td}>{item.potencialPoluidorDegradador}</td>
              <td style={pageStyles.td}>{item.tipoAtoLicenciamento}</td>
              <td style={pageStyles.td}>{badge(item.status, 'ok')}</td>
              <td style={pageStyles.td}>{badge(item.acaoPrevista, item.jaAplicado ? 'muted' : 'info')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ParametrizacaoDecretoFase2D5C5({ usuarioInterno }) {
  const [preview, setPreview] = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');

  const canApply = hasPermission(
    usuarioInterno,
    PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_APPLY
  );

  async function loadPreview({ resetMessage = true } = {}) {
    setLoading(true);
    if (resetMessage) setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C5Grupo21PreviaSeedControlado();
      setPreview(response.data);
      return response.data;
    } catch (error) {
      setMessage(error.message || 'Não foi possível carregar a prévia do seed controlado.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function applySeed() {
    if (!preview?.aplicacaoPermitida || !canApply) return;

    const confirmed = window.confirm(
      'Aplicar seed controlado somente para 21.02, 21.03, 21.05, 21.07, 21.08 e 21.10? Os códigos parciais permanecerão bloqueados.'
    );
    if (!confirmed) return;

    setApplying(true);
    setMessage('');
    setApplyResult(null);
    try {
      const response = await aplicarLicenciamentoParametrizacaoFase2D5C5Grupo21SeedControlado({
        confirmarAplicacao: true,
        codigos: preview.codigosAptos,
      });
      setApplyResult(response.data);
      setMessage('Seed controlado aplicado com sucesso. A operação foi idempotente e preservou os códigos parciais.');
      await loadPreview({ resetMessage: false });
    } catch (error) {
      setMessage(error.message || 'Não foi possível aplicar o seed controlado.');
    } finally {
      setApplying(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, []);

  const validations = useMemo(() => ([
    ['Matriz contém somente os seis códigos aptos', preview?.validacoes?.matrizContemSomenteCodigosAptos],
    ['Nenhum código parcial entrou na matriz', preview?.validacoes?.nenhumCodigoParcialNaMatriz],
    ['Tabela sem códigos parciais operacionais', preview?.validacoes?.nenhumCodigoParcialNaTabelaOperacional],
    ['Tabela sem conflitos operacionais', preview?.validacoes?.tabelaSemConflitos],
    ['Dispensa não convertida em licença', preview?.validacoes?.naoConverteDispensaEmLicenca],
  ]), [preview]);

  const applyDisabled = applying || loading || !preview?.aplicacaoPermitida || !canApply;

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Grupo 21 — Seed Controlado 2D.5C.5</h1>
        <p style={pageStyles.sectionSubtitle}>
          Parametrização operacional limitada aos códigos integralmente aptos na revisão normativa 2D.5C.4.
        </p>
        <div style={pageStyles.actions}>
          {badge('Não é seed geral', 'warn')}
          {badge('Seis códigos aptos', 'ok')}
          {badge('Parciais preservados', 'info')}
        </div>
        <div style={pageStyles.actions}>
          <button type="button" style={pageStyles.buttonSecondary} onClick={() => loadPreview()} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar prévia'}
          </button>
          <button type="button" style={pageStyles.buttonPrimary} onClick={applySeed} disabled={applyDisabled}>
            {applying ? 'Aplicando...' : 'Aplicar seed controlado'}
          </button>
        </div>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando prévia do seed controlado...</div> : null}

      {preview ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Status geral</p>
              <div>{badge(preview.statusGeral, statusTone(preview.statusGeral))}</div>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Códigos aptos</p>
              <p style={pageStyles.metricValue}>{formatNumber(preview.totalCodigosAptos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Registros 21.%</p>
              <p style={pageStyles.metricValue}>{formatNumber(preview.tabelaOperacional?.totalAtivosGrupo21 || 0)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Pendentes de inserção</p>
              <p style={pageStyles.metricValue}>{formatNumber(preview.tabelaOperacional?.codigosAptosPendentes?.length || 0)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Já aplicados</p>
              <p style={pageStyles.metricValue}>{formatNumber(preview.tabelaOperacional?.codigosAptosJaAplicados?.length || 0)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Parciais operacionais</p>
              <p style={pageStyles.metricValue}>{formatNumber(preview.tabelaOperacional?.codigosParciaisOperacionais?.length || 0)}</p>
            </div>
          </section>

          <section style={pageStyles.grid2}>
            <article style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Códigos Aptos</h2>
              <InlineList items={preview.codigosAptos} tone="ok" />
            </article>
            <article style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Códigos Parciais Bloqueados</h2>
              <InlineList items={preview.codigosParciaisBloqueados} tone="warn" />
            </article>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Prévia do Seed</h2>
            <SeedTable rows={preview.matrizOperacional || []} />
          </section>

          <section style={pageStyles.grid2}>
            <article style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Validações</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {validations.map(([label, ok]) => (
                  <ValidationItem key={label} label={label} ok={Boolean(ok)} />
                ))}
              </div>
            </article>
            <article style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Bloqueios Preservados</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {(preview.bloqueiosParciais || []).map((item) => (
                  <div key={`${item.codigo}-${item.condicao}`} style={cardStyle}>
                    <div style={pageStyles.actions}>
                      {badge(item.codigo, 'warn')}
                      {badge(item.condicao, 'danger')}
                    </div>
                    <p style={pageStyles.sectionSubtitle}>{item.motivo}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section style={riskStyle}>
            <strong>Riscos controlados</strong>
            {(preview.riscos || []).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </section>

          {applyResult ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Resultado da Aplicação</h2>
              <div style={pageStyles.actions}>
                {badge(`${formatNumber(applyResult.totalAtividadesAfetadas)} atividades`, 'ok')}
                {badge(`${formatNumber(applyResult.totalRegrasAfetadas)} regras`, 'ok')}
                {badge(applyResult.idempotente ? 'Idempotente' : 'Inserção controlada', 'info')}
                {applyResult.auditoria?.registrada ? badge('Auditoria registrada', 'ok') : badge('Auditoria pendente', 'warn')}
              </div>
              <SeedTable rows={(applyResult.atividades || []).map((item) => ({
                codigo: item.codigo,
                descricao: item.codigo,
                parametro: {},
                potencialPoluidorDegradador: '-',
                tipoAtoLicenciamento: '-',
                status: 'aplicado',
                acaoPrevista: item.acao,
                jaAplicado: item.acao === 'atualizado',
              }))} />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
