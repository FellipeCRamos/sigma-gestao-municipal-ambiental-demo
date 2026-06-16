import { assistenteStyles, attentionStyle } from './assistenteStyles';

export default function ResultadoInterpretacaoAtividade({ interpretacao }) {
  if (!interpretacao?.slug) return null;

  return (
    <div style={assistenteStyles.card}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <span style={assistenteStyles.badge}>Analise local deterministica</span>
        <span style={attentionStyle(interpretacao.nivelAtencaoInicial)}>
          Atencao inicial: {interpretacao.nivelAtencaoInicial}
        </span>
      </div>

      <h3 style={{ ...assistenteStyles.title, fontSize: 20 }}>{interpretacao.atividadeProvavel}</h3>
      <p style={assistenteStyles.subtitle}>
        Grupo provavel: <strong>{interpretacao.grupo || 'A definir'}</strong>
      </p>
      <p style={assistenteStyles.subtitle}>
        Confianca simulada: <strong>{Math.round(Number(interpretacao.confianca || 0) * 100)}%</strong>
      </p>

      {interpretacao.palavrasChaveDetectadas?.length ? (
        <p style={assistenteStyles.subtitle}>
          Palavras-chave detectadas: {interpretacao.palavrasChaveDetectadas.join(', ')}.
        </p>
      ) : null}

      {interpretacao.observacoes?.length ? (
        <ul style={assistenteStyles.list}>
          {interpretacao.observacoes.map((observacao) => (
            <li key={observacao}>{observacao}</li>
          ))}
        </ul>
      ) : null}

      <div style={{ ...assistenteStyles.warning, marginTop: 14 }}>
        Resultado preliminar. A decisao final depende de analise tecnica, administrativa e, quando cabivel,
        juridica da SMAD. Esta simulacao nao autoriza o inicio da atividade.
      </div>
    </div>
  );
}
