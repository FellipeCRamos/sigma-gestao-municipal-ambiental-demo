import { useEffect, useMemo, useRef, useState } from 'react';
import { createAnimal, getTerritorios, getTutores, updateAnimal } from '../services/api';
import {
  AnimalBasicSection,
  AnimalHealthSection,
  AnimalTutorSection,
  AnimalVaccinationSection,
} from './animalForm/AnimalFormSections';
import { INITIAL_FORM, RACAS_POR_ESPECIE, VACINAS_POR_ESPECIE } from './animalForm/constants';
import { styles } from './animalForm/styles';
import {
  buildFormFromAnimal,
  buildPayload,
  buildQualityMessage,
  getPorteByPeso,
  getVacinasEssenciaisFaltantes,
  validateForm,
} from './animalForm/utils';

export default function AnimalForm({
  animal = null,
  mode = 'create',
  onAnimalCreated,
  onAnimalSaved,
  onCancel,
}) {
  const [form, setForm] = useState(() => buildFormFromAnimal(animal));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [qualityMessage, setQualityMessage] = useState(() => buildQualityMessage(animal));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previousEspecieRef = useRef(form.especie);
  const isEditMode = mode === 'edit' && animal?.id;

  const [tutores, setTutores] = useState([]);
  const [territorios, setTerritorios] = useState([]);
  const [loadingTutores, setLoadingTutores] = useState(true);
  const [tutoresError, setTutoresError] = useState('');
  const [territoriosError, setTerritoriosError] = useState('');

  useEffect(() => {
    const nextForm = buildFormFromAnimal(animal);
    previousEspecieRef.current = nextForm.especie;
    setForm(nextForm);
    setErrors({});
    setSubmitError('');
    setSuccessMessage('');
    setQualityMessage(buildQualityMessage(animal));
  }, [animal]);

  useEffect(() => {
    async function loadSupportData() {
      try {
        setLoadingTutores(true);
        setTutoresError('');

        const [tutoresResponse, territoriosResponse] = await Promise.all([
          getTutores(),
          getTerritorios().catch((error) => {
            setTerritoriosError(error.message || 'Não foi possível carregar os territórios.');
            return { data: [] };
          }),
        ]);

        setTutores(Array.isArray(tutoresResponse?.data) ? tutoresResponse.data : []);
        setTerritorios(Array.isArray(territoriosResponse?.data) ? territoriosResponse.data : []);
      } catch (error) {
        setTutoresError(error.message || 'Não foi possível carregar os tutores.');
      } finally {
        setLoadingTutores(false);
      }
    }

    loadSupportData();
  }, []);

  useEffect(() => {
    if (previousEspecieRef.current === form.especie) {
      return;
    }

    previousEspecieRef.current = form.especie;

    setForm((prev) => ({
      ...prev,
      raca: '',
      raca_outros: '',
      vacinas: [],
      vacinado: false,
    }));

    setErrors((prev) => ({
      ...prev,
      raca: '',
      raca_outros: '',
      vacinas: '',
    }));
  }, [form.especie]);

  useEffect(() => {
    if (!form.vacinado) {
      setForm((prev) => ({ ...prev, vacinas: [] }));
      setErrors((prev) => ({ ...prev, vacinas: '' }));
    }
  }, [form.vacinado]);

  useEffect(() => {
    if (form.castrado && form.castracao_pendente) {
      setForm((prev) => ({ ...prev, castracao_pendente: false }));
    }
  }, [form.castrado, form.castracao_pendente]);

  useEffect(() => {
    setForm((prev) => {
      const porteCalculado = getPorteByPeso(prev.peso_kg);

      if (porteCalculado && porteCalculado !== prev.porte) {
        return {
          ...prev,
          porte: porteCalculado,
        };
      }

      if (!prev.peso_kg && prev.porte) {
        return {
          ...prev,
          porte: '',
        };
      }

      return prev;
    });
  }, [form.peso_kg]);

  const tutorOptions = useMemo(
    () =>
      tutores.map((tutor) => ({
        value: tutor.id,
        label: tutor.cpf ? `${tutor.nome} - Documento ${tutor.cpf}` : tutor.nome,
      })),
    [tutores]
  );

  const territorioOptions = useMemo(
    () =>
      territorios.map((territorio) => ({
        value: String(territorio.id),
        label: territorio.categoria
          ? `${territorio.nome} (${territorio.categoria})`
          : territorio.nome,
        nome: territorio.nome,
      })),
    [territorios]
  );

  const racaOptions = useMemo(() => {
    if (!form.especie || !RACAS_POR_ESPECIE[form.especie]) return [];
    return RACAS_POR_ESPECIE[form.especie];
  }, [form.especie]);

  const vacinasCatalogo = useMemo(() => {
    if (!form.especie || !VACINAS_POR_ESPECIE[form.especie]) return [];
    return VACINAS_POR_ESPECIE[form.especie];
  }, [form.especie]);

  const vacinasEssenciais = useMemo(
    () => vacinasCatalogo.filter((item) => item.essencial),
    [vacinasCatalogo]
  );
  const vacinasComplementares = useMemo(
    () => vacinasCatalogo.filter((item) => !item.essencial),
    [vacinasCatalogo]
  );

  const faltantesEssenciais = useMemo(() => {
    if (!form.vacinado) return [];
    return getVacinasEssenciaisFaltantes(form.especie, form.vacinas);
  }, [form.especie, form.vacinas, form.vacinado]);

  function clearFeedback() {
    setSubmitError('');
    setSuccessMessage('');
    setQualityMessage('');
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }));

    clearFeedback();
  }

  function handleTerritorioChange(event) {
    const { value } = event.target;
    const selected = territorioOptions.find((option) => option.value === value);

    setForm((prev) => ({
      ...prev,
      territorio_id: value,
      bairro: selected?.nome || prev.bairro,
    }));

    clearFeedback();
  }

  function handlePesoChange(event) {
    const { value } = event.target;

    setForm((prev) => ({
      ...prev,
      peso_kg: value,
    }));

    setErrors((prev) => ({
      ...prev,
      peso_kg: '',
      porte: '',
    }));

    clearFeedback();
  }

  function handleVacinaChange(vacinaValue, checked) {
    setForm((prev) => {
      const current = prev.vacinas || [];

      if (checked) {
        if (current.includes(vacinaValue)) {
          return prev;
        }

        return {
          ...prev,
          vacinas: [...current, vacinaValue],
        };
      }

      return {
        ...prev,
        vacinas: current.filter((item) => item !== vacinaValue),
      };
    });

    setErrors((prev) => ({
      ...prev,
      vacinas: '',
    }));

    clearFeedback();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validateForm(form, {
      requirePeso: !isEditMode,
      requireVacinas: !isEditMode,
    });

    setErrors(validationErrors);
    clearFeedback();

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = buildPayload(form, vacinasCatalogo, faltantesEssenciais);

      if (isEditMode) {
        const response = await updateAnimal(animal.id, payload);

        setSuccessMessage('Animal atualizado com sucesso.');
        setQualityMessage(buildQualityMessage(response?.data));

        if (typeof onAnimalSaved === 'function') {
          onAnimalSaved(response?.data);
        }

        return;
      }

      const response = await createAnimal(payload);

      setSuccessMessage('Animal cadastrado com sucesso.');
      setQualityMessage(buildQualityMessage(response?.data));
      previousEspecieRef.current = INITIAL_FORM.especie;
      setForm(INITIAL_FORM);

      if (typeof onAnimalCreated === 'function') {
        onAnimalCreated(response?.data);
      }
    } catch (error) {
      setSubmitError(error.message || 'Falha ao salvar o animal.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{isEditMode ? 'Edição de animal' : 'Cadastro de Animal'}</h2>
          <p style={styles.subtitle}>
            {isEditMode
              ? 'Atualize os dados do animal selecionado.'
              : 'Preencha os dados abaixo para registrar um novo animal no sistema.'}
          </p>
        </div>

        <div style={styles.headerBadge}>{isEditMode ? 'Editando cadastro' : 'Novo cadastro'}</div>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <AnimalBasicSection
          form={form}
          errors={errors}
          handleChange={handleChange}
          handlePesoChange={handlePesoChange}
          isEditMode={isEditMode}
          racaOptions={racaOptions}
          styles={styles}
        />

        <AnimalHealthSection form={form} handleChange={handleChange} styles={styles} />

        <AnimalVaccinationSection
          form={form}
          errors={errors}
          faltantesEssenciais={faltantesEssenciais}
          vacinasEssenciais={vacinasEssenciais}
          vacinasComplementares={vacinasComplementares}
          handleVacinaChange={handleVacinaChange}
          styles={styles}
        />

        <AnimalTutorSection
          form={form}
          errors={errors}
          tutorOptions={tutorOptions}
          loadingTutores={loadingTutores}
          tutoresError={tutoresError}
          territorioOptions={territorioOptions}
          territoriosError={territoriosError}
          handleChange={handleChange}
          handleTerritorioChange={handleTerritorioChange}
          styles={styles}
        />

        {submitError ? <div style={styles.alertError}>{submitError}</div> : null}
        {qualityMessage ? <div style={styles.alertWarning}>{qualityMessage}</div> : null}
        {successMessage ? <div style={styles.alertSuccess}>{successMessage}</div> : null}

        <div style={styles.actions}>
          {typeof onCancel === 'function' ? (
            <button type="button" onClick={onCancel} style={styles.secondaryButton}>
              Cancelar ediao
            </button>
          ) : null}
          <button type="submit" disabled={isSubmitting} style={styles.button}>
            {isSubmitting ? 'Salvando...' : isEditMode ? 'Salvar alterações' : 'Cadastrar animal'}
          </button>
        </div>
      </form>
    </section>
  );
}
