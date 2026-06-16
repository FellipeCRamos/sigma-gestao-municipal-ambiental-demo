import { useEffect, useState } from 'react';
import { getLicenciamentoProcesso, updateLicenciamentoProcesso } from '../services/licenciamentoAdminApi';
import {
  formatDate,
  formatDateOnly,
  LICENCIAMENTO_STATUS_OPTIONS,
  pageStyles,
  statusPill,
} from './shared';

export default function DetalheProcessoLicenciamento({ processoId, onClose, onUpdated }) {
  const [processo, setProcesso] = useState(null);
  const [form, setForm] = useState({ status: '', observacoes: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadProcesso() {
      if (!processoId) return;
      setLoading(true);
      setError('');
      setMessage('');

      try {
        const response = await getLicenciamentoProcesso(processoId);
        if (mounted) {
          setProcesso(response.data);
          setForm({
            status: response.data?.status || 'protocolado',
            observacoes: response.data?.observacoes || '',
          });
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message || 'Erro ao carregar processo.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProcesso();

    return () => {
      mounted = false;
    };
  }, [processoId]);

  async function handleUpdate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await updateLicenciamentoProcesso(processoId, {
        status: form.status,
        observacoes: form.observacoes,
      });
      setProcesso(response.data);
      setMessage('Processo atualizado com sucesso.');
      onUpdated?.(response.data);
    } catch (saveError) {
      setError(saveError.message || 'Erro ao atualizar processo.');
    } finally {
      setSaving(false);
    }
  }

  if (!processoId) {
    return null;
  }

  if (loading) {
    return (
      <section style={pageStyles.section}>
        <p style={pageStyles.sectionSubtitle}>Carregando processo...</p>
      </section>
    );
  }

  if (!processo) {
    return (
      <section style={pageStyles.section}>
        <p style={pageStyles.sectionSubtitle}>{error || 'Selecione um processo para visualizar.'}</p>
      </section>
    );
  }

  const pill = statusPill(processo.status);

  return (
    <section style={pageStyles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={pageStyles.sectionTitle}>{processo.numero_processo}</h3>
          <p style={pageStyles.sectionSubtitle}>
            {processo.requerente_nome || 'Requerente não informado'} - {processo.empreendimento_nome || 'Empreendimento não informado'}
          </p>
        </div>
        <button type="button" style={pageStyles.buttonSecondary} onClick={onClose}>
          Fechar detalhe
        </button>
      </div>

      {error ? <div style={{ ...pageStyles.message, ...pageStyles.dangerText }}>{error}</div> : null}
      {message ? <div style={{ ...pageStyles.message, ...pageStyles.okText }}>{message}</div> : null}

      <div style={{ ...pageStyles.grid3, marginTop: '18px' }}>
        <InfoBlock label="Status" value={<span style={{ ...pageStyles.pill, background: pill.background, color: pill.color }}>{pill.label}</span>} />
        <InfoBlock label="Tipo de licença" value={processo.tipo_licenca} />
        <InfoBlock label="Atividade principal" value={processo.atividade_principal} />
        <InfoBlock label="Data de protocolo" value={formatDateOnly(processo.data_protocolo) || '-'} />
        <InfoBlock label="Responsável" value={processo.responsavel_nome || '-'} />
        <InfoBlock label="Última movimentação" value={formatDate(processo.data_ultima_movimentacao)} />
      </div>

      <div style={{ ...pageStyles.grid2, marginTop: '18px' }}>
        <section style={{ ...pageStyles.section, boxShadow: 'none' }}>
          <h4 style={pageStyles.sectionTitle}>Pendências e diligências</h4>
          {(processo.pendencias || []).length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              {processo.pendencias.map((pendencia) => (
                <li key={pendencia.id}>
                  <strong>{pendencia.titulo}</strong> - {pendencia.status}
                </li>
              ))}
            </ul>
          ) : (
            <p style={pageStyles.sectionSubtitle}>
              Seção preparada para registrar diligências, pendências documentais e prazos em rodada futura.
            </p>
          )}
        </section>

        <section style={{ ...pageStyles.section, boxShadow: 'none' }}>
          <h4 style={pageStyles.sectionTitle}>Histórico do processo</h4>
          {(processo.historico || []).length > 0 ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {processo.historico.map((item) => (
                <article key={item.id} style={{ borderBottom: '1px solid #e7eef7', paddingBottom: '10px' }}>
                  <strong>{item.descricao}</strong>
                  <p style={pageStyles.sectionSubtitle}>{formatDate(item.created_at)} - {item.criado_por_nome || 'Sistema'}</p>
                </article>
              ))}
            </div>
          ) : (
            <p style={pageStyles.sectionSubtitle}>Nenhuma movimentação registrada.</p>
          )}
        </section>
      </div>

      <form onSubmit={handleUpdate} style={{ marginTop: '18px' }}>
        <h4 style={pageStyles.sectionTitle}>Atualização inicial</h4>
        <div style={pageStyles.formGrid}>
          <label style={pageStyles.label}>
            Status
            <select
              style={pageStyles.input}
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            >
              {LICENCIAMENTO_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={pageStyles.label}>
            Observações
            <textarea
              style={pageStyles.textarea}
              value={form.observacoes}
              onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))}
            />
          </label>
        </div>
        <div style={pageStyles.actions}>
          <button type="submit" style={pageStyles.buttonPrimary} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar atualização'}
          </button>
        </div>
      </form>
    </section>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div style={{ border: '1px solid #e7eef7', borderRadius: '8px', padding: '12px', background: '#ffffff' }}>
      <p style={{ ...pageStyles.metricLabel, marginBottom: '8px' }}>{label}</p>
      <div style={{ fontWeight: 800, color: '#0d1b3d' }}>{value || '-'}</div>
    </div>
  );
}
