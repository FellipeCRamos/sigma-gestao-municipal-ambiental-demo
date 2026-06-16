import {
  confiabilidadeOptions,
  evidenciaTipoOptions,
  referenciaEntidadeOptions,
} from './pageConfigs';
import { styles } from './shared';

export default function ReferenciaEducacaoForm({ form, onChange, onSubmit, saving, editing, onCancel }) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: '18px' }}>
      <div style={styles.formGrid}>
        <label style={styles.label}>
          Entidade
          <select
            style={styles.input}
            value={form.entidade_tipo}
            onChange={(event) => onChange('entidade_tipo', event.target.value)}
          >
            {referenciaEntidadeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={styles.label}>
          ID da entidade
          <input
            style={styles.input}
            type="number"
            value={form.entidade_id}
            onChange={(event) => onChange('entidade_id', event.target.value)}
          />
        </label>
        <label style={styles.label}>
          Fonte ID
          <input
            style={styles.input}
            type="number"
            value={form.fonte_id}
            onChange={(event) => onChange('fonte_id', event.target.value)}
          />
        </label>
        <label style={styles.label}>
          Tipo de evidencia
          <select
            style={styles.input}
            value={form.tipo_evidencia}
            onChange={(event) => onChange('tipo_evidencia', event.target.value)}
          >
            {evidenciaTipoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={styles.label}>
          Confiabilidade
          <select
            style={styles.input}
            value={form.confiabilidade}
            onChange={(event) => onChange('confiabilidade', event.target.value)}
          >
            {confiabilidadeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={styles.label}>
          Pagina
          <input style={styles.input} value={form.pagina} onChange={(event) => onChange('pagina', event.target.value)} />
        </label>
        <label style={styles.label}>
          Data de acesso
          <input
            style={styles.input}
            type="date"
            value={form.data_acesso}
            onChange={(event) => onChange('data_acesso', event.target.value)}
          />
        </label>
        <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
          Titulo da referencia
          <input
            style={styles.input}
            value={form.titulo_referencia}
            onChange={(event) => onChange('titulo_referencia', event.target.value)}
          />
        </label>
        <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
          URL
          <input style={styles.input} value={form.url} onChange={(event) => onChange('url', event.target.value)} />
        </label>
        <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
          Descricao
          <textarea style={styles.textarea} value={form.descricao} onChange={(event) => onChange('descricao', event.target.value)} />
        </label>
        <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
          Trecho relevante
          <textarea
            style={styles.textarea}
            value={form.trecho_relevante}
            onChange={(event) => onChange('trecho_relevante', event.target.value)}
          />
        </label>
        <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
          Observacoes
          <textarea style={styles.textarea} value={form.observacoes} onChange={(event) => onChange('observacoes', event.target.value)} />
        </label>
      </div>
      <div style={styles.actions}>
        <button type="submit" style={styles.buttonPrimary} disabled={saving}>
          {saving ? 'Salvando...' : editing ? 'Salvar referencia' : 'Criar referencia'}
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
