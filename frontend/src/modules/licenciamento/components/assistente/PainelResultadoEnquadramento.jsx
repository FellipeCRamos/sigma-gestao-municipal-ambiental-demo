import ChecklistDocumentalPreliminar from './ChecklistDocumentalPreliminar';
import { assistenteStyles, attentionStyle } from './assistenteStyles';

export default function PainelResultadoEnquadramento({ resultado, onEnviarAnalise, envioAnalise }) {
  if (!resultado) return null;

  return (
    <div style={assistenteStyles.cardWhite}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <span style={assistenteStyles.badge}>Pre-requerimento orientativo</span>
        <span style={attentionStyle(resultado.nivelAtencao)}>
          Grau de atencao: {resultado.nivelAtencao}
        </span>
      </div>

      <div style={assistenteStyles.grid2}>
        <div style={assistenteStyles.card}>
          <h3 style={{ ...assistenteStyles.title, fontSize: 20 }}>Resumo para o cidadao</h3>
          <p style={assistenteStyles.subtitle}>{resultado.resumoCidadao}</p>
        </div>
        <div style={assistenteStyles.card}>
          <h3 style={{ ...assistenteStyles.title, fontSize: 20 }}>Resumo tecnico para analise</h3>
          <p style={assistenteStyles.subtitle}>{resultado.resumoTecnico}</p>
        </div>
      </div>

      <div style={{ ...assistenteStyles.grid2, marginTop: 16 }}>
        <div style={assistenteStyles.card}>
          <h3 style={{ ...assistenteStyles.title, fontSize: 20 }}>Pendencias automaticas</h3>
          <ul style={assistenteStyles.list}>
            {resultado.pendencias.map((pendencia) => (
              <li key={pendencia}>{pendencia}</li>
            ))}
          </ul>
        </div>
        <ChecklistDocumentalPreliminar documentos={resultado.checklistDocumental} />
      </div>

      {resultado.alertas?.length ? (
        <div style={{ ...assistenteStyles.warning, marginTop: 16 }}>
          <strong>Alertas preliminares</strong>
          <ul style={assistenteStyles.list}>
            {resultado.alertas.map((alerta) => (
              <li key={alerta}>{alerta}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={{ ...assistenteStyles.card, marginTop: 16 }}>
        <h3 style={{ ...assistenteStyles.title, fontSize: 20 }}>Recomendacao de tramitacao</h3>
        <p style={assistenteStyles.subtitle}>{resultado.recomendacaoTramitacao}</p>
      </div>

      <div style={{ ...assistenteStyles.warning, marginTop: 16 }}>
        A orientacao acima nao constitui licenca, dispensa, autorizacao, cobranca oficial ou decisao administrativa
        automatica. O ato formal depende de validacao da SMAD.
      </div>

      {onEnviarAnalise ? (
        <div style={{ ...assistenteStyles.card, marginTop: 16 }}>
          <h3 style={{ ...assistenteStyles.title, fontSize: 20 }}>Registro da pre-analise</h3>
          <p style={assistenteStyles.subtitle}>
            Envie esta pre-analise para a SMAD revisar tecnicamente. O envio nao autoriza o inicio da atividade
            e nao substitui requerimento, licenca, dispensa ou ato administrativo formal.
          </p>
          <button
            type="button"
            onClick={onEnviarAnalise}
            disabled={envioAnalise?.loading || Boolean(envioAnalise?.registro)}
            style={{ ...assistenteStyles.buttonPrimary, marginTop: 12, opacity: envioAnalise?.loading ? 0.7 : 1 }}
          >
            {envioAnalise?.loading ? 'Registrando pre-analise...' : 'Enviar pre-analise para a SMAD'}
          </button>
          {envioAnalise?.registro ? (
            <div style={{ ...assistenteStyles.success, marginTop: 12 }}>
              Pre-analise registrada com sucesso. Codigo preliminar: {envioAnalise.registro.codigoPreliminar}.
              A analise nao autoriza o inicio da atividade e sera submetida a validacao tecnica da SMAD.
            </div>
          ) : null}
          {envioAnalise?.erro ? (
            <div style={{ ...assistenteStyles.warning, marginTop: 12 }}>
              Nao foi possivel registrar a pre-analise neste momento. Verifique os dados e tente novamente.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
