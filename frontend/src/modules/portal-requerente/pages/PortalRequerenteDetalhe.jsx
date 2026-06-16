import { useState } from 'react';
import GeoLocationField from '../../../core/components/GeoLocationField';
import RequerenteLinhaTempo from '../components/RequerenteLinhaTempo';
import RequerentePendencias from '../components/RequerentePendencias';
import RequerenteStatusBadge from '../components/RequerenteStatusBadge';
import RequerenteUploadDocumentos from '../components/RequerenteUploadDocumentos';

const TABS = ['Dados', 'Documentos', 'Pendencias', 'Historico'];

function label(value = '') {
  return String(value || '-').replace(/_/g, ' ');
}

export default function PortalRequerenteDetalhe({ requerimento, onBack, onEnviar, onUpload, onResponder, loading = false }) {
  const [tab, setTab] = useState(TABS[0]);

  if (!requerimento) return null;

  const canEnviar = ['RASCUNHO', 'DEVOLVIDO_PARA_COMPLEMENTACAO', 'COMPLEMENTADO'].includes(requerimento.status);

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <button type="button" style={styles.back} onClick={onBack}>Voltar</button>
          <h2 style={styles.title}>{requerimento.codigo}</h2>
          <p style={styles.text}>{requerimento.finalidade}</p>
        </div>
        <RequerenteStatusBadge status={requerimento.status} />
      </div>
      <div style={styles.notice}>Acompanhamento simplificado. Analises tecnicas, decisoes e atos administrativos permanecem sob controle interno da SMAD.</div>
      {canEnviar ? (
        <button type="button" style={styles.primaryButton} onClick={() => onEnviar?.(requerimento.id)} disabled={loading}>
          Enviar para triagem
        </button>
      ) : null}
      <div style={styles.tabs}>
        {TABS.map((item) => <button key={item} type="button" style={tab === item ? styles.tabActive : styles.tab} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      {tab === 'Dados' ? (
        <div style={styles.grid}>
          <Info label="Tipo" value={label(requerimento.tipo_solicitacao)} />
          <Info label="Modulo destino" value={label(requerimento.modulo_destino)} />
          <Info label="Distrito" value={requerimento.distrito || '-'} />
          <Info label="Bairro/localidade" value={requerimento.bairro_localidade || '-'} />
          <Info label="Processo interno" value={requerimento.numero_processo_gerado || 'Aguardando aceite interno'} />
          <Info label="Protocolo interno" value={requerimento.numero_protocolo_gerado || 'Aguardando aceite interno'} />
          <div style={styles.full}>
            <GeoLocationField
              value={requerimento.geo_localizacao_id ? { id: requerimento.geo_localizacao_id, titulo: 'Localizacao vinculada ao pre-protocolo' } : null}
              helperText="Analise geoambiental preliminar/interna; nao substitui avaliacao tecnica."
            />
          </div>
          <div style={styles.full}>
            <strong>Descricao</strong>
            <p style={styles.text}>{requerimento.descricao || '-'}</p>
          </div>
        </div>
      ) : null}
      {tab === 'Documentos' ? <RequerenteUploadDocumentos documentos={requerimento.documentos || []} onUpload={(payload) => onUpload?.(requerimento.id, payload)} /> : null}
      {tab === 'Pendencias' ? <RequerentePendencias pendencias={requerimento.pendencias || []} onResponder={(pendenciaId, resposta) => onResponder?.(requerimento.id, pendenciaId, resposta)} /> : null}
      {tab === 'Historico' ? <RequerenteLinhaTempo historico={requerimento.historico || []} /> : null}
    </section>
  );
}

function Info({ label: title, value }) {
  return (
    <div style={styles.info}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  section: {
    display: 'grid',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'start',
    flexWrap: 'wrap',
  },
  title: {
    margin: '4px 0 0',
    color: '#0f172a',
    fontSize: '24px',
  },
  text: {
    margin: '4px 0 0',
    color: '#64748b',
    lineHeight: 1.5,
  },
  notice: {
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    background: '#eff6ff',
    color: '#1e3a8a',
    padding: '12px',
    fontWeight: 700,
  },
  back: {
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    minHeight: '32px',
    cursor: 'pointer',
    color: '#334155',
    fontWeight: 800,
    padding: '0 10px',
  },
  primaryButton: {
    justifySelf: 'start',
    minHeight: '40px',
    border: 0,
    borderRadius: '6px',
    background: '#0f766e',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 14px',
  },
  tabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '8px',
  },
  tab: {
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    minHeight: '34px',
    cursor: 'pointer',
    color: '#334155',
    fontWeight: 800,
    padding: '0 10px',
  },
  tabActive: {
    border: '1px solid #0f766e',
    borderRadius: '6px',
    background: '#0f766e',
    minHeight: '34px',
    cursor: 'pointer',
    color: '#ffffff',
    fontWeight: 900,
    padding: '0 10px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '10px',
  },
  info: {
    display: 'grid',
    gap: '4px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
  },
  full: {
    gridColumn: '1 / -1',
  },
};
