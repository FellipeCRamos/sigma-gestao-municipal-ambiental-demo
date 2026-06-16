import { useState } from 'react';
import { createLicenciamentoProcesso } from '../services/licenciamentoAdminApi';
import { pageStyles } from './shared';

const INITIAL_FORM = {
  numero_processo: '',
  ano: String(new Date().getFullYear()),
  tipo_licenca: '',
  classe: '',
  porte: '',
  atividade_principal: '',
  data_protocolo: '',
  observacoes: '',
  requerente_nome: '',
  requerente_documento: '',
  requerente_tipo: 'nao_informado',
  requerente_email: '',
  requerente_telefone: '',
  requerente_endereco: '',
  empreendimento_nome: '',
  empreendimento_endereco: '',
  empreendimento_bairro: '',
};

export default function FormProcessoLicenciamento({ navigateToPage }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [createdProcesso, setCreatedProcesso] = useState(null);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setCreatedProcesso(null);

    try {
      const response = await createLicenciamentoProcesso({
        numero_processo: form.numero_processo || undefined,
        ano: form.ano,
        tipo_licenca: form.tipo_licenca,
        classe: form.classe,
        porte: form.porte,
        atividade_principal: form.atividade_principal,
        data_protocolo: form.data_protocolo || undefined,
        observacoes: form.observacoes,
        requerente: {
          nome_razao_social: form.requerente_nome,
          documento: form.requerente_documento,
          tipo: form.requerente_tipo,
          email: form.requerente_email,
          telefone: form.requerente_telefone,
          endereco: form.requerente_endereco,
        },
        empreendimento: {
          nome: form.empreendimento_nome,
          atividade_principal: form.atividade_principal,
          endereco: form.empreendimento_endereco,
          bairro: form.empreendimento_bairro,
        },
      });

      setCreatedProcesso(response.data);
      setMessage(`Processo ${response.data.numero_processo} cadastrado com sucesso.`);
      setForm(INITIAL_FORM);
    } catch (saveError) {
      setError(saveError.message || 'Erro ao cadastrar processo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h2 style={pageStyles.sectionTitle}>Novo Processo de Licenciamento</h2>
        <p style={pageStyles.sectionSubtitle}>
          Base inicial para protocolo administrativo. Pareceres, condicionantes e emissão de licença serão evoluídos em fases futuras.
        </p>
      </section>

      {error ? <div style={{ ...pageStyles.message, ...pageStyles.dangerText }}>{error}</div> : null}
      {message ? (
        <div style={{ ...pageStyles.message, ...pageStyles.okText }}>
          {message}
          <div style={{ marginTop: '10px' }}>
            <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('processos')}>
              Ver processos
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Dados do processo</h3>
        <div style={pageStyles.formGrid}>
          <Field label="Número do processo">
            <input
              style={pageStyles.input}
              value={form.numero_processo}
              onChange={(event) => updateField('numero_processo', event.target.value)}
              placeholder="Gerado automaticamente se ficar vazio"
            />
          </Field>
          <Field label="Ano">
            <input
              style={pageStyles.input}
              value={form.ano}
              onChange={(event) => updateField('ano', event.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Tipo de licença">
            <input
              style={pageStyles.input}
              value={form.tipo_licenca}
              onChange={(event) => updateField('tipo_licenca', event.target.value)}
              required
              placeholder="Ex.: Licença ambiental simplificada"
            />
          </Field>
          <Field label="Classe">
            <input style={pageStyles.input} value={form.classe} onChange={(event) => updateField('classe', event.target.value)} />
          </Field>
          <Field label="Porte">
            <input style={pageStyles.input} value={form.porte} onChange={(event) => updateField('porte', event.target.value)} />
          </Field>
          <Field label="Atividade principal">
            <input
              style={pageStyles.input}
              value={form.atividade_principal}
              onChange={(event) => updateField('atividade_principal', event.target.value)}
              required
            />
          </Field>
          <Field label="Data de protocolo">
            <input
              type="date"
              style={pageStyles.input}
              value={form.data_protocolo}
              onChange={(event) => updateField('data_protocolo', event.target.value)}
            />
          </Field>
        </div>

        <h3 style={{ ...pageStyles.sectionTitle, marginTop: '22px' }}>Requerente</h3>
        <div style={pageStyles.formGrid}>
          <Field label="Nome ou razão social">
            <input
              style={pageStyles.input}
              value={form.requerente_nome}
              onChange={(event) => updateField('requerente_nome', event.target.value)}
              required
            />
          </Field>
          <Field label="Documento">
            <input
              style={pageStyles.input}
              value={form.requerente_documento}
              onChange={(event) => updateField('requerente_documento', event.target.value)}
            />
          </Field>
          <Field label="Tipo">
            <select
              style={pageStyles.input}
              value={form.requerente_tipo}
              onChange={(event) => updateField('requerente_tipo', event.target.value)}
            >
              <option value="nao_informado">Não informado</option>
              <option value="pessoa_fisica">Pessoa física</option>
              <option value="pessoa_juridica">Pessoa jurídica</option>
              <option value="orgao_publico">Órgão público</option>
            </select>
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              style={pageStyles.input}
              value={form.requerente_email}
              onChange={(event) => updateField('requerente_email', event.target.value)}
            />
          </Field>
          <Field label="Telefone">
            <input
              style={pageStyles.input}
              value={form.requerente_telefone}
              onChange={(event) => updateField('requerente_telefone', event.target.value)}
            />
          </Field>
          <Field label="Endereço do requerente">
            <input
              style={pageStyles.input}
              value={form.requerente_endereco}
              onChange={(event) => updateField('requerente_endereco', event.target.value)}
            />
          </Field>
        </div>

        <h3 style={{ ...pageStyles.sectionTitle, marginTop: '22px' }}>Empreendimento</h3>
        <div style={pageStyles.formGrid}>
          <Field label="Nome do empreendimento">
            <input
              style={pageStyles.input}
              value={form.empreendimento_nome}
              onChange={(event) => updateField('empreendimento_nome', event.target.value)}
              required
            />
          </Field>
          <Field label="Endereço do empreendimento">
            <input
              style={pageStyles.input}
              value={form.empreendimento_endereco}
              onChange={(event) => updateField('empreendimento_endereco', event.target.value)}
            />
          </Field>
          <Field label="Bairro/localidade">
            <input
              style={pageStyles.input}
              value={form.empreendimento_bairro}
              onChange={(event) => updateField('empreendimento_bairro', event.target.value)}
            />
          </Field>
        </div>

        <label style={{ ...pageStyles.label, marginTop: '18px' }}>
          Observações
          <textarea
            style={pageStyles.textarea}
            value={form.observacoes}
            onChange={(event) => updateField('observacoes', event.target.value)}
          />
        </label>

        <div style={pageStyles.actions}>
          <button type="submit" style={pageStyles.buttonPrimary} disabled={saving}>
            {saving ? 'Salvando...' : 'Cadastrar processo'}
          </button>
          {createdProcesso ? (
            <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('processos')}>
              Ver lista
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={pageStyles.label}>
      {label}
      {children}
    </label>
  );
}
