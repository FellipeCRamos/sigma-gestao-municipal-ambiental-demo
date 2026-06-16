import { useEffect, useMemo, useState } from 'react';
import {
  getPublicLicenciamentoAtividades,
  getPublicLicenciamentoNormas,
  simulatePublicLicenciamento,
} from '../services/licenciamentoAdminApi';
import {
  getPublicLicenciamentoAvisosNormativos,
  getPublicLicenciamentoLegislacao,
} from '../services/licenciamentoGovernancaApi';
import AssistenteEnquadramentoAmbiental from '../components/assistente/AssistenteEnquadramentoAmbiental';
import ModoTecnicoAvancado from '../components/assistente/ModoTecnicoAvancado';

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #eef6ff 0%, #ffffff 42%, #edf8f1 100%)',
    color: '#0d1b3d',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 18,
    padding: '18px clamp(18px, 5vw, 64px)',
    background: 'rgba(255, 255, 255, 0.94)',
    borderBottom: '1px solid #dbe8f6',
    boxShadow: '0 10px 30px rgba(13, 27, 61, 0.08)',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontWeight: 900,
    fontSize: 18,
  },
  brandSub: {
    color: '#51708f',
    fontSize: 13,
    fontWeight: 700,
  },
  actions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  buttonPrimary: {
    minHeight: 44,
    borderRadius: 8,
    border: '1px solid #0f7a3b',
    background: 'linear-gradient(180deg, #1ca353 0%, #0f7a3b 100%)',
    color: '#ffffff',
    fontWeight: 850,
    padding: '0 16px',
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(15, 122, 59, 0.2)',
  },
  buttonSecondary: {
    minHeight: 44,
    borderRadius: 8,
    border: '1px solid #bdd3ec',
    background: '#ffffff',
    color: '#0d3f8f',
    fontWeight: 800,
    padding: '0 16px',
    cursor: 'pointer',
  },
  main: {
    width: 'min(1180px, calc(100% - 32px))',
    margin: '0 auto',
    padding: '34px 0 48px',
    display: 'grid',
    gap: 22,
  },
  hero: {
    display: 'grid',
    gap: 24,
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #ffffff 0%, #f2f7ff 55%, #eaf8f0 100%)',
    border: '1px solid #d8e8f6',
    borderRadius: 8,
    padding: 'clamp(22px, 4vw, 42px)',
    boxShadow: '0 20px 48px rgba(13, 63, 143, 0.1)',
  },
  eyebrow: {
    display: 'inline-flex',
    width: 'fit-content',
    padding: '7px 11px',
    borderRadius: 999,
    border: '1px solid #bde7cc',
    background: '#edf9f1',
    color: '#0f7a3b',
    fontWeight: 850,
    fontSize: 13,
  },
  title: {
    margin: '14px 0 12px',
    fontSize: 42,
    lineHeight: 1.02,
    letterSpacing: 0,
  },
  lead: {
    margin: 0,
    color: '#445a76',
    fontSize: 17,
    lineHeight: 1.55,
    maxWidth: 690,
  },
  heroPanel: {
    borderRadius: 8,
    background: '#ffffff',
    border: '1px solid #d8e8f6',
    padding: 20,
    display: 'grid',
    gap: 12,
  },
  section: {
    background: '#ffffff',
    border: '1px solid #d8e8f6',
    borderRadius: 8,
    padding: 'clamp(18px, 3vw, 28px)',
    boxShadow: '0 16px 36px rgba(13, 63, 143, 0.08)',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.2,
  },
  sectionText: {
    color: '#516984',
    lineHeight: 1.55,
    margin: '8px 0 0',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))',
    gap: 14,
    marginTop: 18,
  },
  label: {
    display: 'grid',
    gap: 6,
    fontSize: 13,
    fontWeight: 800,
    color: '#0d1b3d',
  },
  input: {
    width: '100%',
    minHeight: 44,
    borderRadius: 8,
    border: '1px solid #bdd3ec',
    padding: '10px 12px',
    fontSize: 14,
    color: '#172033',
    background: '#ffffff',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    minHeight: 44,
    border: '1px solid #d8e8f6',
    borderRadius: 8,
    padding: '10px 12px',
    background: '#f8fbff',
    color: '#20324b',
    fontWeight: 750,
  },
  message: {
    borderRadius: 8,
    border: '1px solid #d8e8f6',
    background: '#f8fbff',
    padding: 14,
    color: '#20324b',
    fontWeight: 700,
  },
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
    gap: 12,
    marginTop: 16,
  },
  resultCard: {
    border: '1px solid #e2edf8',
    borderRadius: 8,
    padding: 14,
    background: '#f8fbff',
  },
  resultLabel: {
    color: '#516984',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
  },
  resultValue: {
    margin: '6px 0 0',
    fontSize: 18,
    fontWeight: 900,
    color: '#0d1b3d',
  },
  list: {
    margin: '12px 0 0',
    paddingLeft: 20,
    color: '#20324b',
    lineHeight: 1.55,
  },
};

function formatMoney(value) {
  if (value === null || value === undefined) return '-';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function taxaText(taxa) {
  if (!taxa) return '-';
  if (taxa.status === 'estimada') return taxa.valor_total_formatado || formatMoney(taxa.valor_total || taxa.valor);
  if (taxa.status === 'formula_pendente') return 'Fórmula pendente de validação';
  if (taxa.status === 'vrte_nao_parametrizada') return 'VRTE não parametrizada';
  if (taxa.status === 'regra_inconsistente') return 'Regra de taxa inconsistente';
  return 'Taxa não parametrizada';
}

function normalizeActivityLabel(activity) {
  if (!activity) return '';
  return activity.codigo ? `${activity.codigo} - ${activity.nome}` : activity.nome;
}

export default function LicenciamentoPublico({ onOpenAdmin, onOpenPainelPublico, onOpenPortal }) {
  const [atividades, setAtividades] = useState([]);
  const [normas, setNormas] = useState([]);
  const [legislacao, setLegislacao] = useState([]);
  const [avisosNormativos, setAvisosNormativos] = useState([]);
  const [form, setForm] = useState({
    atividade_id: '',
    valor_parametro: '',
    parametros_informados: {},
    respostas_condicionais: {},
    parametro_unidade: '',
    tipo_pessoa: 'juridica',
    tipo_imovel: 'urbano',
    possui_intervencao_app: false,
    possui_supressao_vegetacao: false,
    possui_uso_recursos_hidricos: false,
    gera_residuos: false,
    nome_interessado: '',
    email_interessado: '',
    telefone_interessado: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [activityFilters, setActivityFilters] = useState({
    grupo: '',
    busca: '',
  });

  const activityGroups = useMemo(() => {
    const groups = new Map();
    atividades.forEach((item) => {
      const grupo = String(item.codigo || '').split('.')[0];
      if (grupo) groups.set(grupo, `${grupo} - ${item.categoria || 'Grupo'}`);
    });
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [atividades]);

  const filteredActivities = useMemo(() => {
    const query = activityFilters.busca.trim().toLowerCase();
    return atividades.filter((item) => {
      const grupo = String(item.codigo || '').split('.')[0];
      const matchesGrupo = !activityFilters.grupo || grupo === activityFilters.grupo;
      const matchesQuery = !query
        || String(item.codigo || '').toLowerCase().includes(query)
        || String(item.nome || '').toLowerCase().includes(query)
        || String(item.categoria || '').toLowerCase().includes(query);
      return matchesGrupo && matchesQuery;
    });
  }, [atividades, activityFilters]);

  const selectedActivity = useMemo(
    () => atividades.find((item) => String(item.id) === String(form.atividade_id)),
    [atividades, form.atividade_id]
  );
  const compositeParams = selectedActivity?.parametros_regras || [];
  const publicQuestions = selectedActivity?.perguntas_publicas || [];

  useEffect(() => {
    if (!filteredActivities.length) return;
    if (filteredActivities.some((item) => String(item.id) === String(form.atividade_id))) return;
    const next = filteredActivities[0];
    setForm((current) => ({
      ...current,
      atividade_id: next.id,
      parametro_unidade: next.unidade_parametro_principal || '',
      valor_parametro: '',
      parametros_informados: {},
      respostas_condicionais: {},
    }));
  }, [filteredActivities, form.atividade_id]);

  useEffect(() => {
    async function load() {
      try {
        const [activitiesResponse, normasResponse, legislacaoResponse, avisosResponse] = await Promise.all([
          getPublicLicenciamentoAtividades(),
          getPublicLicenciamentoNormas(),
          getPublicLicenciamentoLegislacao(),
          getPublicLicenciamentoAvisosNormativos(),
        ]);
        const loadedActivities = activitiesResponse.data || [];
        setAtividades(loadedActivities);
        setNormas(normasResponse.data || []);
        setLegislacao(legislacaoResponse.data || []);
        setAvisosNormativos(avisosResponse.data || []);

        if (loadedActivities.length > 0) {
          setForm((current) => ({
            ...current,
            atividade_id: current.atividade_id || loadedActivities[0].id,
            parametro_unidade: current.parametro_unidade || loadedActivities[0].unidade_parametro_principal || '',
          }));
        }
      } catch (error) {
        setMessage(error.message || 'Não foi possível carregar a área pública do Licenciamento.');
      }
    }

    load();
  }, []);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateParametro(chave, value) {
    setForm((current) => ({
      ...current,
      parametros_informados: {
        ...current.parametros_informados,
        [chave]: value,
      },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setResult(null);

    try {
      const response = await simulatePublicLicenciamento(form);
      setResult(response.data);
      setMessage('Simulação registrada com sucesso. Guarde o protocolo para eventual atendimento futuro.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível simular o enquadramento.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <span>Licenciamento Ambiental</span>
          <span style={styles.brandSub}>SMAD / Plataforma SIGMA</span>
        </div>
        <div style={styles.actions}>
          <button type="button" onClick={onOpenPainelPublico} style={styles.buttonSecondary}>
            Painel Público SIGMA
          </button>
          <button type="button" onClick={onOpenPortal} style={styles.buttonSecondary}>
            Portal do Requerente
          </button>
          <button type="button" onClick={onOpenAdmin} style={styles.buttonPrimary}>
            Acesso interno SMAD
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.hero}>
          <div>
            <span style={styles.eyebrow}>Resultado preliminar, sujeito à validação técnica</span>
            <h1 style={styles.title}>Assistente de enquadramento ambiental</h1>
            <p style={styles.lead}>
              Descreva o que pretende fazer em linguagem simples. O sistema identifica uma atividade provavel,
              abre perguntas orientadas e gera uma orientacao preliminar para iniciar o requerimento.
            </p>
            <div style={{ ...styles.actions, marginTop: 22 }}>
              <button type="button" onClick={() => document.getElementById('assistente-enquadramento')?.scrollIntoView({ behavior: 'smooth' })} style={styles.buttonPrimary}>
                Analisar com assistente ambiental
              </button>
              <button type="button" onClick={onOpenPortal} style={styles.buttonSecondary}>
                Portal do Requerente
              </button>
            </div>
          </div>

          <div style={styles.heroPanel}>
            <strong>Importante</strong>
            <p style={styles.sectionText}>
              Este módulo fornece orientação preliminar sobre enquadramento ambiental. O resultado da simulação não
              substitui a análise técnica da SMAD e não constitui licença, dispensa, autorização, decisão
              administrativa ou cobrança oficial.
            </p>
          </div>
        </section>

        <AssistenteEnquadramentoAmbiental />

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Legislação Ambiental Municipal</h2>
          <p style={styles.sectionText}>
            Consulte a base normativa municipal vinculada ao Licenciamento Ambiental. As informações abaixo têm
            finalidade institucional e não substituem a leitura da publicação oficial.
          </p>
          {avisosNormativos.length ? (
            <div style={{ ...styles.message, marginTop: 16 }}>
              Atenção: a tabela ou matriz normativa aplicável está sujeita à validação administrativa. O valor
              apresentado no simulador não constitui cobrança oficial.
            </div>
          ) : null}
          <div style={styles.resultGrid}>
            {legislacao.length ? legislacao.map((norma) => (
              <div key={norma.codigo} style={styles.resultCard}>
                <span style={styles.resultLabel}>{norma.tipo_norma || norma.tipo || 'Norma'}</span>
                <p style={styles.resultValue}>{norma.titulo}</p>
                <p style={styles.sectionText}>{norma.ementa || 'Resumo institucional em parametrizacao.'}</p>
                <p style={styles.sectionText}>
                  Situacao: <strong>{norma.status_normativo || 'Em validacao'}</strong>
                </p>
                {norma.fonte_url ? (
                  <a href={norma.fonte_url} target="_blank" rel="noreferrer">Abrir fonte oficial</a>
                ) : (
                  <p style={styles.sectionText}>Fonte digital pendente de cadastro.</p>
                )}
              </div>
            )) : (
              <div style={styles.message}>Biblioteca de legislacao em parametrizacao.</div>
            )}
          </div>
        </section>

        <ModoTecnicoAvancado styles={styles}>
          <h2 style={styles.sectionTitle}>Simulação pública</h2>
          <p style={styles.sectionText}>
            Informe a atividade e os parâmetros conhecidos. Não é necessário login, Documento ou cadastro para realizar esta
            simulação preliminar.
          </p>
          <p style={styles.sectionText}>
            Os valores exibidos são estimativos, calculados em VRTE para fins de orientação. A cobrança oficial dependerá
            da validação administrativa, da norma aplicável, da VRTE vigente e da emissão do documento próprio pela SMAD.
          </p>

          {message ? <div style={{ ...styles.message, marginTop: 16 }}>{message}</div> : null}

          {atividades.length === 0 ? (
            <div style={{ ...styles.message, marginTop: 16 }}>
              Ainda não há atividades licenciáveis parametrizadas para simulação pública. A SMAD poderá habilitar esta
              base na área interna do Licenciamento.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Filtrar por grupo
                  <select
                    value={activityFilters.grupo}
                    onChange={(event) => setActivityFilters((current) => ({ ...current, grupo: event.target.value }))}
                    style={styles.input}
                  >
                    <option value="">Todos os grupos</option>
                    {activityGroups.map(([grupo, label]) => (
                      <option key={grupo} value={grupo}>{label}</option>
                    ))}
                  </select>
                </label>
                <label style={styles.label}>
                  Buscar por código ou palavra-chave
                  <input
                    value={activityFilters.busca}
                    onChange={(event) => setActivityFilters((current) => ({ ...current, busca: event.target.value }))}
                    placeholder="Ex.: 18.06, resíduos, combustíveis"
                    style={styles.input}
                  />
                </label>
              </div>
              {filteredActivities.length === 0 ? (
                <div style={{ ...styles.message, marginTop: 16 }}>
                  Nenhuma atividade encontrada para os filtros informados.
                </div>
              ) : null}
              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Atividade
                  <select
                    value={form.atividade_id}
                    onChange={(event) => {
                      const next = atividades.find((item) => String(item.id) === event.target.value);
                      setForm((current) => ({
                        ...current,
                        atividade_id: event.target.value,
                        parametro_unidade: next?.unidade_parametro_principal || '',
                        parametros_informados: {},
                        respostas_condicionais: {},
                      }));
                    }}
                    required
                    style={styles.input}
                  >
                    {filteredActivities.map((atividade) => (
                      <option key={atividade.id} value={atividade.id}>{normalizeActivityLabel(atividade)}</option>
                    ))}
                  </select>
                </label>

                {compositeParams.length === 0 ? (
                  <label style={styles.label}>
                    {selectedActivity?.parametro_principal_label || 'Parâmetro principal'}
                    {selectedActivity?.unidade_parametro_principal ? ` (${selectedActivity.unidade_parametro_principal})` : ''}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.valor_parametro}
                      onChange={(event) => updateField('valor_parametro', event.target.value)}
                      required
                      style={styles.input}
                    />
                  </label>
                ) : compositeParams.map((parametro) => (
                  <label key={parametro.parametro_chave} style={styles.label}>
                    {parametro.parametro_label}
                    {parametro.parametro_unidade ? ` (${parametro.parametro_unidade})` : ''}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.parametros_informados[parametro.parametro_chave] || ''}
                      onChange={(event) => updateParametro(parametro.parametro_chave, event.target.value)}
                      required={parametro.obrigatorio}
                      placeholder={parametro.parametro_unidade || 'valor'}
                      style={styles.input}
                    />
                  </label>
                ))}

                <label style={styles.label}>
                  Unidade
                  <input
                    value={form.parametro_unidade}
                    onChange={(event) => updateField('parametro_unidade', event.target.value)}
                    placeholder={selectedActivity?.unidade_parametro_principal || 'm2, ha, unidade...'}
                    style={styles.input}
                  />
                </label>

                <label style={styles.label}>
                  Tipo de pessoa
                  <select value={form.tipo_pessoa} onChange={(event) => updateField('tipo_pessoa', event.target.value)} style={styles.input}>
                    <option value="juridica">Pessoa jurídica</option>
                    <option value="fisica">Pessoa física</option>
                  </select>
                </label>

                <label style={styles.label}>
                  Tipo de imóvel
                  <select value={form.tipo_imovel} onChange={(event) => updateField('tipo_imovel', event.target.value)} style={styles.input}>
                    <option value="urbano">Urbano</option>
                    <option value="rural">Rural</option>
                  </select>
                </label>

                <label style={styles.label}>
                  Nome do interessado (opcional)
                  <input value={form.nome_interessado} onChange={(event) => updateField('nome_interessado', event.target.value)} style={styles.input} />
                </label>

                <label style={styles.label}>
                  E-mail (opcional)
                  <input type="email" value={form.email_interessado} onChange={(event) => updateField('email_interessado', event.target.value)} style={styles.input} />
                </label>

                <label style={styles.label}>
                  Telefone (opcional)
                  <input value={form.telefone_interessado} onChange={(event) => updateField('telefone_interessado', event.target.value)} style={styles.input} />
                </label>
              </div>

              <div style={styles.formGrid}>
                {publicQuestions.map((question) => (
                  <label key={question.chave} style={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.respostas_condicionais[question.chave])}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          respostas_condicionais: {
                            ...current.respostas_condicionais,
                            [question.chave]: event.target.checked,
                          },
                        }));
                      }}
                    />
                    {question.label}
                  </label>
                ))}
                {[
                  ['possui_intervencao_app', 'Há intervenção em APP?'],
                  ['possui_supressao_vegetacao', 'Há supressão de vegetação?'],
                  ['possui_uso_recursos_hidricos', 'Há uso de recursos hídricos?'],
                  ['gera_residuos', 'Há geração de resíduos?'],
                ].map(([field, label]) => (
                  <label key={field} style={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={Boolean(form[field])}
                      onChange={(event) => updateField(field, event.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div style={{ ...styles.actions, marginTop: 18 }}>
                <button type="submit" disabled={loading} style={styles.buttonPrimary}>
                  {loading ? 'Simulando...' : 'Simular enquadramento'}
                </button>
              </div>
            </form>
          )}
        </ModoTecnicoAvancado>

        {result ? (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Resultado preliminar</h2>
            <p style={styles.sectionText}>{result.mensagem_institucional}</p>

            <div style={styles.resultGrid}>
              {[
                ['Protocolo', result.protocolo_simulacao],
                ['Atividade', normalizeActivityLabel(result.atividade)],
                ['Tipo de atividade', result.atividade?.tipo_atividade || 'Não informado'],
                ['Status', result.status_resultado || 'Preliminar'],
                ['Índice calculado', result.indice_calculado ?? 'Não aplicável'],
                ['Tipo indicado', result.tipo_licenca_sugerida?.nome || 'Não identificado'],
                ['Classe', result.classe_sugerida?.nome || 'Não identificada'],
                ['Potencial poluidor', result.potencial_poluidor?.nome || 'Não identificado'],
                ['Porte estimado', result.porte_estimado || 'Não identificado'],
                ['Dispensa possível', result.dispensa_possivel ? 'Indicação preliminar de possível dispensa' : 'Não indicada'],
                ['Taxa estimativa', taxaText(result.taxa)],
                ['Memória da taxa', result.taxa?.memoria_calculo || result.taxa?.observacao || 'Não disponível'],
              ].map(([label, value]) => (
                <div key={label} style={styles.resultCard}>
                  <span style={styles.resultLabel}>{label}</span>
                  <p style={styles.resultValue}>{value}</p>
                </div>
              ))}
            </div>

            {result.resultado_resumo ? (
              <div style={{ ...styles.message, marginTop: 16 }}>{result.resultado_resumo}</div>
            ) : null}

            {result.parametros_informados && Object.keys(result.parametros_informados).length ? (
              <div style={{ marginTop: 16 }}>
                <h3>Parâmetros informados</h3>
                <ul style={styles.list}>
                  {Object.entries(result.parametros_informados).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}</strong>: {String(value)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.taxa?.status === 'estimada' ? (
              <div style={{ ...styles.message, marginTop: 16 }}>
                Taxa estimada conforme quantidade de VRTE cadastrada e valor da VRTE vigente no sistema. A cobrança
                definitiva dependerá da validação do enquadramento pela SMAD.
              </div>
            ) : null}

            {result.taxa?.aviso_normativo || result.taxa?.tabela_taxa_status === 'operacional_piloto' ? (
              <div style={{ ...styles.message, marginTop: 16, borderColor: '#f4c56a', background: '#fff8e7' }}>
                Valor estimado para fins de orientação. A cobrança oficial dependerá de validação administrativa,
                norma aplicável, VRTE vigente e emissão do documento próprio pela SMAD. Taxa estimada com base em
                tabela operacional em conferência. Não constitui cobrança oficial.
              </div>
            ) : null}

            <div style={styles.resultGrid}>
              <div>
                <h3>Documentos indicados</h3>
                {result.documentos_exigidos?.length ? (
                  <ul style={styles.list}>
                    {result.documentos_exigidos.map((doc) => (
                      <li key={doc.id}>
                        <strong>{doc.nome_documento}</strong>
                        {doc.obrigatorio ? ' - obrigatório' : ' - complementar'}
                        {doc.exige_art_rrt ? ' - exige ART/RRT' : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={styles.sectionText}>Nenhum documento específico parametrizado para este resultado.</p>
                )}
              </div>

              <div>
                <h3>Alertas</h3>
                {[...(result.alertas || []), ...(result.alertas_tecnicos || []), ...(result.bloqueios || []).map((item) => item.message)].length ? (
                  <ul style={styles.list}>
                    {[...(result.alertas || []), ...(result.alertas_tecnicos || []), ...(result.bloqueios || []).map((item) => item.message)]
                      .filter(Boolean)
                      .map((alerta) => <li key={alerta}>{alerta}</li>)}
                  </ul>
                ) : (
                  <p style={styles.sectionText}>Nenhum alerta adicional informado pelas respostas.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Normas e orientações</h2>
          <p style={styles.sectionText}>
            As normas relacionadas serão exibidas conforme parametrização interna da SMAD. Quando houver link público,
            consulte sempre a versão oficial do órgão competente.
          </p>
          {normas.length ? (
            <ul style={styles.list}>
              {normas.slice(0, 6).map((norma) => (
                <li key={norma.id}>
                  <strong>{norma.titulo}</strong>
                  {norma.ano ? ` (${norma.ano})` : ''}
                  {norma.link_url ? <> - <a href={norma.link_url} target="_blank" rel="noreferrer">abrir referência</a></> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p style={styles.sectionText}>Biblioteca normativa em parametrização.</p>
          )}
        </section>
      </main>
    </div>
  );
}
