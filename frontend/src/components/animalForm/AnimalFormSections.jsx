import { PORTE_OPTIONS, STATUS_OPTIONS } from './constants';
import { getPorteMensagem } from './utils';

export function AnimalBasicSection({
  form,
  errors,
  handleChange,
  handlePesoChange,
  isEditMode,
  racaOptions,
  styles,
}) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Dados básicos</h3>
        <p style={styles.sectionText}>Identificação principal do animal.</p>
      </div>

      <div style={styles.grid}>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="nome">
            Nome *
          </label>
          <input
            id="nome"
            name="nome"
            type="text"
            value={form.nome}
            onChange={handleChange}
            style={styles.input}
            placeholder="Ex.: Mel"
          />
          {errors.nome ? <span style={styles.error}>{errors.nome}</span> : null}
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="especie">
            Espécie *
          </label>
          <select
            id="especie"
            name="especie"
            value={form.especie}
            onChange={handleChange}
            style={styles.input}
          >
            <option value="">Selecione</option>
            <option value="canino">Canino</option>
            <option value="felino">Felino</option>
          </select>
          {errors.especie ? <span style={styles.error}>{errors.especie}</span> : null}
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="raca">
            Raça *
          </label>
          <select
            id="raca"
            name="raca"
            value={form.raca}
            onChange={handleChange}
            style={styles.input}
            disabled={!form.especie}
          >
            <option value="">
              {form.especie ? 'Selecione' : 'Selecione a espécie primeiro'}
            </option>
            {racaOptions.map((raca) => (
              <option key={raca.value} value={raca.value}>
                {raca.label}
              </option>
            ))}
          </select>
          {errors.raca ? <span style={styles.error}>{errors.raca}</span> : null}
        </div>

        {form.raca === 'outros' ? (
          <div style={styles.field}>
            <label style={styles.label} htmlFor="raca_outros">
              Informar raça *
            </label>
            <input
              id="raca_outros"
              name="raca_outros"
              type="text"
              value={form.raca_outros}
              onChange={handleChange}
              style={styles.input}
              placeholder="Digite o nome da raça"
            />
            {errors.raca_outros ? <span style={styles.error}>{errors.raca_outros}</span> : null}
          </div>
        ) : null}

        <div style={styles.field}>
          <label style={styles.label} htmlFor="sexo">
            Sexo *
          </label>
          <select
            id="sexo"
            name="sexo"
            value={form.sexo}
            onChange={handleChange}
            style={styles.input}
          >
            <option value="">Selecione</option>
            <option value="macho">Macho</option>
            <option value="femea">Fêmea</option>
          </select>
          {errors.sexo ? <span style={styles.error}>{errors.sexo}</span> : null}
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="porte">
            Porte *
          </label>
          <select
            id="porte"
            name="porte"
            value={form.porte}
            onChange={handleChange}
            style={styles.input}
          >
            <option value="">Selecione</option>
            {PORTE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {form.porte ? <span style={styles.helper}>{getPorteMensagem(form.porte)}</span> : null}
          {errors.porte ? <span style={styles.error}>{errors.porte}</span> : null}
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="peso_kg">
            {isEditMode ? 'Peso (kg)' : 'Peso (kg) *'}
          </label>
          <input
            id="peso_kg"
            name="peso_kg"
            type="number"
            step="0.01"
            min="0"
            value={form.peso_kg}
            onChange={handlePesoChange}
            style={styles.input}
            placeholder="Ex.: 8.50"
          />
          <span style={styles.helper}>
            O porte sera ajustado automáticamente conforme o peso informado.
          </span>
          {errors.peso_kg ? <span style={styles.error}>{errors.peso_kg}</span> : null}
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="cor">
            Cor
          </label>
          <input
            id="cor"
            name="cor"
            type="text"
            value={form.cor}
            onChange={handleChange}
            style={styles.input}
            placeholder="Ex.: Caramelo"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="data_nascimento">
            Data de nascimento
          </label>
          <input
            id="data_nascimento"
            name="data_nascimento"
            type="date"
            value={form.data_nascimento}
            onChange={handleChange}
            style={styles.input}
          />
          {errors.data_nascimento ? (
            <span style={styles.error}>{errors.data_nascimento}</span>
          ) : null}
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="status">
            Status *
          </label>
          <select
            id="status"
            name="status"
            value={form.status}
            onChange={handleChange}
            style={styles.input}
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {errors.status ? <span style={styles.error}>{errors.status}</span> : null}
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="microchip">
            Microchip
          </label>
          <input
            id="microchip"
            name="microchip"
            type="text"
            value={form.microchip}
            onChange={handleChange}
            style={styles.input}
            placeholder="Ex.: 900123456789"
          />
          {errors.microchip ? <span style={styles.error}>{errors.microchip}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function AnimalHealthSection({ form, handleChange, styles }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Situação sanitária</h3>
        <p style={styles.sectionText}>Informações clínicas e de manejo sanitário.</p>
      </div>

      <div style={styles.statusCards}>
        <label style={styles.choiceCard}>
          <input
            name="castrado"
            type="checkbox"
            checked={form.castrado}
            onChange={handleChange}
          />
          <span>Castrado</span>
        </label>

        <label style={styles.choiceCard}>
          <input
            name="castracao_pendente"
            type="checkbox"
            checked={form.castracao_pendente}
            onChange={handleChange}
            disabled={form.castrado}
          />
          <span>Castração pendente</span>
        </label>

        <label style={styles.choiceCard}>
          <input
            name="vacinado"
            type="checkbox"
            checked={form.vacinado}
            onChange={handleChange}
            disabled={!form.especie}
          />
          <span>Possui registro vacinal</span>
        </label>
      </div>
    </div>
  );
}

function VaccineCard({ vacina, checked, onToggle, styles }) {
  return (
    <label
      key={vacina.value}
      style={{
        ...styles.vacinaCard,
        ...(checked ? styles.vacinaCardChecked : {}),
      }}
    >
      <div style={styles.vacinaTop}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onToggle(vacina.value, event.target.checked)}
        />
        <span
          style={{
            ...styles.badge,
            ...(vacina.essencial ? styles.badgeEssencial : styles.badgeComplementar),
          }}
        >
          {vacina.essencial ? 'Essencial' : 'Complementar'}
        </span>
      </div>

      <div style={styles.vacinaMeta}>
        <div>
          <div style={styles.vacinaLabel}>Nome comercial</div>
          <div style={styles.vacinaValue}>{vacina.nome_comercial}</div>
        </div>

        <div>
          <div style={styles.vacinaLabel}>Nome técnico</div>
          <div style={styles.vacinaValue}>{vacina.nome_tecnico}</div>
        </div>

        <div>
          <div style={styles.vacinaLabel}>Nome popular</div>
          <div style={styles.vacinaValue}>{vacina.nome_popular}</div>
        </div>
      </div>

      <div style={styles.vacinaDescricao}>{vacina.descricao}</div>
      <div style={styles.vacinaDetalhamento}>{vacina.detalhamento}</div>
    </label>
  );
}

export function AnimalVaccinationSection({
  form,
  errors,
  faltantesEssenciais,
  vacinasEssenciais,
  vacinasComplementares,
  handleVacinaChange,
  styles,
}) {
  if (!form.vacinado) return null;

  return (
    <div style={styles.sectionSoft}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Vacinação</h3>
        <p style={styles.sectionText}>
          Selecione as vacinas aplicadas conforme a espécie do animal.
        </p>
      </div>

      {faltantesEssenciais.length > 0 ? (
        <div style={styles.alertWarning}>
          <strong>Alerta vacinal:</strong> faltam vacinas essenciais.
          <ul style={styles.alertList}>
            {faltantesEssenciais.map((item) => (
              <li key={item.value}>
                {item.nome_popular} - {item.nome_comercial}
              </li>
            ))}
          </ul>
        </div>
      ) : form.vacinas.length > 0 ? (
        <div style={styles.alertInfo}>
          Todas as vacinas essenciais cadastradas para esta espécie foram marcadas.
        </div>
      ) : null}

      <div style={styles.vacinasBloco}>
        <h4 style={styles.groupTitle}>Vacinas essenciais</h4>
        <div style={styles.vacinaCardsGrid}>
          {vacinasEssenciais.map((vacina) => (
            <VaccineCard
              key={vacina.value}
              vacina={vacina}
              checked={form.vacinas.includes(vacina.value)}
              onToggle={handleVacinaChange}
              styles={styles}
            />
          ))}
        </div>
      </div>

      {vacinasComplementares.length > 0 ? (
        <div style={styles.vacinasBloco}>
          <h4 style={styles.groupTitle}>Vacinas complementares</h4>
          <div style={styles.vacinaCardsGrid}>
            {vacinasComplementares.map((vacina) => (
              <VaccineCard
                key={vacina.value}
                vacina={vacina}
                checked={form.vacinas.includes(vacina.value)}
                onToggle={handleVacinaChange}
                styles={styles}
              />
            ))}
          </div>
        </div>
      ) : null}

      {errors.vacinas ? <span style={styles.error}>{errors.vacinas}</span> : null}
    </div>
  );
}

export function AnimalTutorSection({
  form,
  errors,
  tutorOptions,
  loadingTutores,
  tutoresError,
  territorioOptions,
  territoriosError,
  handleChange,
  handleTerritorioChange,
  styles,
}) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Tutor e observações</h3>
        <p style={styles.sectionText}>
          Vinculação do responsável e informações complementares.
        </p>
      </div>

      <div style={styles.gridSingle}>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="tutor_id">
            Tutor
          </label>
          <select
            id="tutor_id"
            name="tutor_id"
            value={form.tutor_id}
            onChange={handleChange}
            style={styles.input}
            disabled={loadingTutores}
          >
            <option value="">
              {loadingTutores ? 'Carregando tutores...' : 'Sem tutor vinculado'}
            </option>
            {tutorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.tutor_id ? <span style={styles.error}>{errors.tutor_id}</span> : null}
          {tutoresError ? <span style={styles.error}>{tutoresError}</span> : null}
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="territorio_id">
              Bairro/localidade controlado
            </label>
            <select
              id="territorio_id"
              name="territorio_id"
              value={form.territorio_id}
              onChange={handleTerritorioChange}
              style={styles.input}
            >
              <option value="">Sem classificação controlada</option>
              {territorioOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {territoriosError ? <span style={styles.error}>{territoriosError}</span> : null}
            <span style={styles.helper}>
              Use o catálogo quando houver correspondência segura. O bairro textual fica como legado.
            </span>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="bairro">
              Bairro textual / legado
            </label>
            <input
              id="bairro"
              name="bairro"
              type="text"
              value={form.bairro}
              onChange={handleChange}
              style={styles.input}
              placeholder="Ex.: Centro"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="endereco_referencia">
              Endereço de referência
            </label>
            <input
              id="endereco_referencia"
              name="endereco_referencia"
              type="text"
              value={form.endereco_referencia}
              onChange={handleChange}
              style={styles.input}
              placeholder="Rua, ponto de referência ou localidade"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="latitude">
              Latitude
            </label>
            <input
              id="latitude"
              name="latitude"
              type="number"
              step="0.0000001"
              value={form.latitude}
              onChange={handleChange}
              style={styles.input}
              placeholder="-20.0000000"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="longitude">
              Longitude
            </label>
            <input
              id="longitude"
              name="longitude"
              type="number"
              step="0.0000001"
              value={form.longitude}
              onChange={handleChange}
              style={styles.input}
              placeholder="-40.0000000"
            />
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="observacoes">
            Observações
          </label>
          <textarea
            id="observacoes"
            name="observacoes"
            value={form.observacoes}
            onChange={handleChange}
            style={styles.textarea}
            rows={5}
            placeholder="Informações complementares sobre o animal."
          />
        </div>
      </div>
    </div>
  );
}
