import { useMemo, useState } from 'react';
import logoMunicipioDemo from '../../assets/logo-municipio-demo-thumbnail.png';
import { createDemandaPublica } from './publicoSigmaApi';

const CATEGORIES = [
  {
    value: 'bem_estar_animal',
    urlValue: 'bem-estar-animal',
    title: 'Bem-estar Animal',
    description:
      'Maus-tratos, abandono, animal em situação de risco, animal ferido, animal errante, ausência de cuidados básicos ou acúmulo inadequado de animais.',
    subcategories: [
      ['maus_tratos', 'Maus-tratos'],
      ['abandono', 'Abandono'],
      ['animal_ferido_risco', 'Animal ferido ou em risco'],
      ['animal_errante', 'Animal errante'],
      ['acumulo_inadequado_animais', 'Acúmulo inadequado de animais'],
      ['outros_animais', 'Outros casos envolvendo animais'],
    ],
  },
  {
    value: 'licenciamento',
    title: 'Licenciamento Ambiental',
    description:
      'Empreendimento ou atividade potencialmente poluidora em funcionamento sem licença, com licença vencida, descumprindo condicionantes ou em possível desconformidade ambiental.',
    subcategories: [
      ['empreendimento_sem_licenca', 'Empreendimento sem licença'],
      ['licenca_vencida', 'Licença vencida'],
      ['descumprimento_condicionantes', 'Descumprimento de condicionantes'],
      ['atividade_desacordo_licenca', 'Atividade em desacordo com a licença'],
      ['obra_atividade_sem_autorizacao', 'Obra ou atividade sem autorização ambiental'],
      ['outros_licenciamento', 'Outros assuntos relacionados a licenciamento'],
    ],
  },
  {
    value: 'fiscalizacao',
    title: 'Fiscalização Ambiental',
    description:
      'Corte de árvores, supressão de vegetação, queimadas, descarte irregular de resíduos, intervenção em APP, terraplenagem irregular ou outras possíveis infrações ambientais.',
    subcategories: [
      ['corte_arvore', 'Corte de árvore'],
      ['supressao_vegetacao', 'Supressão de vegetação'],
      ['queimada', 'Queimada'],
      ['descarte_irregular_residuos', 'Descarte irregular de resíduos'],
      ['intervencao_app', 'Intervenção em APP'],
      ['terraplenagem_irregular', 'Terraplenagem irregular'],
      ['poluicao_solo_ar_agua', 'Poluição do solo, ar ou água'],
      ['outros_fiscalizacao', 'Outros assuntos fiscalizatórios'],
    ],
  },
  {
    value: 'poluicao_residuos',
    urlValue: 'poluicao-residuos',
    title: 'Poluição e Resíduos',
    description:
      'Fumaça, odor, lançamento de efluentes, descarte de entulho, resíduos em via pública, poluição hídrica ou disposição inadequada de materiais.',
    subcategories: [
      ['descarte_entulho', 'Descarte de entulho'],
      ['lancamento_efluentes', 'Lançamento de efluentes'],
      ['poluicao_curso_hidrico', 'Poluição de curso hídrico'],
      ['fumaca', 'Fumaça'],
      ['odor', 'Odor'],
      ['residuos_local_inadequado', 'Resíduos sólidos em local inadequado'],
      ['outros_poluicao_residuos', 'Outros casos de poluição ou resíduos'],
    ],
  },
  {
    value: 'outros',
    title: 'Outros assuntos ambientais',
    description: 'Demandas ambientais que não se enquadrem nas opções anteriores.',
    subcategories: [
      ['orientacao_ambiental', 'Orientação ambiental'],
      ['solicitacao_geral', 'Solicitação geral'],
      ['informacao_complementar', 'Informação complementar'],
      ['outros', 'Outros'],
    ],
  },
];

const INITIAL_FORM = {
  categoria: '',
  subcategoria: '',
  descricao: '',
  endereco_referencia: '',
  bairro_localidade: '',
  ponto_referencia: '',
  identificacao_tipo: 'anonima',
  nome_comunicante: '',
  telefone_comunicante: '',
  email_comunicante: '',
  aceite_lgpd: false,
};

function normalizeCategory(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  return CATEGORIES.some((category) => category.value === normalized) ? normalized : '';
}

export default function DenunciasAmbientais({ initialCategoria = '', onOpenPublico, onOpenAdmin }) {
  const initialCategory = normalizeCategory(initialCategoria);
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    categoria: initialCategory,
  }));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const selectedCategory = useMemo(
    () => CATEGORIES.find((category) => category.value === form.categoria) || null,
    [form.categoria]
  );

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'categoria' ? { subcategoria: '' } : {}),
    }));
    setError('');
    setMessage('');
  }

  function selectCategory(category) {
    updateField('categoria', category.value);
    setConfirmation(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    setMessage('');
    setConfirmation(null);

    try {
      const response = await createDemandaPublica(form);
      setConfirmation(response.data);
      setMessage(
        `Comunicação registrada com sucesso. Protocolo: ${response.data.protocolo}. As informações serão analisadas pela SMAD para triagem e encaminhamento conforme competência.`
      );
      setForm({
        ...INITIAL_FORM,
        categoria: form.categoria,
      });
    } catch (submitError) {
      setError(submitError.message || 'Não foi possível registrar a comunicação.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={styles.page} className="sigma-public-page">
      <header style={styles.header} className="sigma-public-header">
        <button type="button" style={styles.brandButton} className="sigma-public-brand" onClick={onOpenPublico}>
          <img src={logoMunicipioDemo} alt="Município demonstrativo" style={styles.logo} />
          <span style={styles.brandText}>
            <strong>SMAD</strong>
            <span>Denúncias e Irregularidades Ambientais</span>
          </span>
        </button>
        <button type="button" style={styles.internalButton} className="sigma-public-button" onClick={() => onOpenAdmin?.()}>
          Acesso interno SMAD
        </button>
      </header>

      <section style={styles.hero} className="sigma-public-hero">
        <span style={styles.badge} className="sigma-public-badge">Canal público transversal da Plataforma SIGMA</span>
        <h1 style={styles.title} className="sigma-public-title">Denúncias e Irregularidades Ambientais</h1>
        <p style={styles.subtitle} className="sigma-public-subtitle">
          Este canal auxilia o cidadão a direcionar corretamente comunicações de possíveis irregularidades ambientais à
          Secretaria Municipal de Meio Ambiente demonstrativa.
        </p>
        <div style={styles.noticeGrid}>
          <p style={styles.notice}>
            O envio da comunicação não substitui a análise técnica da SMAD. As informações serão avaliadas conforme
            competência municipal, disponibilidade de dados e legislação aplicável.
          </p>
          <p style={styles.noticeStrong}>
            Em caso de risco imediato à vida, acidente, incêndio ou emergência, acione os órgãos competentes de
            atendimento emergencial.
          </p>
        </div>
      </section>

      <section style={styles.section} className="sigma-public-section">
        <h2 style={styles.sectionTitle}>Selecione o assunto</h2>
        <div style={styles.categoryGrid}>
          {CATEGORIES.map((category) => (
            <button
              key={category.value}
              type="button"
              style={{
                ...styles.categoryCard,
                ...(form.categoria === category.value ? styles.categoryCardActive : {}),
              }}
              onClick={() => selectCategory(category)}
            >
              <strong>{category.title}</strong>
              <span>{category.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section style={styles.section} className="sigma-public-section">
        <h2 style={styles.sectionTitle}>Registrar comunicação</h2>
        <p style={styles.sectionText}>
          Caso opte por se identificar, os dados informados serão utilizados exclusivamente para análise e eventual contato
          sobre a demanda. Não é necessário informar Documento nesta etapa.
        </p>

        {error ? <div style={{ ...styles.message, ...styles.error }}>{error}</div> : null}
        {message ? <div style={{ ...styles.message, ...styles.success }}>{message}</div> : null}

        {confirmation ? (
          <div style={styles.confirmation}>
            <h3 style={styles.confirmationTitle}>Protocolo {confirmation.protocolo}</h3>
            <p>Categoria: {selectedCategory?.title || confirmation.categoria}</p>
            <p>Recebimento: {new Date(confirmation.data_recebimento).toLocaleString('pt-BR')}</p>
            <p>Guarde o número de protocolo para eventual atendimento futuro.</p>
            <div style={styles.actions}>
              <button type="button" style={styles.secondaryButton} className="sigma-public-button" onClick={onOpenPublico}>
                Voltar ao Painel Público SIGMA
              </button>
              <button type="button" style={styles.primaryButton} className="sigma-public-button" onClick={() => setConfirmation(null)}>
                Registrar nova comunicação
              </button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGrid}>
            <label style={styles.label}>
              Categoria
              <select
                style={styles.input}
                value={form.categoria}
                onChange={(event) => updateField('categoria', event.target.value)}
                required
              >
                <option value="">Selecione</option>
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.title}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Subcategoria
              <select
                style={styles.input}
                value={form.subcategoria}
                onChange={(event) => updateField('subcategoria', event.target.value)}
                required
                disabled={!selectedCategory}
              >
                <option value="">Selecione</option>
                {(selectedCategory?.subcategories || []).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Bairro/localidade
              <input
                style={styles.input}
                value={form.bairro_localidade}
                onChange={(event) => updateField('bairro_localidade', event.target.value)}
                required
              />
            </label>
            <label style={styles.label}>
              Endereço ou referência do local
              <input
                style={styles.input}
                value={form.endereco_referencia}
                onChange={(event) => updateField('endereco_referencia', event.target.value)}
                required
              />
            </label>
            <label style={styles.label}>
              Ponto de referência
              <input
                style={styles.input}
                value={form.ponto_referencia}
                onChange={(event) => updateField('ponto_referencia', event.target.value)}
              />
            </label>
            <label style={styles.label}>
              Identificação
              <select
                style={styles.input}
                value={form.identificacao_tipo}
                onChange={(event) => updateField('identificacao_tipo', event.target.value)}
              >
                <option value="anonima">Anônima</option>
                <option value="identificada">Identificada</option>
              </select>
            </label>
          </div>

          <label style={styles.label}>
            Descrição da ocorrência
            <textarea
              style={styles.textarea}
              value={form.descricao}
              onChange={(event) => updateField('descricao', event.target.value)}
              required
              minLength={20}
              maxLength={3000}
              placeholder="Descreva o que foi observado, quando aconteceu e qualquer informação que ajude a triagem."
            />
          </label>

          {form.identificacao_tipo === 'identificada' ? (
            <div style={styles.formGrid}>
              <label style={styles.label}>
                Nome do comunicante
                <input
                  style={styles.input}
                  value={form.nome_comunicante}
                  onChange={(event) => updateField('nome_comunicante', event.target.value)}
                />
              </label>
              <label style={styles.label}>
                Telefone
                <input
                  style={styles.input}
                  value={form.telefone_comunicante}
                  onChange={(event) => updateField('telefone_comunicante', event.target.value)}
                />
              </label>
              <label style={styles.label}>
                E-mail
                <input
                  type="email"
                  style={styles.input}
                  value={form.email_comunicante}
                  onChange={(event) => updateField('email_comunicante', event.target.value)}
                />
              </label>
            </div>
          ) : null}

          <div style={styles.attachmentsBox}>
            <strong>Anexos em implantação</strong>
            <span>O envio de imagens e PDF será habilitado após validação da infraestrutura segura de documentos.</span>
          </div>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.aceite_lgpd}
              onChange={(event) => updateField('aceite_lgpd', event.target.checked)}
              required
            />
            <span>
              Declaro ciência de que as informações fornecidas serão utilizadas pela SMAD para análise, triagem e
              encaminhamento da demanda, conforme a legislação aplicável.
            </span>
          </label>

          <div style={styles.actions}>
            <button type="submit" style={styles.primaryButton} className="sigma-public-button" disabled={sending}>
              {sending ? 'Registrando...' : 'Registrar comunicação'}
            </button>
            <button type="button" style={styles.secondaryButton} className="sigma-public-button" onClick={onOpenPublico}>
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
    background: 'linear-gradient(180deg, #eef6ff 0%, #ffffff 48%, #effaf2 100%)',
    color: '#0d1b3d',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '18px',
    padding: '16px clamp(16px, 4vw, 32px)',
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
    minWidth: 0,
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
    padding: 'clamp(42px, 7vw, 58px) 0 26px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
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
    margin: '0 0 10px',
    color: '#0d1b3d',
    fontSize: '28px',
  },
  sectionText: {
    margin: '0 0 18px',
    color: '#5f6f83',
    lineHeight: 1.55,
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
    gap: '14px',
  },
  categoryCard: {
    minHeight: '150px',
    display: 'grid',
    gap: '8px',
    alignContent: 'start',
    border: '1px solid #d8e5f2',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#0d1b3d',
    cursor: 'pointer',
    padding: '18px',
    textAlign: 'left',
    boxShadow: '0 12px 26px rgba(13, 63, 143, 0.06)',
  },
  categoryCardActive: {
    borderColor: '#176a36',
    boxShadow: '0 14px 30px rgba(23, 106, 54, 0.14)',
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
    minHeight: '140px',
    border: '1px solid #cfe0f5',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#172033',
    padding: '10px 12px',
    fontSize: '14px',
    resize: 'vertical',
  },
  attachmentsBox: {
    display: 'grid',
    gap: '4px',
    border: '1px dashed #cfe0f5',
    borderRadius: '8px',
    background: '#f8fbff',
    color: '#5f6f83',
    padding: '14px',
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
  confirmation: {
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    background: '#f0fdf4',
    color: '#166534',
    padding: '18px',
    marginBottom: '16px',
  },
  confirmationTitle: {
    margin: '0 0 8px',
    color: '#0d1b3d',
  },
};
