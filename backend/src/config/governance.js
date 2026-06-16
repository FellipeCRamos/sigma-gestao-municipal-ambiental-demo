const GOVERNANCE_VERSION = '2026.04-gov4b-minuta-1';
const GOVERNANCE_UPDATED_AT = '2026-04-13';

const DOCUMENT_STATUS = 'minuta_tecnica_preliminar';
const VALIDATION_NOTICE =
  'Documento tecnico preliminar. Publicacao oficial depende de validacao juridica e institucional do ente publico.';

const TERMOS_USO = Object.freeze({
  versao: GOVERNANCE_VERSION,
  atualizado_em: GOVERNANCE_UPDATED_AT,
  status: DOCUMENT_STATUS,
  aviso_validacao: VALIDATION_NOTICE,
  titulo: 'Termo de Uso da Plataforma SIGMA',
  secoes: [
    {
      titulo: 'Finalidade',
      texto:
        'A Plataforma SIGMA apoia a gestao municipal ambiental da SMAD, incluindo bem-estar animal, viveiro, licenciamento, anuencias, fiscalizacao, campanhas, ocorrencias, indicadores e consultas publicas.'
    },
    {
      titulo: 'Uso do portal do tutor',
      texto:
        'O usuario deve informar dados verdadeiros, manter seus contatos atualizados e acompanhar inscricoes, notificacoes e documentos enviados ao sistema.'
    },
    {
      titulo: 'Campanhas e atendimento',
      texto:
        'Inscricao em campanha nao garante vaga automatica. A SMAD pode aplicar criterios operacionais, sanitarios e administrativos de triagem, agendamento e atendimento.'
    },
    {
      titulo: 'Identificação Animal publico',
      texto:
        'A consulta publica do Identificação Animal deve exibir apenas dados minimizados do animal e nao deve divulgar dados pessoais do tutor.'
    },
    {
      titulo: 'Responsabilidades',
      texto:
        'E proibido usar o sistema para informacoes falsas, tentativa de acesso indevido, raspagem abusiva, exposicao de dados ou qualquer uso fora da finalidade publica.'
    }
  ]
});

const POLITICA_PRIVACIDADE = Object.freeze({
  versao: GOVERNANCE_VERSION,
  atualizado_em: GOVERNANCE_UPDATED_AT,
  status: DOCUMENT_STATUS,
  aviso_validacao: VALIDATION_NOTICE,
  titulo: 'Politica de Privacidade da Plataforma SIGMA',
  secoes: [
    {
      titulo: 'Dados tratados',
      texto:
        'A Plataforma SIGMA trata dados cadastrais de tutores e usuarios, dados operacionais dos modulos ambientais, documentos enviados, ocorrencias, registros, logs e auditoria.'
    },
    {
      titulo: 'Finalidade',
      texto:
        'Os dados sao usados para cadastro, identificacao animal, campanhas publicas, acompanhamento operacional, comunicacoes, auditoria, seguranca e indicadores agregados de gestao.'
    },
    {
      titulo: 'Exposicao publica',
      texto:
        'A area publica deve usar indicadores agregados e perfil publico do animal com minimizacao de dados. Dados pessoais de tutor e documentos ficam restritos ao portal do proprio tutor e a area administrativa autorizada.'
    },
    {
      titulo: 'Compartilhamento e integracoes',
      texto:
        'Integracoes externas devem receber apenas escopos autorizados, com token revogavel, log de uso e exposicao compatibilizada com a finalidade publica aprovada.'
    },
    {
      titulo: 'Retencao e auditoria',
      texto:
        'Registros operacionais, documentos, logs e auditoria seguem politica tecnica de retencao e descarte, sujeita a validacao juridica, administrativa e arquivistica.'
    }
  ]
});

const DATA_CLASSIFICATION_LEVELS = Object.freeze([
  {
    nivel: 'publico',
    descricao: 'Dado agregado ou dado de animal minimizado, apto a exposicao publica controlada.'
  },
  {
    nivel: 'interno_administrativo',
    descricao: 'Dado necessario para operacao interna SMAD, sem exposicao publica ampla.'
  },
  {
    nivel: 'restrito_operacional',
    descricao: 'Dado pessoal, documento, contato, ocorrencia ou decisao operacional acessivel apenas por perfil autorizado.'
  },
  {
    nivel: 'confidencial_tecnico',
    descricao: 'Segredos, hashes, tokens, logs tecnicos detalhados e trilhas de auditoria com contexto de seguranca.'
  }
]);

const PUBLIC_GOVERNANCE_SUMMARY = Object.freeze({
  versao_governanca: GOVERNANCE_VERSION,
  atualizado_em: GOVERNANCE_UPDATED_AT,
  status: DOCUMENT_STATUS,
  aviso_validacao: VALIDATION_NOTICE,
  classificacao_publica: {
    indicadores_publicos: 'Dados agregados por espécie, situação sanitária geral, campanhas e território.',
    rg_animal_publico:
      'Dados minimizados do animal quando perfil_publico_ativo estiver habilitado; não inclui nome, Documento, telefone, e-mail ou endereço completo do tutor.',
    portal_tutor:
      'Acesso autenticado do próprio usuário externo para inscrições, documentos, ocorrências, notificações e carteira vacinal vinculada.'
  },
  documentos: {
    termo_uso_versao: TERMOS_USO.versao,
    politica_privacidade_versao: POLITICA_PRIVACIDADE.versao
  },
  contato_institucional: 'SMAD demonstrativa/ES - canal institucional a definir antes da publicação oficial'
});

module.exports = {
  GOVERNANCE_VERSION,
  GOVERNANCE_UPDATED_AT,
  TERMOS_USO,
  POLITICA_PRIVACIDADE,
  DATA_CLASSIFICATION_LEVELS,
  PUBLIC_GOVERNANCE_SUMMARY,
};
