import { INITIAL_FORM, PORTE_RULES, RACAS_POR_ESPECIE, VACINAS_POR_ESPECIE } from './constants';

export function getPorteByPeso(peso) {
  const valor = Number(peso);

  if (!peso || Number.isNaN(valor) || valor <= 0) return '';

  if (valor <= PORTE_RULES.pequeno.max) return 'pequeno';
  if (valor <= PORTE_RULES.medio.max) return 'medio';
  return 'grande';
}

export function getPorteMensagem(porte) {
  if (!porte || !PORTE_RULES[porte]) return '';
  return PORTE_RULES[porte].label;
}

export function getVacinasEssenciaisFaltantes(especie, vacinasSelecionadas) {
  if (!especie || !VACINAS_POR_ESPECIE[especie]) return [];

  const essenciais = VACINAS_POR_ESPECIE[especie].filter((item) => item.essencial);

  return essenciais.filter((item) => !vacinasSelecionadas.includes(item.value));
}

export function validateForm(form, options = {}) {
  const { requirePeso = true, requireVacinas = true } = options;
  const errors = {};

  if (!form.nome || form.nome.trim().length < 2) {
    errors.nome = 'Informe o nome do animal com pelo menos 2 caracteres.';
  }

  if (!form.especie) {
    errors.especie = 'Selecione a espécie.';
  }

  if (!form.raca) {
    errors.raca = 'Selecione a raça.';
  }

  if (form.raca === 'outros' && !form.raca_outros.trim()) {
    errors.raca_outros = 'Informe manualmente o nome da raça.';
  }

  if (!form.sexo) {
    errors.sexo = 'Selecione o sexo do animal.';
  }

  if (!form.porte) {
    errors.porte = 'Selecione ou informe o porte.';
  }

  if (requirePeso && !form.peso_kg) {
    errors.peso_kg = 'Informe o peso do animal.';
  } else if (form.peso_kg) {
    const peso = Number(form.peso_kg);

    if (Number.isNaN(peso) || peso <= 0) {
      errors.peso_kg = 'Informe um peso valido.';
    }
  }

  if (!form.status) {
    errors.status = 'Selecione o status do animal.';
  }

  if (form.microchip && form.microchip.trim().length > 50) {
    errors.microchip = 'O microchip deve ter no máximo 50 caracteres.';
  }

  if (form.data_nascimento) {
    const birthDate = new Date(form.data_nascimento);
    const today = new Date();

    if (Number.isNaN(birthDate.getTime())) {
      errors.data_nascimento = 'Informe uma data de nascimento valida.';
    } else if (birthDate > today) {
      errors.data_nascimento = 'A data de nascimento não pode ser futura.';
    }
  }

  if (form.tutor_id && Number.isNaN(Number(form.tutor_id))) {
    errors.tutor_id = 'Selecione um tutor valido.';
  }

  if (requireVacinas && form.vacinado && form.vacinas.length === 0) {
    errors.vacinas = 'Selecione ao menos uma vacina quando houver registro vacinal.';
  }

  return errors;
}

export function buildPayload(form, vacinasCatalogo, faltantesEssenciais) {
  const vacinasSelecionadas = vacinasCatalogo
    .filter((vacina) => form.vacinas.includes(vacina.value))
    .map((vacina) => ({
      id: vacina.value,
      nome_comercial: vacina.nome_comercial,
      nome_tecnico: vacina.nome_tecnico,
      nome_popular: vacina.nome_popular,
      essencial: vacina.essencial,
      descricao: vacina.descricao,
      detalhamento: vacina.detalhamento,
    }));

  return {
    nome: form.nome.trim(),
    especie: form.especie,
    raca: form.raca === 'outros' ? form.raca_outros.trim() : form.raca,
    raca_outros: form.raca === 'outros' ? form.raca_outros.trim() : null,
    sexo: form.sexo || null,
    porte: form.porte || null,
    peso_kg: form.peso_kg ? Number(form.peso_kg) : null,
    cor: form.cor.trim() || null,
    data_nascimento: form.data_nascimento || null,
    status: form.status || 'ativo',
    microchip: form.microchip.trim() || null,
    castrado: form.castrado,
    castracao_pendente: form.castracao_pendente,
    vacinado: form.vacinado,
    vacinas: form.vacinado ? vacinasSelecionadas : [],
    grupo_vacinacao: !form.vacinado
      ? 'nao_vacinado'
      : faltantesEssenciais.length > 0
        ? 'vacinacao_incompleta'
        : 'vacinacao_essencial_ok',
    alerta_vacinal: faltantesEssenciais.map(
      (item) => `${item.nome_popular} - ${item.nome_comercial}`
    ),
    tutor_id: form.tutor_id ? Number(form.tutor_id) : null,
    territorio_id: form.territorio_id ? Number(form.territorio_id) : null,
    observacoes: form.observacoes.trim() || null,
    bairro: form.bairro.trim() || null,
    endereco_referencia: form.endereco_referencia.trim() || null,
    latitude: form.latitude ? Number(form.latitude) : null,
    longitude: form.longitude ? Number(form.longitude) : null,
  };
}

export function normalizeDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function getAnimalRacaFields(animal) {
  const especie = animal?.especie || '';
  const raca = animal?.raca || '';
  const racaOutros = animal?.raca_outros || '';

  if (!especie || !raca) {
    return {
      raca: '',
      raca_outros: racaOutros,
    };
  }

  if (racaOutros) {
    return {
      raca: 'outros',
      raca_outros: racaOutros,
    };
  }

  const racaOptions = RACAS_POR_ESPECIE[especie] || [];
  const hasKnownRaca = racaOptions.some((item) => item.value === raca);

  if (hasKnownRaca) {
    return {
      raca,
      raca_outros: '',
    };
  }

  return {
    raca: 'outros',
    raca_outros: raca,
  };
}

export function getAnimalVacinas(animal) {
  const legacyVacinas = Array.isArray(animal?.vacinas) ? animal.vacinas : [];
  const normalizadas = Array.isArray(animal?.vacinas_normalizadas)
    ? animal.vacinas_normalizadas
    : [];
  const source = legacyVacinas.length > 0 ? legacyVacinas : normalizadas;

  return source
    .map((vacina) => {
      if (typeof vacina === 'string') return vacina;
      return vacina?.vacina_codigo || vacina?.value || vacina?.id;
    })
    .filter(Boolean);
}

export function buildFormFromAnimal(animal) {
  if (!animal) return INITIAL_FORM;

  const racaFields = getAnimalRacaFields(animal);

  return {
    ...INITIAL_FORM,
    nome: animal.nome || '',
    especie: animal.especie || '',
    raca: racaFields.raca,
    raca_outros: racaFields.raca_outros,
    sexo: animal.sexo || '',
    porte: animal.porte || '',
    peso_kg:
      animal.peso_kg !== null && animal.peso_kg !== undefined ? String(animal.peso_kg) : '',
    cor: animal.cor || '',
    data_nascimento: normalizeDateInput(animal.data_nascimento),
    status: animal.status || 'ativo',
    microchip: animal.microchip || '',
    castrado: Boolean(animal.castrado),
    castracao_pendente: Boolean(animal.castracao_pendente),
    vacinado: Boolean(animal.vacinado),
    vacinas: getAnimalVacinas(animal),
    tutor_id: animal.tutor_id ? String(animal.tutor_id) : '',
    territorio_id: animal.territorio_id ? String(animal.territorio_id) : '',
    observacoes: animal.observacoes || '',
    bairro: animal.bairro || '',
    endereco_referencia: animal.endereco_referencia || '',
    latitude:
      animal.latitude !== null && animal.latitude !== undefined ? String(animal.latitude) : '',
    longitude:
      animal.longitude !== null && animal.longitude !== undefined
        ? String(animal.longitude)
        : '',
  };
}

export function buildQualityMessage(record) {
  const alerts = Array.isArray(record?.duplicidade_alertas) ? record.duplicidade_alertas : [];
  const pendencias = Array.isArray(record?.confiabilidade_pendencias)
    ? record.confiabilidade_pendencias
    : [];

  if (alerts.length > 0) {
    return `Possivel duplicidade sinalizada: ${alerts
      .map((alert) => alert.mensagem)
      .filter(Boolean)
      .slice(0, 2)
      .join(' | ')}`;
  }

  if (record?.confiabilidade_nivel === 'baixo' && pendencias.length > 0) {
    return `Confiabilidade baixa. Pendencias principais: ${pendencias
      .slice(0, 3)
      .join(' | ')}`;
  }

  return '';
}
