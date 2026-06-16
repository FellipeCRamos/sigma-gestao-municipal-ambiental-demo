import { assistenteStyles } from './assistenteStyles';

const PERFIS = [
  ['nao_sei', 'Nao sei qual licenca preciso'],
  ['consultor', 'Sou consultor ou responsavel tecnico'],
  ['servidor', 'Sou servidor/analista SMAD'],
];

export default function CampoDescricaoAtividade({
  descricao,
  perfilUsuario,
  onDescricaoChange,
  onPerfilChange,
  onAnalyze,
}) {
  return (
    <div style={assistenteStyles.cardWhite}>
      <label style={assistenteStyles.label}>
        Descreva, com suas palavras, o que voce pretende fazer, construir, instalar, regularizar ou operar.
        <textarea
          value={descricao}
          onChange={(event) => onDescricaoChange(event.target.value)}
          placeholder="Ex.: Quero trabalhar com ferro velho no meu quintal.&#10;Ex.: Quero abrir um lava-jato.&#10;Ex.: Quero aterrar meu terreno.&#10;Ex.: Quero cortar algumas arvores."
          style={assistenteStyles.textarea}
          required
        />
      </label>

      <div style={{ ...assistenteStyles.grid2, marginTop: 14 }}>
        <label style={assistenteStyles.label}>
          Perfil de uso
          <select
            value={perfilUsuario}
            onChange={(event) => onPerfilChange(event.target.value)}
            style={assistenteStyles.input}
          >
            {PERFIS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={assistenteStyles.actions}>
        <button type="button" onClick={onAnalyze} style={assistenteStyles.buttonPrimary}>
          Analisar atividade
        </button>
      </div>
    </div>
  );
}
