import { useState } from 'react';
import {
  analisarDescricaoAtividade,
  gerarPreRequerimentoAssistido,
} from '../../services/assistente/assistenteEnquadramentoService';
import { createPublicLicenciamentoAssistenteAnalise } from '../../services/licenciamentoAdminApi';
import CampoDescricaoAtividade from './CampoDescricaoAtividade';
import FormularioSidDinamico from './FormularioSidDinamico';
import PainelResultadoEnquadramento from './PainelResultadoEnquadramento';
import ResultadoInterpretacaoAtividade from './ResultadoInterpretacaoAtividade';
import { assistenteStyles } from './assistenteStyles';

export default function AssistenteEnquadramentoAmbiental() {
  const [descricao, setDescricao] = useState('');
  const [perfilUsuario, setPerfilUsuario] = useState('nao_sei');
  const [interpretacao, setInterpretacao] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [respostasFormulario, setRespostasFormulario] = useState({});
  const [resultado, setResultado] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [envioAnalise, setEnvioAnalise] = useState({ loading: false, registro: null, erro: '' });

  function handleAnalyze() {
    setMensagem('');
    setResultado(null);
    setEnvioAnalise({ loading: false, registro: null, erro: '' });

    if (!descricao.trim()) {
      setMensagem('Informe o que pretende fazer para iniciar a analise preliminar.');
      return;
    }

    const analysis = analisarDescricaoAtividade({
      descricaoOriginal: descricao,
      perfilUsuario,
    });

    setInterpretacao(analysis.interpretacao);
    setFormulario(analysis.formulario);
    setRespostasFormulario(analysis.respostasIniciais);
  }

  function updateResponse(key, value) {
    setRespostasFormulario((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleGenerate() {
    if (!interpretacao) return;
    setEnvioAnalise({ loading: false, registro: null, erro: '' });

    const nextResult = gerarPreRequerimentoAssistido({
      descricaoOriginal: descricao,
      perfilUsuario,
      interpretacao,
      respostasFormulario,
    });

    setResultado(nextResult);
  }

  async function handleEnviarAnalise() {
    if (!resultado || envioAnalise.loading) return;

    setEnvioAnalise({ loading: true, registro: null, erro: '' });

    try {
      const response = await createPublicLicenciamentoAssistenteAnalise(resultado);
      setEnvioAnalise({ loading: false, registro: response.data, erro: '' });
    } catch (error) {
      setEnvioAnalise({
        loading: false,
        registro: null,
        erro: error.message || 'Nao foi possivel registrar a pre-analise neste momento.',
      });
    }
  }

  return (
    <section id="assistente-enquadramento" style={assistenteStyles.section}>
      <div style={{ marginBottom: 18 }}>
        <span style={assistenteStyles.badge}>Nova entrada assistida</span>
        <h2 style={{ ...assistenteStyles.title, marginTop: 12 }}>Assistente de Enquadramento Ambiental</h2>
        <p style={assistenteStyles.subtitle}>
          Informe o que pretende fazer e o sistema ajudara a identificar o caminho adequado para iniciar seu
          requerimento. A analise desta versao e local, deterministica e auditavel.
        </p>
      </div>

      <CampoDescricaoAtividade
        descricao={descricao}
        perfilUsuario={perfilUsuario}
        onDescricaoChange={setDescricao}
        onPerfilChange={setPerfilUsuario}
        onAnalyze={handleAnalyze}
      />

      {mensagem ? <div style={{ ...assistenteStyles.warning, marginTop: 14 }}>{mensagem}</div> : null}

      {interpretacao ? (
        <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
          <ResultadoInterpretacaoAtividade interpretacao={interpretacao} />
          <FormularioSidDinamico
            config={formulario}
            respostas={respostasFormulario}
            onChange={updateResponse}
            onGenerate={handleGenerate}
          />
        </div>
      ) : null}

      {resultado ? (
        <div style={{ marginTop: 18 }}>
          <PainelResultadoEnquadramento
            resultado={resultado}
            onEnviarAnalise={handleEnviarAnalise}
            envioAnalise={envioAnalise}
          />
        </div>
      ) : null}
    </section>
  );
}
