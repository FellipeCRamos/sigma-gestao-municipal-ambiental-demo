import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCampanhaInscricao,
  createMinhaOcorrencia,
  downloadMeuDocumentoCampanha,
  getCampanhas,
  getPortalTutorAnimalDetalhe,
  getPortalTutorCarteiraDetalhada,
  getPortalTutorDocumentos,
  getPortalTutorInscricaoDetalhe,
  getPortalTutorNotificacoes,
  getPortalTutorOcorrenciaDetalhe,
  getPortalTutorPreferencias,
  getPortalTutorResumo,
  getPublicTerritorios,
  loginUsuarioExterno,
  markNotificacaoLida,
  markTodasNotificacoesLidas,
  registerPortalTutorPushSubscription,
  registerUsuarioExterno,
  requestPasswordResetExterno,
  resetPasswordExterno,
  revokePortalTutorPushSubscription,
  sendPortalTutorPushTeste,
  updatePortalTutorPreferencias,
  uploadDocumentoCampanha,
} from '../services/api';
import {
  CAMPAIGN_STATUS_LABELS as STATUS_LABELS,
  OCCURRENCE_STATUS_LABELS as OCORRENCIA_STATUS_LABELS,
  OCCURRENCE_TYPE_LABELS as OCORRENCIA_TIPO_LABELS,
  SERVICE_LABELS as SERVICO_LABELS,
  VACCINE_ORIGIN_LABELS as VACINA_ORIGEM_LABELS,
  VACCINE_STATUS_LABELS as VACINA_STATUS_LABELS,
} from '../utils/displayLabels';
import {
  PortalTutorAnimalsSection,
  PortalTutorAsideSection,
  PortalTutorAuthSection,
  PortalTutorCampaignBanner,
  PortalTutorCarteiraSection,
  PortalTutorDetailPanel,
  PortalTutorDocumentsSection,
  PortalTutorHubSection,
  PortalTutorInscricaoSection,
  PortalTutorPreferencesSection,
} from './portalTutor/PortalTutorSections';
import { styles } from './portalTutor/styles';

const INITIAL_REGISTER = {
  nome: '',
  cpf: '',
  email: '',
  telefone: '',
  endereco: '',
  senha: '',
  aceite_governanca: false,
};

const INITIAL_LOGIN = {
  email: '',
  senha: '',
};

const INITIAL_RESET = {
  email: '',
  token: '',
  nova_senha: '',
};

function getResetTokenFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('reset_token') || '';
  } catch {
    return '';
  }
}

const INITIAL_FORM = {
  campanha_id: '',
  criterio_prioridade: '',
  prioridade_detalhes: '',
  servico_desejado: 'castracao_microchipagem',
  animal_nome: '',
  territorio_id: '',
  bairro: '',
  animal_endereco: '',
  animal_especie: 'canino',
  animal_raca: '',
  animal_sexo: 'femea',
  idade_aproximada: '',
  peso_kg: '',
  condicoes_saude: [],
  condicao_femea: 'nao_se_aplica',
  cirurgia_anterior: false,
  agressivo: false,
  microchip: '',
  localizacao_perda: '',
  carteira_vacinacao: '',
  declaracoes: [],
};

const INITIAL_OCCURRENCE = {
  tipo: 'perda',
  titulo: '',
  descricao: '',
  territorio_id: '',
  bairro: '',
  endereco_referencia: '',
  contato_nome: '',
  contato_telefone: '',
  contato_email: '',
};

const INITIAL_PREFERENCES = {
  portal: true,
  email: false,
  web_push: false,
  campanhas: true,
  inscricoes: true,
  ocorrencias: true,
  carteira_vacinal: true,
  operacional_essencial: true,
};

const INITIAL_VACCINE_FILTERS = {
  vacina: '',
  origem: '',
  status: '',
  data_inicio: '',
  data_fim: '',
};

const HEALTH_OPTIONS = [
  { value: 'doente', label: 'Esta doente' },
  { value: 'tratamento_veterinario', label: 'Em tratamento veterinário' },
  { value: 'feridas_lesoes', label: 'Possui feridas ou lesões' },
  { value: 'debilitado', label: 'Muito magro ou debilitado' },
  { value: 'nenhuma', label: 'Nenhuma das opções' },
];

const TERMS = [
  { value: 'responsavel_animal', label: 'Sou responsável pelo animal informado' },
  { value: 'informacoes_verdadeiras', label: 'As informações prestadas são verdadeiras' },
  { value: 'cadastro_nao_garante_vaga', label: 'Estou ciente de que o cadastro não garante vaga' },
  { value: 'autoriza_contato', label: 'Autorizo o contato da equipe da SMAD' },
  { value: 'autoriza_uso_dados', label: 'Autorizo o uso dos dados para fins da campanha' },
  { value: 'ciente_triagem', label: 'Estou ciente de que o animal passará por avaliação' },
];

const OCORRENCIAS_ENCERRADAS = ['resolvida', 'concluida', 'cancelada', 'arquivada'];

function parseStoredSession() {
  try {
    const raw = localStorage.getItem('sigbaTutorPortal');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function toggleArrayItem(current, value, checked) {
  if (checked) {
    return current.includes(value) ? current : [...current, value];
  }

  return current.filter((item) => item !== value);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildDocumentosFromInscricoes(inscricoes = []) {
  return inscricoes
    .flatMap((inscriao) => {
      const documentos = Array.isArray(inscriao.documentos) ? inscriao.documentos : [];

      return documentos.map((documento) => ({
        ...documento,
        contexto_tipo: 'campanha_inscriao',
        contexto_id: inscriao.id,
        inscriao_id: inscriao.id,
        protocolo: inscriao.protocolo,
        campanha_nome: inscriao.campanha_nome,
        animal_nome: inscriao.animal_nome,
        status_inscriao: inscriao.status,
      }));
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function PortalTutor({ onOpenAdmin, onOpenPublico }) {
  const [campanhas, setCampanhas] = useState([]);
  const [territorios, setTerritorios] = useState([]);
  const [session, setSession] = useState(() => parseStoredSession());
  const initialResetToken = getResetTokenFromUrl();
  const [authMode, setAuthMode] = useState(() => (initialResetToken ? 'login' : 'register'));
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER);
  const [loginForm, setLoginForm] = useState(INITIAL_LOGIN);
  const [resetForm, setResetForm] = useState(() => ({
    ...INITIAL_RESET,
    token: initialResetToken,
  }));
  const [showReset, setShowReset] = useState(() => Boolean(initialResetToken));
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [animaisMobile, setAnimaisMobile] = useState([]);
  const [minhasInscricoes, setMinhasInscricoes] = useState([]);
  const [documentosPorInscricao, setDocumentosPorInscricao] = useState({});
  const [documentosTutor, setDocumentosTutor] = useState([]);
  const [carteirasPorAnimal, setCarteirasPorAnimal] = useState({});
  const [notificacoes, setNotificacoes] = useState([]);
  const [notificacaoFiltro, setNotificacaoFiltro] = useState('');
  const [notificacaoResumo, setNotificacaoResumo] = useState(null);
  const [notificacaoLoading, setNotificacaoLoading] = useState(false);
  const [notificacaoMessage, setNotificacaoMessage] = useState('');
  const [ocorrencias, setOcorrencias] = useState([]);
  const [ocorrenciaForm, setOcorrenciaForm] = useState(INITIAL_OCCURRENCE);
  const [ocorrenciaMessage, setOcorrenciaMessage] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [installPrompt, setInstallPrompt] = useState(null);
  const [pwaUpdateReady, setPwaUpdateReady] = useState(false);
  const [detailView, setDetailView] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedCarteiraAnimalId, setSelectedCarteiraAnimalId] = useState('');
  const [vaccineFilters, setVaccineFilters] = useState(INITIAL_VACCINE_FILTERS);
  const [carteiraDetalhada, setCarteiraDetalhada] = useState(null);
  const [carteiraLoading, setCarteiraLoading] = useState(false);
  const [carteiraError, setCarteiraError] = useState('');
  const [preferences, setPreferences] = useState(INITIAL_PREFERENCES);
  const [preferencesMeta, setPreferencesMeta] = useState(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState('');
  const [preferencesError, setPreferencesError] = useState('');
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState('');

  const activeCampanha = useMemo(() => campanhas[0], [campanhas]);

  const territorioOptions = useMemo(
    () =>
      territorios.map((territorio) => ({
        value: String(territorio.id),
        label: territorio.categoria
          ? `${territorio.nome} (${territorio.categoria})`
          : territorio.nome,
        nome: territorio.nome,
      })),
    [territorios]
  );

  const portalResumo = useMemo(() => {
    const notificacoesNaoLidas = notificacoes.filter(
      (notificacao) => notificacao.status !== 'lida'
    ).length;
    const ocorrenciasAtivas = ocorrencias.filter(
      (ocorrencia) => !OCORRENCIAS_ENCERRADAS.includes(ocorrencia.status)
    ).length;
    const animaisVinculados =
      animaisMobile.length || Object.values(carteirasPorAnimal).filter(Boolean).length;

    return {
      inscricoes: minhasInscricoes.length,
      animaisVinculados,
      notificacoesNaoLidas,
      ocorrenciasAtivas,
      documentos: documentosTutor.length,
    };
  }, [animaisMobile.length, carteirasPorAnimal, documentosTutor.length, minhasInscricoes.length, notificacoes, ocorrencias]);

  const loadMinhasInscricoes = useCallback(async (currentSession) => {
    if (!currentSession?.token) return;
    setPortalLoading(true);
    setPortalError('');

    try {
      const response = await getPortalTutorResumo(currentSession.token);
      const data = response?.data || {};
      const inscricoes = Array.isArray(data.inscricoes) ? data.inscricoes : [];

      setAnimaisMobile(Array.isArray(data.animais) ? data.animais : []);
      setMinhasInscricoes(inscricoes);
      setDocumentosPorInscricao(data.documentos_por_inscricao || data.documentos_por_inscriao || {});
      setDocumentosTutor(
        Array.isArray(data.documentos) ? data.documentos : buildDocumentosFromInscricoes(inscricoes)
      );
      setCarteirasPorAnimal(data.carteiras_por_animal || {});
      setNotificacoes(Array.isArray(data.notificacoes) ? data.notificacoes : []);
      setOcorrencias(Array.isArray(data.ocorrencias) ? data.ocorrencias : []);
      setLastSyncAt(data.resumo?.atualizado_em || new Date().toISOString());
    } catch (error) {
      setPortalError(error.message || 'Não foi possível atualizar seus dados agora.');
    } finally {
      setPortalLoading(false);
    }
  }, []);

  const loadPreferencias = useCallback(async (currentSession) => {
    if (!currentSession?.token) return;

    try {
      const response = await getPortalTutorPreferencias(currentSession.token);
      const data = response?.data || {};
      setPreferences({ ...INITIAL_PREFERENCES, ...(data.preferencias || {}) });
      setPreferencesMeta(data.web_push || null);
      setPreferencesError('');
    } catch (error) {
      setPreferencesError(error.message || 'Não foi possível carregar preferências.');
    }
  }, []);

  const loadNotificacoes = useCallback(async (currentSession, status = notificacaoFiltro) => {
    if (!currentSession?.token) return;

    try {
      setNotificacaoLoading(true);
      const response = await getPortalTutorNotificacoes(currentSession.token, { status, limit: 100 });
      const data = response?.data || {};
      setNotificacoes(Array.isArray(data.notificacoes) ? data.notificacoes : []);
      setNotificacaoResumo(data.resumo || null);
      setUploadError('');
    } catch (error) {
      setUploadError(error.message || 'Não foi possível carregar notificações.');
    } finally {
      setNotificacaoLoading(false);
    }
  }, [notificacaoFiltro]);

  useEffect(() => {
    async function loadCampanhas() {
      const [response, territoriosResponse] = await Promise.all([
        getCampanhas(),
        getPublicTerritorios().catch(() => ({ data: [] })),
      ]);
      const data = Array.isArray(response?.data) ? response.data : [];
      setCampanhas(data);
      setTerritorios(Array.isArray(territoriosResponse?.data) ? territoriosResponse.data : []);

      if (data[0]?.id) {
        setForm((prev) => ({
          ...prev,
          campanha_id: prev.campanha_id || String(data[0].id),
        }));
      }
    }

    loadCampanhas();
  }, []);

  useEffect(() => {
    if (session?.token) {
      loadMinhasInscricoes(session);
      loadPreferencias(session);
      loadNotificacoes(session, notificacaoFiltro);
    }
  }, [loadMinhasInscricoes, loadNotificacoes, loadPreferencias, notificacaoFiltro, session]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    function handleInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handlePwaUpdateReady() {
      setPwaUpdateReady(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('sigba:pwa-update-ready', handlePwaUpdateReady);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('sigba:pwa-update-ready', handlePwaUpdateReady);
    };
  }, []);

  function handleChange(setter) {
    return (event) => {
      const { name, value, type, checked } = event.target;
      setter((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
      setAuthError('');
      setAuthMessage('');
    };
  }

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setFormError('');
    setFormMessage('');
  }

  function handleTerritorioFormChange(event) {
    const { value } = event.target;
    const selected = territorioOptions.find((option) => option.value === value);

    setForm((prev) => ({
      ...prev,
      territorio_id: value,
      bairro: selected?.nome || prev.bairro,
    }));
    setFormError('');
    setFormMessage('');
  }

  function handleArrayChange(name, value, checked) {
    setForm((prev) => ({
      ...prev,
      [name]: toggleArrayItem(prev[name], value, checked),
    }));
    setFormError('');
  }

  function persistSession(nextSession) {
    localStorage.setItem('sigbaTutorPortal', JSON.stringify(nextSession));
    setSession(nextSession);
  }

  async function handleRegister(event) {
    event.preventDefault();
    try {
      setAuthLoading(true);
      const response = await registerUsuarioExterno(registerForm);
      persistSession(response.data);
      setRegisterForm(INITIAL_REGISTER);
    } catch (error) {
      setAuthError(error.message || 'Não foi possível criar sua conta.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRequestReset(event) {
    event.preventDefault();

    try {
      setAuthLoading(true);
      const response = await requestPasswordResetExterno({ email: resetForm.email });
      setAuthMessage(
        response.message || 'Se o e-mail estiver cadastrado, as instruções serão enviadas.'
      );
    } catch (error) {
      setAuthError(error.message || 'Não foi possível solicitar recuperação.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();

    try {
      setAuthLoading(true);
      const response = await resetPasswordExterno({
        token: resetForm.token,
        nova_senha: resetForm.nova_senha,
      });
      setResetForm(INITIAL_RESET);
      setAuthMessage(response.message || 'Senha redefinida com sucesso.');
    } catch (error) {
      setAuthError(error.message || 'Não foi possível redefinir a senha.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    try {
      setAuthLoading(true);
      const response = await loginUsuarioExterno(loginForm);
      persistSession(response.data);
      setLoginForm(INITIAL_LOGIN);
    } catch (error) {
      setAuthError(error.message || 'Não foi possível entrar.');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('sigbaTutorPortal');
    setSession(null);
    setAnimaisMobile([]);
    setMinhasInscricoes([]);
    setDocumentosPorInscricao({});
    setDocumentosTutor([]);
    setCarteirasPorAnimal({});
    setNotificacoes([]);
    setNotificacaoResumo(null);
    setNotificacaoFiltro('');
    setNotificacaoMessage('');
    setOcorrencias([]);
    setDetailView(null);
    setDetailData(null);
    setSelectedCarteiraAnimalId('');
    setCarteiraDetalhada(null);
    setPreferences(INITIAL_PREFERENCES);
    setPreferencesMeta(null);
  }

  function validateInscricao() {
    if (!form.campanha_id) return 'Selecione a campanha.';
    if (!form.animal_nome.trim()) return 'Informe o nome do animal.';
    if (!form.animal_raca.trim()) return 'Informe a raça.';
    if (!form.idade_aproximada.trim()) return 'Informe a idade apróximada.';
    if (!form.peso_kg || Number(form.peso_kg) <= 0) return 'Informe o peso apróximado.';
    if (form.declaracoes.length !== TERMS.length) return 'Confirme todas as declarações.';
    return '';
  }

  async function handleSubmitInscricao(event) {
    event.preventDefault();
    const validation = validateInscricao();

    if (validation) {
      setFormError(validation);
      return;
    }

    try {
      setFormLoading(true);
      await createCampanhaInscricao(session.token, {
        ...form,
        campanha_id: Number(form.campanha_id),
        peso_kg: Number(form.peso_kg),
      });
      setFormMessage('Inscrição enviada para análise.');
      setForm((prev) => ({ ...INITIAL_FORM, campanha_id: prev.campanha_id }));
      await loadMinhasInscricoes(session);
    } catch (error) {
      setFormError(error.message || 'Não foi possível enviar a inscrição.');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUploadDocumento(inscriaoId, event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingId(inscriaoId);
      setUploadError('');
      await uploadDocumentoCampanha(session.token, inscriaoId, 'documento', file);
      event.target.value = '';
      await loadMinhasInscricoes(session);
    } catch (error) {
      setUploadError(error.message || 'Não foi possível enviar o documento.');
    } finally {
      setUploadingId(null);
    }
  }

  async function handleMarkNotificacaoLida(id) {
    try {
      await markNotificacaoLida(session.token, id);
      setNotificacoes((prev) =>
        prev.map((notificacao) =>
          notificacao.id === id ? { ...notificacao, status: 'lida' } : notificacao
        )
      );
      setNotificacaoMessage('Notificação marcada como lida.');
      await loadNotificacoes(session, notificacaoFiltro);
    } catch (error) {
      setUploadError(error.message || 'Não foi possível atualizar a notificação.');
    }
  }

  async function handleMarkTodasNotificacoesLidas() {
    try {
      setNotificacaoLoading(true);
      const response = await markTodasNotificacoesLidas(session.token);
      setNotificacaoMessage(`${response?.data?.atualizadas || 0} notificações atualizadas.`);
      await loadNotificacoes(session, notificacaoFiltro);
      await loadMinhasInscricoes(session);
    } catch (error) {
      setUploadError(error.message || 'Não foi possível marcar notificações como lidas.');
    } finally {
      setNotificacaoLoading(false);
    }
  }

  async function handleRefreshPortal() {
    await loadMinhasInscricoes(session);
    await loadPreferencias(session);
    await loadNotificacoes(session, notificacaoFiltro);
  }

  async function handleInstallPwa() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  function handleApplyPwaUpdate() {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SIGBA_SKIP_WAITING' });
    }

    window.location.reload();
  }

  function scrollToPortalSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleOpenDetail(tipo, id) {
    if (!session?.token || !id) return;

    setDetailView({ tipo, id });
    setDetailData(null);
    setDetailError('');
    setDetailLoading(true);

    try {
      const requestByType = {
        animal: () => getPortalTutorAnimalDetalhe(session.token, id),
        inscriao: () => getPortalTutorInscricaoDetalhe(session.token, id),
        ocorrencia: () => getPortalTutorOcorrenciaDetalhe(session.token, id),
      };
      const response = await requestByType[tipo]();

      setDetailData(response?.data || null);
      setTimeout(() => scrollToPortalSection('portal-detalhe'), 0);
    } catch (error) {
      setDetailError(error.message || 'Não foi possível carregar o detalhe.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleOpenNotificacao(notificacao) {
    if (notificacao.status !== 'lida') {
      await handleMarkNotificacaoLida(notificacao.id);
    }

    if (['campanha_inscriao', 'campanha_inscricoes'].includes(notificacao.ref_tipo)) {
      await handleOpenDetail('inscriao', notificacao.ref_id);
      return;
    }

    if (notificacao.ref_tipo === 'ocorrencia') {
      await handleOpenDetail('ocorrencia', notificacao.ref_id);
    }
  }

  async function handleDownloadDocumento(documento) {
    try {
      const blob = await downloadMeuDocumentoCampanha(session.token, documento.id);
      downloadBlob(blob, documento.nome_original || `documento-${documento.id}`);
    } catch (error) {
      setUploadError(error.message || 'Não foi possível baixar o documento.');
    }
  }

  function handleVaccineFilterChange(event) {
    const { name, value } = event.target;
    setVaccineFilters((prev) => ({ ...prev, [name]: value }));
    setCarteiraError('');
  }

  async function handleLoadCarteiraDetalhada(animalId = selectedCarteiraAnimalId) {
    const selectedId = animalId || selectedCarteiraAnimalId;
    if (!session?.token || !selectedId) {
      setCarteiraError('Selecione um animal para consultar a carteira.');
      return;
    }

    try {
      setCarteiraLoading(true);
      setCarteiraError('');
      const response = await getPortalTutorCarteiraDetalhada(
        session.token,
        selectedId,
        vaccineFilters
      );
      setSelectedCarteiraAnimalId(String(selectedId));
      setCarteiraDetalhada(response?.data || null);
      setTimeout(() => scrollToPortalSection('portal-carteira'), 0);
    } catch (error) {
      setCarteiraError(error.message || 'Não foi possível carregar a carteira vacinal.');
    } finally {
      setCarteiraLoading(false);
    }
  }

  function handleClearCarteira() {
    setVaccineFilters(INITIAL_VACCINE_FILTERS);
    setCarteiraDetalhada(null);
    setCarteiraError('');
  }

  async function handleLoadDocumentos() {
    if (!session?.token) return;

    try {
      const response = await getPortalTutorDocumentos(session.token);
      setDocumentosTutor(Array.isArray(response?.data?.documentos) ? response.data.documentos : []);
      setUploadError('');
    } catch (error) {
      setUploadError(error.message || 'Não foi possível carregar documentos.');
    }
  }

  function handlePreferenceChange(event) {
    const { name, checked } = event.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: checked,
      operacional_essencial: true,
    }));
    setPreferencesMessage('');
    setPreferencesError('');
  }

  async function handleSavePreferences(nextPreferences = preferences) {
    if (!session?.token) return;

    try {
      setPreferencesLoading(true);
      setPreferencesError('');
      const response = await updatePortalTutorPreferencias(session.token, nextPreferences);
      const data = response?.data || {};
      setPreferences({ ...INITIAL_PREFERENCES, ...(data.preferencias || {}) });
      setPreferencesMeta(data.web_push || null);
      setPreferencesMessage('Preferências salvas.');
    } catch (error) {
      setPreferencesError(error.message || 'Não foi possível salvar preferências.');
    } finally {
      setPreferencesLoading(false);
    }
  }

  async function handleEnablePush() {
    setPushMessage('');
    setPreferencesError('');

    if (!preferencesMeta?.enabled || !preferencesMeta?.public_key) {
      setPushMessage('Web Push está preparado, mas ainda depende de habilitação institucional.');
      return;
    }

    if (!('Notification' in window) || !navigator.serviceWorker || !window.PushManager) {
      setPushMessage('Este navegador não oferece suporte completo a Web Push.');
      return;
    }

    try {
      setPushLoading(true);
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setPushMessage('Permissão de notificação não concedida.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(preferencesMeta.public_key),
        }));

      await registerPortalTutorPushSubscription(session.token, subscription.toJSON());
      await handleSavePreferences({ ...preferences, web_push: true });
      await loadPreferencias(session);
      setPushMessage('Web Push autorizado neste dispositivo.');
    } catch (error) {
      setPushMessage(error.message || 'Não foi possível ativar Web Push neste dispositivo.');
    } finally {
      setPushLoading(false);
    }
  }

  async function handleDisablePush() {
    setPushMessage('');
    setPreferencesError('');

    try {
      setPushLoading(true);
      let endpoint = '';

      if (navigator.serviceWorker && window.PushManager) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          endpoint = subscription.endpoint;
          await subscription.unsubscribe();
        }
      }

      await revokePortalTutorPushSubscription(session.token, endpoint);
      await handleSavePreferences({ ...preferences, web_push: false });
      await loadPreferencias(session);
      setPushMessage('Web Push desativado para este portal.');
    } catch (error) {
      setPushMessage(error.message || 'Não foi possível desativar Web Push.');
    } finally {
      setPushLoading(false);
    }
  }

  async function handleSendPushTeste() {
    try {
      setPushLoading(true);
      setPushMessage('');
      const response = await sendPortalTutorPushTeste(session.token);
      const entrega = response?.data?.entrega;
      setPushMessage(
        entrega?.enabled
          ? `Teste criado. Entregues: ${entrega.delivered || 0}; falhas: ${
              (entrega.failed || 0) + (entrega.permanentFailures || 0)
            }.`
          : 'Teste criado no portal. Web Push está desabilitado neste ambiente.'
      );
      await loadNotificacoes(session, notificacaoFiltro);
    } catch (error) {
      setPushMessage(error.message || 'Não foi possível enviar notificação de teste.');
    } finally {
      setPushLoading(false);
    }
  }

  function handleOcorrenciaChange(event) {
    const { name, value } = event.target;
    setOcorrenciaForm((prev) => ({ ...prev, [name]: value }));
    setOcorrenciaMessage('');
    setUploadError('');
  }

  function handleTerritorioOcorrenciaChange(event) {
    const { value } = event.target;
    const selected = territorioOptions.find((option) => option.value === value);

    setOcorrenciaForm((prev) => ({
      ...prev,
      territorio_id: value,
      bairro: selected?.nome || prev.bairro,
    }));
    setOcorrenciaMessage('');
    setUploadError('');
  }

  async function handleSubmitOcorrencia(event) {
    event.preventDefault();

    try {
      await createMinhaOcorrencia(session.token, ocorrenciaForm);
      setOcorrenciaForm(INITIAL_OCCURRENCE);
      setOcorrenciaMessage('Ocorrência enviada para acompanhamento.');
      await loadMinhasInscricoes(session);
    } catch (error) {
      setUploadError(error.message || 'Não foi possível enviar a ocorrência.');
    }
  }

  function renderMarcos(marcos = []) {
    if (!marcos.length) {
      return (
        <p style={styles.subtitle}>
          Sem marcos operacionais registrados para exibição ao tutor.
        </p>
      );
    }

    return (
      <div style={styles.timeline}>
        {marcos.map((marco, index) => (
          <div key={`${marco.tipo}-${index}`} style={styles.timelineItem}>
            <strong>{marco.titulo}</strong>
            {marco.descricao ? <span>{marco.descricao}</span> : null}
            {marco.data ? <span>{new Date(marco.data).toLocaleString('pt-BR')}</span> : null}
          </div>
        ))}
      </div>
    );
  }

  function renderHistorico(historico = []) {
    if (!historico.length) return null;

    return (
      <div style={styles.detailBlock}>
        <h3 style={styles.detailTitle}>Histórico resumido</h3>
        <div style={styles.timeline}>
          {historico.slice(0, 6).map((item) => (
            <div key={item.id} style={styles.timelineItem}>
              <strong>{item.evento}</strong>
              {item.status_novo ? (
                <span>
                  Status:{' '}
                  {STATUS_LABELS[item.status_novo] ||
                    OCORRENCIA_STATUS_LABELS[item.status_novo] ||
                    item.status_novo}
                </span>
              ) : null}
              {item.created_at ? (
                <span>{new Date(item.created_at).toLocaleString('pt-BR')}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderCarteiraDetalhada() {
    if (carteiraLoading) {
      return <p style={styles.subtitle}>Carregando carteira vacinal...</p>;
    }

    if (carteiraError) {
      return <div style={styles.alertError}>{carteiraError}</div>;
    }

    if (!carteiraDetalhada) {
      return (
        <p style={styles.subtitle}>
          Selecione um animal e aplique os filtros desejados para consultar o histórico vacinal.
        </p>
      );
    }

    const registros = Array.isArray(carteiraDetalhada.registros)
      ? carteiraDetalhada.registros
      : [];
    const legadoVacinas = Array.isArray(carteiraDetalhada.legado?.vacinas)
      ? carteiraDetalhada.legado.vacinas
      : [];

    return (
      <div style={styles.detailContent}>
        <div style={styles.vaccineSummary}>
          <strong>{carteiraDetalhada.animal?.nome || 'Animal selecionado'}</strong>
          <span>{carteiraDetalhada.resumo?.registros_ativos || 0} registros ativos nos filtros atuais</span>
          <span>{carteiraDetalhada.resumo?.observacao}</span>
        </div>

        {registros.length === 0 ? (
          <p style={styles.subtitle}>
            Nenhum registro vacinal estruturado encontrado com os filtros atuais.
          </p>
        ) : (
          <div style={styles.cards}>
            {registros.map((registro) => (
              <article key={registro.id} style={styles.vaccineDetailCard}>
                <strong>
                  {registro.vacina_nome_popular || registro.vacina_nome || 'Vacina registrada'}
                </strong>
                <span>Dose: {registro.dose || 'não informada'}</span>
                <span>
                  Aplicação:{' '}
                  {registro.data_aplicacao
                    ? new Date(registro.data_aplicacao).toLocaleDateString('pt-BR')
                    : 'sem data'}
                </span>
                <span>
                  Próxima dose:{' '}
                  {registro.proxima_dose_em
                    ? new Date(registro.proxima_dose_em).toLocaleDateString('pt-BR')
                    : 'não informada'}
                </span>
                <span>
                  Origem:{' '}
                  {VACINA_ORIGEM_LABELS[registro.origem_registro] ||
                    registro.origem_registro ||
                    'não informada'}
                </span>
                <span>
                  Status:{' '}
                  {VACINA_STATUS_LABELS[registro.status_registro] || registro.status_registro}
                </span>
                {registro.campanha_nome ? <span>Campanha: {registro.campanha_nome}</span> : null}
                {registro.documento_id ? (
                  <span>
                    Comprovante vinculado:{' '}
                    {registro.documento_nome_original || `documento #${registro.documento_id}`}
                  </span>
                ) : null}
                {registro.situacao_calculada ? (
                  <span>Leitura operacional: {registro.situacao_calculada}</span>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {legadoVacinas.length > 0 ? (
          <div style={styles.detailBlock}>
            <h3 style={styles.detailTitle}>Registro legado textual</h3>
            <span>
              Esses dados foram preservados por compatibilidade e não substituem o histórico estruturado.
            </span>
            {legadoVacinas.slice(0, 4).map((item, index) => (
              <span key={`${item}-${index}`}>{String(item)}</span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderDetailContent() {
    if (detailLoading) {
      return <p style={styles.subtitle}>Carregando detalhe...</p>;
    }

    if (detailError) {
      return <div style={styles.alertError}>{detailError}</div>;
    }

    if (!detailData) {
      return (
        <p style={styles.subtitle}>
          Selecione um animal, inscrição ou ocorrência para ver o detalhe.
        </p>
      );
    }

    if (detailView?.tipo === 'animal') {
      const animal = detailData.animal || detailData.carteira?.animal || {};
      const carteira = detailData.carteira;

      return (
        <div style={styles.detailContent}>
          <div style={styles.detailBlock}>
            <h3 style={styles.detailTitle}>{animal.nome || 'Animal oficial'}</h3>
            <span>Espécie: {animal.especie || 'não informada'}</span>
            <span>Sexo: {animal.sexo || 'não informado'}</span>
            <span>Raça: {animal.raca || 'não informada'}</span>
            <span>Microchip: {animal.microchip || 'não informado'}</span>
            <span>Território: {animal.territorio_nome || animal.bairro || 'não informado'}</span>
            <span>Identificação Animal: {animal.public_id || 'não disponível'}</span>
            <span>{animal.perfil_publico_ativo ? 'Perfil público ativo' : 'Perfil público restrito'}</span>
            {animal.public_id ? (
              <button type="button" onClick={onOpenPublico} style={styles.smallButton}>
                Consultar identificação no painel público
              </button>
            ) : null}
          </div>

          <div style={styles.detailBlock}>
            <h3 style={styles.detailTitle}>Carteira vacinal</h3>
            <span>{carteira?.resumo?.registros_ativos || 0} registros ativos</span>
            <span>
              {carteira?.resumo?.observacao ||
                'Ausência de registro estruturado não confirma ausência real de vacinação.'}
            </span>
            {carteira?.registros?.slice(0, 6).map((registro) => (
              <span key={registro.id}>
                {registro.vacina_nome_popular || registro.vacina_nome}:{' '}
                {registro.status_registro}
              </span>
            ))}
            <button
              type="button"
              onClick={() => handleLoadCarteiraDetalhada(animal.id)}
              style={styles.smallButton}
            >
              Abrir carteira detalhada
            </button>
          </div>

          <div style={styles.detailBlock}>
            <h3 style={styles.detailTitle}>Vinculos no portal</h3>
            <span>Inscrições relacionadas: {detailData.inscricoes_relacionadas?.length || 0}</span>
            <span>Ocorrências relacionadas: {detailData.ocorrencias_relacionadas?.length || 0}</span>
          </div>
        </div>
      );
    }

    if (detailView?.tipo === 'inscriao') {
      const inscriao = detailData.inscriao || {};
      const documentos = detailData.documentos || [];

      return (
        <div style={styles.detailContent}>
          <div style={styles.detailBlock}>
            <h3 style={styles.detailTitle}>
              {inscriao.campanha_nome || 'Inscrição em campanha'}
            </h3>
            <span>Protocolo: {inscriao.protocolo}</span>
            <span>Status: {STATUS_LABELS[inscriao.status] || inscriao.status}</span>
            <span>Animal: {inscriao.animal_nome}</span>
            <span>
              Serviço: {SERVICO_LABELS[inscriao.servico_desejado] || inscriao.servico_desejado}
            </span>
            <span>Território: {inscriao.territorio_nome || inscriao.bairro || 'não informado'}</span>
            {inscriao.agendamento_data ? (
              <span>
                Agendamento: {new Date(inscriao.agendamento_data).toLocaleString('pt-BR')}
              </span>
            ) : null}
            {inscriao.pendencia_aberta ? (
              <span>
                Pendência: {inscriao.pendencia_descricao || inscriao.pendencia_tipo}
              </span>
            ) : null}
            {inscriao.desfecho ? <span>Desfecho: {inscriao.desfecho}</span> : null}
          </div>

          <div style={styles.nextStepBox}>
            <strong>Proximo passo</strong>
            <span>{detailData.proximo_passo}</span>
          </div>

          <div style={styles.detailBlock}>
            <h3 style={styles.detailTitle}>Documentos</h3>
            {documentos.length === 0 ? (
              <span>Nenhum documento enviado nesta inscrição.</span>
            ) : (
              <div style={styles.documentList}>
                {documentos.map((documento) => (
                  <button
                    key={documento.id}
                    type="button"
                    onClick={() => handleDownloadDocumento(documento)}
                    style={styles.smallButton}
                  >
                    {documento.nome_original}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={styles.detailBlock}>
            <h3 style={styles.detailTitle}>Marcos do fluxo</h3>
            {renderMarcos(detailData.marcos)}
          </div>
          {renderHistorico(detailData.historico_operacional)}
        </div>
      );
    }

    if (detailView?.tipo === 'ocorrencia') {
      const ocorrencia = detailData.ocorrencia || {};

      return (
        <div style={styles.detailContent}>
          <div style={styles.detailBlock}>
            <h3 style={styles.detailTitle}>{ocorrencia.titulo || 'Ocorrência'}</h3>
            <span>Tipo: {OCORRENCIA_TIPO_LABELS[ocorrencia.tipo] || ocorrencia.tipo}</span>
            <span>Status: {OCORRENCIA_STATUS_LABELS[ocorrencia.status] || ocorrencia.status}</span>
            <span>Território: {ocorrencia.territorio_nome || ocorrencia.bairro || 'não informado'}</span>
            <span>
              Criada em:{' '}
              {ocorrencia.created_at
                ? new Date(ocorrencia.created_at).toLocaleString('pt-BR')
                : 'não informado'}
            </span>
            {ocorrencia.pendencia_aberta ? (
              <span>
                Pendência: {ocorrencia.pendencia_descricao || ocorrencia.pendencia_tipo}
              </span>
            ) : null}
            {ocorrencia.desfecho ? <span>Desfecho: {ocorrencia.desfecho}</span> : null}
          </div>

          <div style={styles.nextStepBox}>
            <strong>Proximo passo</strong>
            <span>{detailData.proximo_passo}</span>
          </div>

          <div style={styles.detailBlock}>
            <h3 style={styles.detailTitle}>Descrição enviada</h3>
            <span>{ocorrencia.descricao || 'Sem descrição adicional.'}</span>
          </div>

          <div style={styles.detailBlock}>
            <h3 style={styles.detailTitle}>Marcos do fluxo</h3>
            {renderMarcos(detailData.marcos)}
          </div>
          {renderHistorico(detailData.historico_operacional)}
        </div>
      );
    }

    return null;
  }

  return (
    <main style={styles.page} className="sigba-portal-tutor">
      <header style={styles.header}>
        <div>
          <span style={styles.badge}>SIGMA</span>
          <h1 style={styles.title}>Portal do Tutor</h1>
          <p style={styles.subtitle}>
            Campanhas, vacinação, castração, microchipagem e acompanhamento do animal.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" onClick={onOpenPublico} style={styles.secondaryButton}>
            Painel público
          </button>
          <button type="button" onClick={onOpenAdmin} style={styles.secondaryButton}>
            Área interna SMAD
          </button>
        </div>
      </header>

      <PortalTutorCampaignBanner activeCampanha={activeCampanha} />

      {!session?.token ? (
        <PortalTutorAuthSection
          authMode={authMode}
          setAuthMode={setAuthMode}
          handleRegister={handleRegister}
          handleLogin={handleLogin}
          handleRequestReset={handleRequestReset}
          handleResetPassword={handleResetPassword}
          authLoading={authLoading}
          registerForm={registerForm}
          loginForm={loginForm}
          resetForm={resetForm}
          handleChange={handleChange}
          setRegisterForm={setRegisterForm}
          setLoginForm={setLoginForm}
          setResetForm={setResetForm}
          authError={authError}
          authMessage={authMessage}
          showReset={showReset}
          setShowReset={setShowReset}
        />
      ) : (
        <>
          <PortalTutorHubSection
            isOnline={isOnline}
            portalError={portalError}
            pwaUpdateReady={pwaUpdateReady}
            handleApplyPwaUpdate={handleApplyPwaUpdate}
            portalResumo={portalResumo}
            scrollToPortalSection={scrollToPortalSection}
            handleRefreshPortal={handleRefreshPortal}
            portalLoading={portalLoading}
            installPrompt={installPrompt}
            handleInstallPwa={handleInstallPwa}
            lastSyncAt={lastSyncAt}
          />

          <PortalTutorAnimalsSection
            animaisMobile={animaisMobile}
            handleOpenDetail={handleOpenDetail}
            handleLoadCarteiraDetalhada={handleLoadCarteiraDetalhada}
          />

          <PortalTutorDetailPanel
            detailView={detailView}
            onCloseDetail={() => {
              setDetailView(null);
              setDetailData(null);
              setDetailError('');
            }}
          >
            {renderDetailContent()}
          </PortalTutorDetailPanel>

          <PortalTutorDocumentsSection
            uploadError={uploadError}
            handleLoadDocumentos={handleLoadDocumentos}
            documentosTutor={documentosTutor}
            handleDownloadDocumento={handleDownloadDocumento}
            handleOpenDetail={handleOpenDetail}
          />

          <PortalTutorCarteiraSection
            selectedCarteiraAnimalId={selectedCarteiraAnimalId}
            setSelectedCarteiraAnimalId={setSelectedCarteiraAnimalId}
            animaisMobile={animaisMobile}
            vaccineFilters={vaccineFilters}
            handleVaccineFilterChange={handleVaccineFilterChange}
            handleLoadCarteiraDetalhada={handleLoadCarteiraDetalhada}
            handleClearCarteira={handleClearCarteira}
            carteiraLoading={carteiraLoading}
            carteiraContent={renderCarteiraDetalhada()}
            origemLabels={VACINA_ORIGEM_LABELS}
            statusLabels={VACINA_STATUS_LABELS}
          />

          <PortalTutorPreferencesSection
            session={session}
            loadPreferencias={loadPreferencias}
            preferencesError={preferencesError}
            preferencesMessage={preferencesMessage}
            preferences={preferences}
            handlePreferenceChange={handlePreferenceChange}
            preferencesMeta={preferencesMeta}
            pushLoading={pushLoading}
            handleEnablePush={handleEnablePush}
            handleDisablePush={handleDisablePush}
            handleSendPushTeste={handleSendPushTeste}
            pushMessage={pushMessage}
            handleSavePreferences={handleSavePreferences}
            preferencesLoading={preferencesLoading}
          />

          <section style={styles.portalGrid}>
            <PortalTutorInscricaoSection
              campanhas={campanhas}
              form={form}
              handleFormChange={handleFormChange}
              territorioOptions={territorioOptions}
              handleTerritorioFormChange={handleTerritorioFormChange}
              healthOptions={HEALTH_OPTIONS}
              terms={TERMS}
              handleArrayChange={handleArrayChange}
              formError={formError}
              formMessage={formMessage}
              formLoading={formLoading}
              handleSubmitInscricao={handleSubmitInscricao}
              handleLogout={handleLogout}
            />

            <PortalTutorAsideSection
              ocorrenciaForm={ocorrenciaForm}
              handleSubmitOcorrencia={handleSubmitOcorrencia}
              handleOcorrenciaChange={handleOcorrenciaChange}
              handleTerritorioOcorrenciaChange={handleTerritorioOcorrenciaChange}
              territorioOptions={territorioOptions}
              ocorrenciaMessage={ocorrenciaMessage}
              ocorrencias={ocorrencias}
              ocorrenciaTipoLabels={OCORRENCIA_TIPO_LABELS}
              ocorrenciaStatusLabels={OCORRENCIA_STATUS_LABELS}
              handleOpenDetail={handleOpenDetail}
              notificacaoResumo={notificacaoResumo}
              handleMarkTodasNotificacoesLidas={handleMarkTodasNotificacoesLidas}
              notificacaoLoading={notificacaoLoading}
              notificacaoFiltro={notificacaoFiltro}
              setNotificacaoFiltro={setNotificacaoFiltro}
              loadNotificacoes={loadNotificacoes}
              session={session}
              notificacoes={notificacoes}
              notificacaoMessage={notificacaoMessage}
              handleMarkNotificacaoLida={handleMarkNotificacaoLida}
              handleOpenNotificacao={handleOpenNotificacao}
              uploadError={uploadError}
              minhasInscricoes={minhasInscricoes}
              documentosPorInscricao={documentosPorInscricao}
              carteirasPorAnimal={carteirasPorAnimal}
              statusLabels={STATUS_LABELS}
              servicoLabels={SERVICO_LABELS}
              handleDownloadDocumento={handleDownloadDocumento}
              onOpenPublico={onOpenPublico}
              handleLoadCarteiraDetalhada={handleLoadCarteiraDetalhada}
              handleUploadDocumento={handleUploadDocumento}
              uploadingId={uploadingId}
            />
          </section>
        </>
      )}
    </main>
  );
}
