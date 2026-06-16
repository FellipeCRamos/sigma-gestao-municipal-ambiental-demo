import { useState } from 'react';
import GeoLocationField from '../../../core/components/GeoLocationField';

const EMPTY = {
  tipo_solicitacao: 'ANUENCIA_AMBIENTAL',
  finalidade: '',
  descricao: '',
  geo_localizacao_id: '',
  distrito: '',
  bairro_localidade: '',
  responsabilidade: false,
};

export default function PortalRequerenteNovoRequerimento({ onSave, onCancel, saving = false }) {
  const [form, setForm] = useState(EMPTY);

  function submit(event, enviar = false) {
    event.preventDefault();
    onSave?.({
      ...form,
      geo_localizacao_id: form.geo_localizacao_id || null,
    }, { enviar });
    setForm(EMPTY);
  }

  return (
    <section style={styles.section}>
      <div>
        <h2 style={styles.title}>Novo Requerimento</h2>
        <p style={styles.text}>Envio controlado para triagem interna da SMAD. Para esta sprint, o fluxo completo esta habilitado para Anuencia Ambiental.</p>
      </div>
      <div style={styles.alert}>Este envio constitui pre-protocolo eletronico em ambiente controlado. A formalizacao administrativa dependera de conferencia e aceite pela SMAD.</div>
      <form style={styles.form} onSubmit={(event) => submit(event, false)}>
        <div style={styles.twoCols}>
          <select style={styles.input} value={form.tipo_solicitacao} onChange={(event) => setForm((prev) => ({ ...prev, tipo_solicitacao: event.target.value }))}>
            <option value="ANUENCIA_AMBIENTAL">Anuencia Ambiental</option>
            <option value="LICENCIAMENTO_AMBIENTAL">Licenciamento Ambiental</option>
            <option value="COMPLEMENTACAO_DOCUMENTAL">Complementacao Documental</option>
            <option value="RECURSO_MANIFESTACAO">Recurso/Manifestacao</option>
            <option value="OUTRA_SOLICITACAO">Outra Solicitacao</option>
          </select>
          <input style={styles.input} placeholder="Distrito" value={form.distrito} onChange={(event) => setForm((prev) => ({ ...prev, distrito: event.target.value }))} />
        </div>
        <input style={styles.input} placeholder="Finalidade" value={form.finalidade} onChange={(event) => setForm((prev) => ({ ...prev, finalidade: event.target.value }))} required />
        <textarea style={styles.textarea} placeholder="Descricao da solicitacao" value={form.descricao} onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))} />
        <div style={styles.twoCols}>
          <input style={styles.input} placeholder="Bairro/localidade" value={form.bairro_localidade} onChange={(event) => setForm((prev) => ({ ...prev, bairro_localidade: event.target.value }))} />
          <input style={styles.input} placeholder="ID da localizacao geoambiental, se ja informada" value={form.geo_localizacao_id} onChange={(event) => setForm((prev) => ({ ...prev, geo_localizacao_id: event.target.value }))} />
        </div>
        <GeoLocationField
          value={form.geo_localizacao_id ? { id: form.geo_localizacao_id, titulo: 'Localizacao informada pelo requerente' } : null}
          helperText="Vinculo simplificado em ambiente controlado. A analise geoambiental e preliminar e nao substitui avaliacao tecnica."
        />
        <label style={styles.check}>
          <input type="checkbox" checked={form.responsabilidade} onChange={(event) => setForm((prev) => ({ ...prev, responsabilidade: event.target.checked }))} required />
          Declaro responsabilidade pelas informacoes apresentadas neste pre-protocolo.
        </label>
        <div style={styles.actions}>
          <button type="submit" style={styles.secondaryButton} disabled={saving}>Salvar rascunho</button>
          <button type="button" style={styles.primaryButton} disabled={saving} onClick={(event) => submit(event, true)}>Salvar e enviar para triagem</button>
          <button type="button" style={styles.ghostButton} onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </section>
  );
}

const styles = {
  section: {
    display: 'grid',
    gap: '16px',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: '22px',
  },
  text: {
    margin: '4px 0 0',
    color: '#64748b',
  },
  alert: {
    border: '1px solid #fde68a',
    borderRadius: '8px',
    background: '#fffbeb',
    color: '#92400e',
    padding: '12px',
    fontWeight: 800,
  },
  form: {
    display: 'grid',
    gap: '12px',
  },
  twoCols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '10px',
  },
  input: {
    minHeight: '40px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '0 10px',
  },
  textarea: {
    minHeight: '110px',
    resize: 'vertical',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '10px',
  },
  check: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    color: '#334155',
    fontWeight: 700,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  primaryButton: {
    minHeight: '40px',
    border: 0,
    borderRadius: '6px',
    background: '#0f766e',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 14px',
  },
  secondaryButton: {
    minHeight: '40px',
    border: '1px solid #0f766e',
    borderRadius: '6px',
    background: '#ffffff',
    color: '#0f766e',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 14px',
  },
  ghostButton: {
    minHeight: '40px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: 800,
    padding: '0 14px',
  },
};
