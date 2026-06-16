import { useEffect, useMemo, useState } from 'react';
import logoMunicipioDemo from '../../../assets/logo-municipio-demo-thumbnail.png';
import ModuloPublicoPlaceholder from '../../../core/publico/ModuloPublicoPlaceholder';
import { VIVEIRO_PUBLIC_PORTAL_FLAG, isViveiroPublicPortalEnabled } from '../config/viveiroPublicFlags';
import {
  createViveiroPublicSolicitacao,
  getViveiroPublicEspecies,
  getViveiroPublicStatus,
} from '../services/viveiroPublicApi';

const INITIAL_FORM = {
  solicitante_nome: '',
  solicitante_email: '',
  solicitante_telefone: '',
  tipo_solicitante: 'cidadao',
  instituicao_nome: '',
  bairro_localidade: '',
  finalidade: '',
  observacoes: '',
  aceite_ciencia: false,
  itens: [
    {
      especie_id: '',
      quantidade_solicitada: '',
      observacoes: '',
    },
  ],
};

function disabledPortal({
  reason,
  onOpenAdmin,
  onOpenPublico,
  onOpenPainelPublico,
}) {
  return (
    <ModuloPublicoPlaceholder
      title="Viveiro Municipal"
      eyebrow="Viveiro Municipal"
      description="O serviço público de solicitação de mudas permanece indisponível para uso externo amplo. Nenhuma solicitação pública é gravada nesta tela."
      statusLabel="Serviço público indisponível"
      portalTitle="Portal externo do Viveiro desativado"
      portalText={reason}
      noticeItems={[
        'Não há formulário público gravável neste modo.',
        'Não há protocolo público de entrega ou promessa de atendimento automático.',
        'Solicitações de mudas seguem sob triagem e controle interno da SMAD.',
      ]}
      secondaryActionLabel="Painel Público SIGMA"
      onOpenAdmin={onOpenAdmin}
      onOpenPublico={onOpenPainelPublico || onOpenPublico}
    />
  );
}

export default function ViveiroPublicPortalPage({
  onOpenAdmin,
  onOpenPublico,
  onOpenPainelPublico,
}) {
  const frontendEnabled = isViveiroPublicPortalEnabled();
  const [backendStatus, setBackendStatus] = useState(null);
  const [especies, setEspecies] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(frontendEnabled);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadPublicGate() {
      if (!frontendEnabled) return;

      try {
        setLoading(true);
        setError('');
        const statusResponse = await getViveiroPublicStatus();
        const status = statusResponse.data || null;

        if (cancelled) return;
        setBackendStatus(status);

        if (status?.enabled) {
          const especiesResponse = await getViveiroPublicEspecies();
          if (!cancelled) {
            setEspecies(Array.isArray(especiesResponse.data) ? especiesResponse.data : []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Não foi possível consultar o serviço público do Viveiro.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPublicGate();

    return () => {
      cancelled = true;
    };
  }, [frontendEnabled]);

  const selectedSpeciesIds = useMemo(
    () => new Set(form.itens.map((item) => String(item.especie_id)).filter(Boolean)),
    [form.itens]
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
    setError('');
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      itens: current.itens.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
    setMessage('');
    setError('');
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      itens: [
        ...current.itens,
        { especie_id: '', quantidade_solicitada: '', observacoes: '' },
      ].slice(0, 5),
    }));
  }

  function removeLastItem() {
    setForm((current) => ({
      ...current,
      itens: current.itens.length > 1 ? current.itens.slice(0, -1) : current.itens,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSending(true);
    setMessage('');
    setError('');

    try {
      if (!form.solicitante_email && !form.solicitante_telefone) {
        throw new Error('Informe telefone ou e-mail para contato administrativo.');
      }

      const itensValidos = form.itens.filter(
        (item) => item.especie_id && Number(item.quantidade_solicitada) > 0
      );

      if (!itensValidos.length) {
        throw new Error('Informe ao menos uma espécie desejada.');
      }

      const response = await createViveiroPublicSolicitacao({
        ...form,
        itens: itensValidos,
      });

      setMessage(response.message || response.data?.mensagem || 'Solicitação recebida para triagem administrativa da SMAD.');
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(err.message || 'Não foi possível enviar a solicitação pública do Viveiro.');
    } finally {
      setSending(false);
    }
  }

  if (!frontendEnabled) {
    return disabledPortal({
      reason: `A feature flag frontend ${VIVEIRO_PUBLIC_PORTAL_FLAG} está desligada. O formulário público não é exibido e nenhum dado é enviado.`,
      onOpenAdmin,
      onOpenPublico,
      onOpenPainelPublico,
    });
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.loadingBox}>Consultando disponibilidade do serviço...</section>
      </main>
    );
  }

  if (error || !backendStatus?.enabled) {
    return disabledPortal({
      reason: error || backendStatus?.message || 'A feature flag backend VIVEIRO_PUBLIC_PORTAL_ENABLED está desligada.',
      onOpenAdmin,
      onOpenPublico,
      onOpenPainelPublico,
    });
  }

  return (
    <main style={styles.page} className="sigma-public-page">
      <header style={styles.header} className="sigma-public-header">
        <button type="button" style={styles.brandButton} className="sigma-public-brand" onClick={onOpenPainelPublico || onOpenPublico}>
          <img src={logoMunicipioDemo} alt="Município demonstrativo" style={styles.logo} />
          <span style={styles.brandText}>
            <strong>SMAD</strong>
            <span>Viveiro Municipal</span>
          </span>
        </button>
        <button type="button" style={styles.internalButton} className="sigma-public-button" onClick={() => onOpenAdmin?.()}>
          Acesso interno SMAD
        </button>
      </header>

      <section style={styles.hero} className="sigma-public-hero">
        <span style={styles.badge} className="sigma-public-badge">MVP público controlado por feature flag</span>
        <h1 style={styles.title} className="sigma-public-title">Solicitação de mudas do Viveiro Municipal</h1>
        <p style={styles.subtitle} className="sigma-public-subtitle">
          Solicitações recebidas por este canal entram como pendentes e passam por triagem administrativa da SMAD. O envio não garante aprovação, reserva de estoque, prazo ou entrega.
        </p>
        <div style={styles.noticeGrid}>
          <p style={styles.notice}>A disponibilidade de espécies é apresentada como sob consulta. Lotes e estoque interno não são exibidos.</p>
          <p style={styles.noticeStrong}>Não informe Documento nesta etapa. Use apenas nome e um contato administrativo.</p>
          <p style={styles.notice}>Canal em fase controlada/homologação assistida. A SMAD fará análise interna e a solicitação poderá ser indeferida se não atender aos critérios administrativos, técnicos ou de disponibilidade.</p>
          <p style={styles.notice}>Não há prazo automático garantido, protocolo conclusivo, comprovante público, reserva ou entrega automática nesta fase.</p>
        </div>
      </section>

      <section style={styles.section} className="sigma-public-section">
        {error ? <div style={{ ...styles.message, ...styles.error }}>{error}</div> : null}
        {message ? <div style={{ ...styles.message, ...styles.success }}>{message}</div> : null}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGrid}>
            <label style={styles.label}>
              Nome do solicitante
              <input
                style={styles.input}
                value={form.solicitante_nome}
                onChange={(event) => updateField('solicitante_nome', event.target.value)}
                required
                maxLength={160}
              />
            </label>
            <label style={styles.label}>
              Telefone
              <input
                style={styles.input}
                value={form.solicitante_telefone}
                onChange={(event) => updateField('solicitante_telefone', event.target.value)}
                maxLength={40}
              />
            </label>
            <label style={styles.label}>
              E-mail
              <input
                type="email"
                style={styles.input}
                value={form.solicitante_email}
                onChange={(event) => updateField('solicitante_email', event.target.value)}
                maxLength={160}
              />
            </label>
            <label style={styles.label}>
              Tipo de solicitante
              <select
                style={styles.input}
                value={form.tipo_solicitante}
                onChange={(event) => updateField('tipo_solicitante', event.target.value)}
              >
                <option value="cidadao">Cidadão</option>
                <option value="instituicao">Instituição</option>
                <option value="escola">Escola</option>
                <option value="ong">ONG</option>
              </select>
            </label>
            <label style={styles.label}>
              Instituição
              <input
                style={styles.input}
                value={form.instituicao_nome}
                onChange={(event) => updateField('instituicao_nome', event.target.value)}
                maxLength={180}
              />
            </label>
            <label style={styles.label}>
              Bairro/localidade
              <input
                style={styles.input}
                value={form.bairro_localidade}
                onChange={(event) => updateField('bairro_localidade', event.target.value)}
                required
                maxLength={180}
              />
            </label>
          </div>

          <label style={styles.label}>
            Finalidade da solicitação
            <textarea
              style={styles.textarea}
              value={form.finalidade}
              onChange={(event) => updateField('finalidade', event.target.value)}
              required
              minLength={10}
              maxLength={1000}
            />
          </label>

          <div style={styles.itemsBlock}>
            <h2 style={styles.sectionTitle}>Espécies desejadas</h2>
            {form.itens.map((item, index) => (
              <div key={index} style={styles.itemRow}>
                <label style={styles.label}>
                  Espécie
                  <select
                    style={styles.input}
                    value={item.especie_id}
                    onChange={(event) => updateItem(index, 'especie_id', event.target.value)}
                    required
                  >
                    <option value="">Selecione</option>
                    {especies.map((especie) => (
                      <option
                        key={especie.id}
                        value={especie.id}
                        disabled={selectedSpeciesIds.has(String(especie.id)) && String(item.especie_id) !== String(especie.id)}
                      >
                        {especie.nome} - {especie.disponibilidade}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={styles.label}>
                  Quantidade solicitada
                  <input
                    style={styles.input}
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={item.quantidade_solicitada}
                    onChange={(event) => updateItem(index, 'quantidade_solicitada', event.target.value)}
                    required
                  />
                </label>
                <label style={styles.label}>
                  Observações do item
                  <input
                    style={styles.input}
                    value={item.observacoes}
                    onChange={(event) => updateItem(index, 'observacoes', event.target.value)}
                    maxLength={300}
                  />
                </label>
              </div>
            ))}
            <div style={styles.actions}>
              <button type="button" style={styles.secondaryButton} className="sigma-public-button" onClick={addItem} disabled={form.itens.length >= 5}>
                Adicionar espécie
              </button>
              {form.itens.length > 1 ? (
                <button type="button" style={styles.secondaryButton} className="sigma-public-button" onClick={removeLastItem}>
                  Remover última espécie
                </button>
              ) : null}
            </div>
          </div>

          <label style={styles.label}>
            Observações gerais
            <textarea
              style={{ ...styles.textarea, minHeight: '92px' }}
              value={form.observacoes}
              onChange={(event) => updateField('observacoes', event.target.value)}
              maxLength={1000}
            />
          </label>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.aceite_ciencia}
              onChange={(event) => updateField('aceite_ciencia', event.target.checked)}
              required
            />
            <span>
              Declaro ciência de que a solicitação será analisada pela SMAD e não garante aprovação, reserva de estoque, prazo ou entrega.
            </span>
          </label>

          <div style={styles.actions}>
            <button type="submit" style={styles.primaryButton} className="sigma-public-button" disabled={sending}>
              {sending ? 'Enviando...' : 'Enviar para triagem'}
            </button>
            <button type="button" style={styles.secondaryButton} className="sigma-public-button" onClick={onOpenPainelPublico || onOpenPublico}>
              Voltar ao Painel Público SIGMA
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #eef7f0 0%, #ffffff 52%, #eef6ff 100%)',
    color: '#0d1b3d',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '18px',
    padding: '18px clamp(16px, 4vw, 32px)',
    background: 'rgba(255, 255, 255, 0.96)',
    borderBottom: '1px solid #d8e5f2',
    boxShadow: '0 8px 24px rgba(13, 63, 143, 0.06)',
  },
  brandButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    border: 'none',
    background: 'transparent',
    color: '#0d1b3d',
    cursor: 'pointer',
    padding: 0,
  },
  logo: {
    width: '112px',
    height: 'auto',
  },
  brandText: {
    display: 'grid',
    gap: '2px',
    textAlign: 'left',
    fontSize: '14px',
  },
  internalButton: {
    minHeight: '42px',
    border: '1px solid #1f7a3f',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#176a36',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 16px',
  },
  hero: {
    width: 'min(1120px, calc(100% - 32px))',
    margin: '0 auto',
    padding: 'clamp(42px, 7vw, 58px) 0 24px',
  },
  badge: {
    display: 'inline-flex',
    borderRadius: '999px',
    background: '#e8f7ed',
    color: '#176a36',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 900,
    marginBottom: '18px',
  },
  title: {
    margin: 0,
    color: '#0d1b3d',
    fontSize: 'clamp(34px, 6vw, 48px)',
    lineHeight: 1.05,
  },
  subtitle: {
    maxWidth: '840px',
    margin: '16px 0 0',
    color: '#4c5f78',
    lineHeight: 1.6,
    fontSize: '18px',
  },
  noticeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
    gap: '14px',
    marginTop: '24px',
  },
  notice: {
    margin: 0,
    border: '1px solid #d8e5f2',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#4c5f78',
    padding: '16px',
    lineHeight: 1.5,
  },
  noticeStrong: {
    margin: 0,
    border: '1px solid #fed7aa',
    borderRadius: '8px',
    background: '#fff7ed',
    color: '#9a3412',
    padding: '16px',
    lineHeight: 1.5,
    fontWeight: 800,
  },
  section: {
    width: 'min(1120px, calc(100% - 32px))',
    margin: '0 auto',
    padding: '28px 0',
  },
  sectionTitle: {
    margin: '0 0 12px',
    color: '#0d1b3d',
    fontSize: '22px',
  },
  form: {
    display: 'grid',
    gap: '16px',
    border: '1px solid #d8e5f2',
    borderRadius: '8px',
    background: '#ffffff',
    padding: '22px',
    boxShadow: '0 14px 32px rgba(13, 63, 143, 0.08)',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
    gap: '14px',
  },
  itemRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) minmax(180px, 220px) minmax(220px, 1fr)',
    gap: '14px',
    marginBottom: '10px',
  },
  label: {
    display: 'grid',
    gap: '6px',
    color: '#0d1b3d',
    fontSize: '13px',
    fontWeight: 850,
  },
  input: {
    minHeight: '42px',
    border: '1px solid #cfe0f5',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#172033',
    padding: '10px 12px',
    fontSize: '14px',
  },
  textarea: {
    minHeight: '130px',
    border: '1px solid #cfe0f5',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#172033',
    padding: '10px 12px',
    fontSize: '14px',
    resize: 'vertical',
  },
  itemsBlock: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '16px',
    background: '#f8fbff',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    color: '#334155',
    lineHeight: 1.45,
    fontWeight: 700,
  },
  actions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    minHeight: '44px',
    border: '1px solid #176a36',
    borderRadius: '8px',
    background: 'linear-gradient(180deg, #2e9e4b 0%, #176a36 100%)',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 18px',
  },
  secondaryButton: {
    minHeight: '44px',
    border: '1px solid #cfe0f5',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#0d3f8f',
    cursor: 'pointer',
    fontWeight: 850,
    padding: '0 18px',
  },
  message: {
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '14px',
    fontWeight: 800,
  },
  error: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
  },
  success: {
    border: '1px solid #bbf7d0',
    background: '#f0fdf4',
    color: '#166534',
  },
  loadingBox: {
    minHeight: '220px',
    display: 'grid',
    placeItems: 'center',
    color: '#334155',
    fontWeight: 800,
  },
};
