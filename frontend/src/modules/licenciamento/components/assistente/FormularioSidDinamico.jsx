import { assistenteStyles } from './assistenteStyles';

function updateCheckboxGroup(currentValues, optionValue, checked) {
  const values = Array.isArray(currentValues) ? currentValues : [];
  if (checked) {
    return values.includes(optionValue) ? values : [...values, optionValue];
  }
  return values.filter((item) => item !== optionValue);
}

function renderField(field, value, onChange) {
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value || ''}
        onChange={(event) => onChange(field.key, event.target.value)}
        required={field.required}
        style={assistenteStyles.textarea}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        value={value || ''}
        onChange={(event) => onChange(field.key, event.target.value)}
        required={field.required}
        style={assistenteStyles.input}
      >
        <option value="">Selecione</option>
        {field.options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>{label}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'checkboxGroup') {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        {field.options.map(([optionValue, label]) => (
          <label key={optionValue} style={assistenteStyles.checkbox}>
            <input
              type="checkbox"
              checked={selectedValues.includes(optionValue)}
              onChange={(event) => onChange(field.key, updateCheckboxGroup(selectedValues, optionValue, event.target.checked))}
            />
            {label}
          </label>
        ))}
      </div>
    );
  }

  return (
    <input
      type={field.type === 'number' ? 'number' : 'text'}
      min={field.min}
      step={field.type === 'number' ? '0.01' : undefined}
      value={value || ''}
      onChange={(event) => onChange(field.key, event.target.value)}
      required={field.required}
      style={assistenteStyles.input}
    />
  );
}

export default function FormularioSidDinamico({ config, respostas, onChange, onGenerate }) {
  if (!config) return null;

  return (
    <form
      style={assistenteStyles.cardWhite}
      onSubmit={(event) => {
        event.preventDefault();
        onGenerate();
      }}
    >
      <h3 style={{ ...assistenteStyles.title, fontSize: 21 }}>{config.titulo}</h3>
      <p style={assistenteStyles.subtitle}>{config.descricao}</p>
      {!config.specific ? (
        <div style={{ ...assistenteStyles.warning, marginTop: 12 }}>
          Formulario especifico em construcao. As informacoes abaixo servem apenas para orientacao preliminar.
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
        {config.fields.map((field) => (
          <label key={field.key} style={assistenteStyles.label}>
            {field.label}
            {field.unit ? ` (${field.unit})` : ''}
            {renderField(field, respostas[field.key], onChange)}
          </label>
        ))}
      </div>

      <div style={assistenteStyles.actions}>
        <button type="submit" style={assistenteStyles.buttonPrimary}>
          Gerar pre-requerimento
        </button>
      </div>
    </form>
  );
}
