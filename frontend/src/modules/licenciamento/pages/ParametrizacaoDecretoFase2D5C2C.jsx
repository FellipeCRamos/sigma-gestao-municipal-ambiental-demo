import { useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import {
  getLicenciamentoParametrizacaoFase2D5C2CGrupo21ModeloOficialReal,
  getLicenciamentoParametrizacaoFase2D5C2CGrupo21PreparacaoMatrizReal,
  limparLicenciamentoParametrizacaoFase2D5C2CGrupo21RascunhosHomologacao,
} from '../services/licenciamentoAdminApi';
import { formatDate, formatNumber, pageStyles } from './shared';

const warningBoxStyle = {
  border: '1px solid #f7d99a',
  background: '#fffbeb',
  color: '#7c4a03',
  borderRadius: '8px',
  padding: '14px 16px',
  fontSize: '14px',
  fontWeight: 800,
};

const cardStyle = {
  border: '1px solid #d8e5f2',
  borderRadius: '8px',
  background: '#ffffff',
  padding: '16px',
  display: 'grid',
  gap: '10px',
};

function badge(text, tone = 'neutral') {
  const colors = {
    neutral: { background: '#eef2ff', color: '#1e3a8a' },
    ok: { background: '#dcfce7', color: '#166534' },
    warn: { background: '#fef3c7', color: '#92400e' },
    danger: { background: '#fee2e2', color: '#991b1b' },
    muted: { background: '#e5e7eb', color: '#374151' },
  };

  return <span style={{ ...pageStyles.pill, ...(colors[tone] || colors.neutral) }}>{text || '-'}</span>;
}

function downloadJson(value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fase2d5c2c-grupo21-modelo-oficial-real.json';
  link.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value }) {
  return (
    <div style={pageStyles.cardMetric}>
      <p style={pageStyles.metricLabel}>{label}</p>
      <p style={pageStyles.metricValue}>{formatNumber(value)}</p>
    </div>
  );
}

export default function ParametrizacaoDecretoFase2D5C2C({ usuarioInterno, navigateToPage }) {
  const [diagnostico, setDiagnostico] = useState(null);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [justificativa, setJustificativa] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canCleanup = hasPermission(
    usuarioInterno,
    PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_CLEANUP
  );

  const possibleCodes = useMemo(() => (
    (diagnostico?.possiveisRegistrosTeste || []).map((item) => item.codigo)
  ), [diagnostico]);

  const cleanupBlocked = loading
    || !canCleanup
    || selectedCodes.length === 0
    || !justificativa.trim()
    || !confirmar;

  async function loadDiagnostico() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C2CGrupo21PreparacaoMatrizReal();
      setDiagnostico(response.data);
      setSelectedCodes((current) => current.filter((codigo) => (
        (response.data.possiveisRegistrosTeste || []).some((item) => item.codigo === codigo)
      )));
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a preparacao da matriz real.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDiagnostico();
  }, []);

  async function exportOfficialModel() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C2CGrupo21ModeloOficialReal();
      downloadJson(response.data);
      setMessage('Modelo oficial para conferencia real exportado. Nenhum seed foi executado.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel exportar o modelo oficial.');
    } finally {
      setLoading(false);
    }
  }

  function toggleCode(codigo) {
    setSelectedCodes((current) => (
      current.includes(codigo)
        ? current.filter((item) => item !== codigo)
        : [...current, codigo]
    ));
  }

  async function cleanupDrafts() {
    setLoading(true);
    setMessage('');
    setCleanupResult(null);
    try {
      const response = await limparLicenciamentoParametrizacaoFase2D5C2CGrupo21RascunhosHomologacao({
        codigos: selectedCodes,
        confirmarLimpezaHomologacao: confirmar,
        justificativa,
      });
      setCleanupResult(response.data);
      setMessage('Limpeza controlada registrada. A tabela operacional nao foi alterada.');
      setSelectedCodes([]);
      setJustificativa('');
      setConfirmar(false);
      await loadDiagnostico();
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel limpar os rascunhos de homologacao.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Fase 2D.5C.2-C — Preparação da Matriz Real do Grupo 21</h1>
        <p style={pageStyles.sectionSubtitle}>
          Diagnostico interno para limpar rascunhos artificiais de homologacao, preservar dados reais e exportar o modelo oficial de conferencia humana.
        </p>
      </section>

      <div style={warningBoxStyle}>
        Esta etapa não executa seed e não altera a base operacional.
      </div>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Processando solicitacao...</div> : null}

      {diagnostico ? (
        <>
          <section style={pageStyles.grid3}>
            <Metric label="Total de codigos" value={diagnostico.totalCodigos} />
            <Metric label="Registros existentes" value={diagnostico.registrosBancada} />
            <Metric label="Rascunhos" value={diagnostico.rascunhos} />
            <Metric label="Conferidos com lacuna" value={diagnostico.conferidosComLacunas} />
            <Metric label="Conferidos integralmente" value={diagnostico.conferidosIntegralmente} />
            <Metric label="Aptos para seed" value={diagnostico.aptosParaSeed} />
            <Metric label="Atividades operacionais 21.%" value={diagnostico.atividadesOperacionaisGrupo21} />
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Prontidao da bancada</h2>
            <div style={pageStyles.actions}>
              {badge(diagnostico.statusGeral, diagnostico.possiveisRegistrosTeste?.length ? 'warn' : 'ok')}
              {badge(diagnostico.tabelaOperacionalAfetada ? 'operacional afetada' : 'operacional preservada', diagnostico.tabelaOperacionalAfetada ? 'danger' : 'ok')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{diagnostico.recomendacao}</p>
            <div style={pageStyles.actions}>
              <button type="button" style={pageStyles.buttonSecondary} onClick={exportOfficialModel} disabled={loading}>
                Exportar modelo oficial para conferência real
              </button>
              <button type="button" style={pageStyles.buttonSecondary} onClick={loadDiagnostico} disabled={loading}>
                Atualizar diagnostico
              </button>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Possíveis registros de teste/homologação</h2>
            {(diagnostico.possiveisRegistrosTeste || []).length === 0 ? (
              <p style={pageStyles.sectionSubtitle}>Nenhum rascunho artificial foi identificado automaticamente.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {(diagnostico.possiveisRegistrosTeste || []).map((registro) => (
                  <article key={registro.codigo} style={cardStyle}>
                    <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={selectedCodes.includes(registro.codigo)}
                        onChange={() => toggleCode(registro.codigo)}
                      />
                      <span>{registro.codigo} - {registro.nomeAtividade || 'Atividade sem nome manual'}</span>
                    </label>
                    <div style={pageStyles.actions}>
                      {badge(registro.statusConferencia, 'warn')}
                      {badge(registro.aptoParaSeed ? 'apto para seed' : 'nao apto para seed', registro.aptoParaSeed ? 'danger' : 'muted')}
                      {badge(`Atualizado em ${formatDate(registro.atualizadoEm)}`, 'neutral')}
                    </div>
                    <p style={pageStyles.sectionSubtitle}>{registro.observacaoInterna || 'Sem observacao interna.'}</p>
                    <div style={pageStyles.actions}>
                      {(registro.criterios || []).map((criterio) => badge(criterio, 'neutral'))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {possibleCodes.length > 0 ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Limpeza controlada</h2>
              <p style={pageStyles.sectionSubtitle}>
                A limpeza remove os rascunhos selecionados da bancada ativa, preserva historico e bloqueia qualquer registro real, integral ou apto para seed.
              </p>
              <label style={{ ...pageStyles.label, marginTop: 16 }}>
                Justificativa obrigatoria
                <textarea
                  style={pageStyles.textarea}
                  value={justificativa}
                  onChange={(event) => setJustificativa(event.target.value)}
                  placeholder="Descreva a razao institucional da limpeza."
                />
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, fontWeight: 800 }}>
                <input
                  type="checkbox"
                  checked={confirmar}
                  onChange={(event) => setConfirmar(event.target.checked)}
                />
                <span>Confirmo que a limpeza se limita a rascunhos artificiais de homologacao e nao remove dados reais.</span>
              </label>
              <div style={pageStyles.actions}>
                <button type="button" style={pageStyles.buttonPrimary} onClick={cleanupDrafts} disabled={cleanupBlocked}>
                  Limpar rascunhos de homologação
                </button>
                {!canCleanup ? badge('usuario sem permissao de limpeza', 'danger') : null}
              </div>
            </section>
          ) : null}

          {(diagnostico.registrosReaisPreservados || []).length > 0 ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Registros reais preservados</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {diagnostico.registrosReaisPreservados.map((registro) => (
                  <article key={registro.codigo} style={cardStyle}>
                    <div style={pageStyles.actions}>
                      {badge(registro.codigo, 'neutral')}
                      {badge(registro.statusConferencia, 'ok')}
                      {badge(registro.aptoParaSeed ? 'apto para seed' : 'nao apto para seed', registro.aptoParaSeed ? 'ok' : 'muted')}
                    </div>
                    <strong>{registro.nomeAtividade || 'Atividade sem nome manual'}</strong>
                    <p style={pageStyles.sectionSubtitle}>Registro preservado automaticamente pela regra de limpeza.</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {cleanupResult ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Resumo da limpeza</h2>
              <div style={pageStyles.grid3}>
                <Metric label="Solicitados" value={cleanupResult.totalSolicitado} />
                <Metric label="Removidos da bancada ativa" value={cleanupResult.removidos} />
                <Metric label="Atividades operacionais 21.%" value={cleanupResult.atividadesOperacionaisGrupo21} />
              </div>
              <p style={pageStyles.sectionSubtitle}>
                Tabela operacional alterada: {cleanupResult.tabelaOperacionalAlterada ? 'sim' : 'nao'}. Seed operacional criado: {cleanupResult.seedOperacionalCriado ? 'sim' : 'nao'}.
              </p>
              <div style={pageStyles.actions}>
                <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2')}>
                  Abrir Bancada 2D.5C.2
                </button>
                <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2b')}>
                  Abrir Importação 2D.5C.2-B
                </button>
                <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2a')}>
                  Abrir Prévia de Seed 2D.5C.2-A
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
