import { useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import {
  aplicarLicenciamentoParametrizacaoFase2D5C2BGrupo21Importacao,
  getLicenciamentoParametrizacaoFase2D5C2BGrupo21HistoricoImportacoes,
  getLicenciamentoParametrizacaoFase2D5C2BGrupo21ModeloJson,
  validarLicenciamentoParametrizacaoFase2D5C2BGrupo21Importacao,
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

const textareaStyle = {
  ...pageStyles.textarea,
  minHeight: '360px',
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, Liberation Mono, monospace',
  lineHeight: 1.45,
};

function badge(text, tone = 'neutral') {
  const colors = {
    neutral: { background: '#eef2ff', color: '#1e3a8a' },
    ok: { background: '#dcfce7', color: '#166534' },
    warn: { background: '#fef3c7', color: '#92400e' },
    danger: { background: '#fee2e2', color: '#991b1b' },
    muted: { background: '#e5e7eb', color: '#374151' },
  };

  return <span style={{ ...pageStyles.pill, ...(colors[tone] || colors.neutral) }}>{text}</span>;
}

function parseJson(jsonText) {
  return JSON.parse(jsonText);
}

function issueTitle(issue) {
  return [issue.codigo, issue.tipo, issue.campo].filter(Boolean).join(' - ');
}

function IssueList({ title, issues, tone }) {
  if (!issues?.length) {
    return (
      <section style={pageStyles.section}>
        <h2 style={pageStyles.sectionTitle}>{title}</h2>
        <p style={pageStyles.sectionSubtitle}>Nenhum registro.</p>
      </section>
    );
  }

  return (
    <section style={pageStyles.section}>
      <h2 style={pageStyles.sectionTitle}>{title}</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {issues.map((issue, index) => (
          <article key={`${issue.tipo}-${issue.codigo || 'geral'}-${index}`} style={cardStyle}>
            <div style={pageStyles.actions}>
              {badge(issue.codigo || 'geral', tone)}
              {badge(issue.tipo, tone)}
              {issue.faixaOrdem ? badge(`Faixa ${issue.faixaOrdem}`, 'neutral') : null}
            </div>
            <strong>{issueTitle(issue)}</strong>
            <p style={pageStyles.sectionSubtitle}>{issue.mensagem}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ParametrizacaoDecretoFase2D5C2B({ usuarioInterno, navigateToPage }) {
  const [jsonText, setJsonText] = useState('');
  const [validation, setValidation] = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canValidate = hasPermission(
    usuarioInterno,
    PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_VALIDATE
  );
  const canApply = hasPermission(
    usuarioInterno,
    PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_APPLY
  );

  const applyBlocked = useMemo(() => (
    !canApply || !validation?.success || (validation?.erros || []).length > 0
  ), [canApply, validation]);

  function setJsonObject(value) {
    setJsonText(JSON.stringify(value, null, 2));
  }

  function downloadJson(value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fase2d5c2b-grupo21-modelo-conferencia.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadTemplate() {
    setLoading(true);
    setMessage('');
    setValidation(null);
    setApplyResult(null);
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C2BGrupo21ModeloJson();
      setJsonObject(response.data);
      downloadJson(response.data);
      setMessage('Modelo JSON carregado na area de edicao e enviado para download.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel baixar o modelo JSON.');
    } finally {
      setLoading(false);
    }
  }

  async function validateImport() {
    setLoading(true);
    setMessage('');
    setApplyResult(null);
    try {
      const payload = parseJson(jsonText);
      const response = await validarLicenciamentoParametrizacaoFase2D5C2BGrupo21Importacao(payload);
      setValidation(response.data);
      setMessage(response.data.success ? 'Importacao validada sem erros criticos.' : 'Importacao recusada pela validacao estrutural.');
    } catch (error) {
      setValidation(null);
      setMessage(error.message || 'JSON invalido ou falha na validacao.');
    } finally {
      setLoading(false);
    }
  }

  async function applyImport() {
    setLoading(true);
    setMessage('');
    try {
      const payload = parseJson(jsonText);
      const response = await aplicarLicenciamentoParametrizacaoFase2D5C2BGrupo21Importacao(payload);
      setApplyResult(response.data);
      setMessage('Importacao aplicada na bancada manual assistida. Nenhum seed foi executado.');
      const historyResponse = await getLicenciamentoParametrizacaoFase2D5C2BGrupo21HistoricoImportacoes();
      setHistory(historyResponse.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel aplicar a importacao.');
    } finally {
      setLoading(false);
    }
  }

  function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setJsonText(String(reader.result || ''));
      setValidation(null);
      setApplyResult(null);
      setMessage(`Arquivo ${file.name} carregado para validacao.`);
    };
    reader.onerror = () => setMessage('Nao foi possivel ler o arquivo selecionado.');
    reader.readAsText(file);
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Fase 2D.5C.2-B — Importação Controlada da Conferência Manual do Grupo 21</h1>
        <p style={pageStyles.sectionSubtitle}>
          Matriz preenchivel para revisar dados normativos do Grupo 21 - Obras e Estruturas Diversas antes de qualquer parametrizacao operacional.
        </p>
      </section>

      <div style={warningBoxStyle}>
        Esta tela não executa seed e não altera a base operacional. A importação alimenta apenas a bancada manual assistida.
      </div>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Processando solicitacao...</div> : null}

      <section style={pageStyles.section}>
        <h2 style={pageStyles.sectionTitle}>Matriz de conferencia</h2>
        <div style={pageStyles.actions}>
          <button type="button" style={pageStyles.buttonSecondary} onClick={loadTemplate} disabled={loading}>
            Baixar modelo JSON
          </button>
          <button type="button" style={pageStyles.buttonSecondary} onClick={validateImport} disabled={loading || !canValidate || !jsonText.trim()}>
            Validar importação
          </button>
          <button type="button" style={pageStyles.buttonPrimary} onClick={applyImport} disabled={loading || applyBlocked}>
            Aplicar importação validada
          </button>
        </div>
        <div style={{ ...pageStyles.formGrid, marginTop: 16 }}>
          <label style={pageStyles.label}>
            Selecionar arquivo JSON
            <input type="file" accept="application/json,.json" style={pageStyles.input} onChange={onFileSelected} />
          </label>
        </div>
        <label style={{ ...pageStyles.label, marginTop: 16 }}>
          JSON preenchido
          <textarea
            style={textareaStyle}
            value={jsonText}
            onChange={(event) => {
              setJsonText(event.target.value);
              setValidation(null);
              setApplyResult(null);
            }}
            placeholder="Cole aqui o JSON preenchido da matriz de conferencia do Grupo 21."
          />
        </label>
      </section>

      {validation ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Total recebido</p>
              <p style={pageStyles.metricValue}>{formatNumber(validation.totalRecebido)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Validos</p>
              <p style={pageStyles.metricValue}>{formatNumber(validation.validos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Invalidos</p>
              <p style={pageStyles.metricValue}>{formatNumber(validation.invalidos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Advertencias</p>
              <p style={pageStyles.metricValue}>{formatNumber(validation.comAdvertencia)}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Resultado da validação</h2>
            <div style={pageStyles.actions}>
              {badge(validation.success ? 'Sem erro critico' : 'Bloqueada', validation.success ? 'ok' : 'danger')}
              {badge(validation.modo || 'validacao_sem_gravacao')}
              {badge('Sem seed operacional', 'ok')}
              {badge(applyBlocked ? 'Aplicacao bloqueada' : 'Pronta para aplicar', applyBlocked ? 'warn' : 'ok')}
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Prévia de aplicação</h2>
            {validation.previaAplicacao?.length ? (
              <div style={pageStyles.grid2}>
                {validation.previaAplicacao.map((item) => (
                  <article key={item.codigo} style={cardStyle}>
                    <div style={pageStyles.actions}>
                      {badge(item.codigo, item.bloqueado ? 'danger' : 'ok')}
                      {badge(item.acao, 'neutral')}
                      {badge(item.statusPretendido, item.statusPretendido === 'conferido_integralmente' ? 'ok' : 'warn')}
                      {badge(item.aptoParaSeedPretendido ? 'Apto pretendido' : 'Nao apto', item.aptoParaSeedPretendido ? 'ok' : 'muted')}
                    </div>
                    <p style={pageStyles.sectionSubtitle}><strong>Status atual:</strong> {item.statusAtual}</p>
                    {item.erros?.length ? <p style={pageStyles.sectionSubtitle}><strong>Erros:</strong> {item.erros.join('; ')}</p> : null}
                    {item.advertencias?.length ? <p style={pageStyles.sectionSubtitle}><strong>Advertencias:</strong> {item.advertencias.join('; ')}</p> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p style={pageStyles.sectionSubtitle}>Sem itens aplicaveis.</p>
            )}
          </section>

          <IssueList title="Erros" issues={validation.erros} tone="danger" />
          <IssueList title="Advertências" issues={validation.advertencias} tone="warn" />
        </>
      ) : null}

      {applyResult ? (
        <section style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Importação aplicada</h2>
          <div style={pageStyles.actions}>
            {badge(`Criados: ${formatNumber(applyResult.criados)}`, 'ok')}
            {badge(`Atualizados: ${formatNumber(applyResult.atualizados)}`, 'ok')}
            {badge(applyResult.seedOperacionalCriado ? 'Seed executado' : 'Sem seed operacional', applyResult.seedOperacionalCriado ? 'danger' : 'ok')}
            {badge(applyResult.tabelaOperacionalAlterada ? 'Tabela operacional alterada' : 'Base operacional preservada', applyResult.tabelaOperacionalAlterada ? 'danger' : 'ok')}
          </div>
          <p style={pageStyles.sectionSubtitle}>{applyResult.mensagem}</p>
          <div style={pageStyles.actions}>
            <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2')}>
              Abrir Bancada 2D.5C.2
            </button>
            <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2a')}>
              Abrir Prévia de Seed 2D.5C.2-A
            </button>
          </div>
        </section>
      ) : null}

      {history?.historico?.length ? (
        <section style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Histórico recente de importações</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {history.historico.slice(0, 12).map((item) => (
              <article key={item.id} style={cardStyle}>
                <div style={pageStyles.actions}>
                  {badge(item.codigo, 'neutral')}
                  {badge(item.acao, 'ok')}
                  {badge(item.statusNovo || 'sem status', 'muted')}
                </div>
                <p style={pageStyles.sectionSubtitle}>{formatDate(item.criadoEm)} por {item.usuarioNome || 'usuario interno'}</p>
                {item.observacao ? <p style={pageStyles.sectionSubtitle}>{item.observacao}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
