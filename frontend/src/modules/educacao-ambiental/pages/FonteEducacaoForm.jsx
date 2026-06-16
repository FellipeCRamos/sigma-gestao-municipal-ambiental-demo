import {
  confiabilidadeOptions,
  fonteEsferaOptions,
  fonteStatusOptions,
  fonteTipoOptions,
} from './pageConfigs';
import { styles } from './shared';

export default function FonteEducacaoForm({ form, onChange, onSubmit, saving, editing, onCancel }) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: '18px' }}>
      <div style={styles.formGrid}>
        <label style={styles.label}>
          Nome
          <input style={styles.input} value={form.nome} onChange={(event) => onChange('nome', event.target.value)} />
        </label>
        <label style={styles.label}>
          Tipo
          <select
            style={styles.input}
            value={form.tipo_fonte}
            onChange={(event) => onChange('tipo_fonte', event.target.value)}
          >
            {fonteTipoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={styles.label}>
          Esfera
          <select style={styles.input} value={form.esfera} onChange={(event) => onChange('esfera', event.target.value)}>
            {fonteEsferaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={styles.label}>
          Confiabilidade padrao
          <select
            style={styles.input}
            value={form.confiabilidade_padrao}
            onChange={(event) => onChange('confiabilidade_padrao', event.target.value)}
          >
            {confiabilidadeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={styles.label}>
          Status
          <select style={styles.input} value={form.status} onChange={(event) => onChange('status', event.target.value)}>
            {fonteStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={styles.label}>
          Orgao responsavel
          <input
            style={styles.input}
            value={form.orgao_responsavel}
            onChange={(event) => onChange('orgao_responsavel', event.target.value)}
          />
        </label>
        <label style={styles.label}>
          URL
          <input style={styles.input} value={form.url} onChange={(event) => onChange('url', event.target.value)} />
        </label>
        <label style={styles.label}>
          Periodicidade
          <input
            style={styles.input}
            value={form.periodicidade_atualizacao}
            onChange={(event) => onChange('periodicidade_atualizacao', event.target.value)}
          />
        </label>
        <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
          Temas relacionados
          <input
            style={styles.input}
            value={form.temas_relacionados}
            placeholder="Separar por virgula"
            onChange={(event) => onChange('temas_relacionados', event.target.value)}
          />
        </label>
        <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
          Descricao
          <textarea style={styles.textarea} value={form.descricao} onChange={(event) => onChange('descricao', event.target.value)} />
        </label>
        <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
          Observacoes
          <textarea style={styles.textarea} value={form.observacoes} onChange={(event) => onChange('observacoes', event.target.value)} />
        </label>
      </div>
      <div style={styles.actions}>
        <button type="submit" style={styles.buttonPrimary} disabled={saving}>
          {saving ? 'Salvando...' : editing ? 'Salvar fonte' : 'Criar fonte'}
        </button>
        {editing ? (
          <button type="button" style={styles.buttonSecondary} onClick={onCancel}>
            Cancelar edicao
          </button>
        ) : null}
      </div>
    </form>
  );
}
