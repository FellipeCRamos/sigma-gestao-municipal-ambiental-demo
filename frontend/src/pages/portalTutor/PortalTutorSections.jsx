import { Input, Select, Textarea } from './PortalTutorFields';
import { styles } from './styles';
import {
  COMMUNICATION_PRIORITY_LABELS,
  NOTIFICATION_TYPE_LABELS,
  displayLabel,
} from '../../utils/displayLabels';

export function PortalTutorCampaignBanner({ activeCampanha }) {
  if (!activeCampanha) return null;

  return (
    <section style={styles.section}>
      <span style={styles.label}>Campanha ativa</span>
      <h2 style={styles.sectionTitle}>{activeCampanha.nome}</h2>
      <p style={styles.subtitle}>{activeCampanha.descricao}</p>
    </section>
  );
}

export function PortalTutorAuthSection({
  authMode,
  setAuthMode,
  handleRegister,
  handleLogin,
  handleRequestReset,
  handleResetPassword,
  authLoading,
  registerForm,
  loginForm,
  resetForm,
  handleChange,
  setRegisterForm,
  setLoginForm,
  setResetForm,
  authError,
  authMessage,
  showReset,
  setShowReset,
}) {
  return (
    <section style={styles.section}>
      <div style={styles.tabs}>
        <button
          type="button"
          onClick={() => setAuthMode('register')}
          style={authMode === 'register' ? styles.tabActive : styles.tab}
        >
          Criar conta
        </button>
        <button
          type="button"
          onClick={() => setAuthMode('login')}
          style={authMode === 'login' ? styles.tabActive : styles.tab}
        >
          Entrar
        </button>
      </div>

      {authMode === 'register' ? (
        <form onSubmit={handleRegister} style={styles.form}>
          <Input
            label="Nome completo"
            name="nome"
            value={registerForm.nome}
            onChange={handleChange(setRegisterForm)}
            required
          />
          <Input label="Documento" name="cpf" value={registerForm.cpf} onChange={handleChange(setRegisterForm)} />
          <Input
            label="E-mail"
            name="email"
            type="email"
            value={registerForm.email}
            onChange={handleChange(setRegisterForm)}
            required
          />
          <Input
            label="Telefone"
            name="telefone"
            value={registerForm.telefone}
            onChange={handleChange(setRegisterForm)}
          />
          <Input
            label="Endereço"
            name="endereco"
            value={registerForm.endereco}
            onChange={handleChange(setRegisterForm)}
          />
          <Input
            label="Senha"
            name="senha"
            type="password"
            value={registerForm.senha}
            onChange={handleChange(setRegisterForm)}
            required
          />
          <p style={styles.hint}>Use pelo menos 8 caracteres, combinando letras e números.</p>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              name="aceite_governanca"
              checked={registerForm.aceite_governanca}
              onChange={handleChange(setRegisterForm)}
              required
            />
            Li e aceito o Termo de Uso e a Política de Privacidade da Plataforma SIGMA.
          </label>
          <p style={styles.hint}>
            O portal usa seus dados para cadastro, campanhas, notificações e acompanhamento do animal.
          </p>
          <button type="submit" disabled={authLoading} style={styles.primaryButton}>
            {authLoading ? 'Salvando...' : 'Criar conta'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} style={styles.form}>
          <Input
            label="E-mail"
            name="email"
            type="email"
            value={loginForm.email}
            onChange={handleChange(setLoginForm)}
            required
          />
          <Input
            label="Senha"
            name="senha"
            type="password"
            value={loginForm.senha}
            onChange={handleChange(setLoginForm)}
            required
          />
          <button type="submit" disabled={authLoading} style={styles.primaryButton}>
            {authLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      )}

      {authError ? <div style={styles.alertError}>{authError}</div> : null}
      {authMessage ? <div style={styles.alertSuccess}>{authMessage}</div> : null}
      <button
        type="button"
        onClick={() => setShowReset((prev) => !prev)}
        style={styles.textButton}
      >
        Recuperar ou redefinir senha
      </button>
      {showReset ? (
        <div style={styles.resetBox}>
          <form onSubmit={handleRequestReset} style={styles.form}>
            <Input
              label="E-mail"
              name="email"
              type="email"
              value={resetForm.email}
              onChange={handleChange(setResetForm)}
              required
            />
            <button type="submit" disabled={authLoading} style={styles.secondaryButton}>
              Solicitar recuperação
            </button>
          </form>
          <form onSubmit={handleResetPassword} style={styles.form}>
            <Input
              label="Token recebido"
              name="token"
              value={resetForm.token}
              onChange={handleChange(setResetForm)}
            />
            <Input
              label="Nova senha"
              name="nova_senha"
              type="password"
              value={resetForm.nova_senha}
              onChange={handleChange(setResetForm)}
            />
            <p style={styles.hint}>Use pelo menos 8 caracteres, combinando letras e números.</p>
            <button type="submit" disabled={authLoading} style={styles.primaryButton}>
              Redefinir senha
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export function PortalTutorHubSection({
  isOnline,
  portalError,
  pwaUpdateReady,
  handleApplyPwaUpdate,
  portalResumo,
  scrollToPortalSection,
  handleRefreshPortal,
  portalLoading,
  installPrompt,
  handleInstallPwa,
  lastSyncAt,
}) {
  return (
    <section style={styles.mobileHub}>
      {!isOnline ? (
        <div style={styles.offlineBanner}>
          Sem conexao no momento. O portal evita cache de dados pessoais; novas consultas voltam quando a rede retornar.
        </div>
      ) : null}
      {portalError ? <div style={styles.alertError}>{portalError}</div> : null}
      {pwaUpdateReady ? (
        <div style={styles.updateBanner}>
          Nova versao disponível.
          <button type="button" onClick={handleApplyPwaUpdate} style={styles.smallDarkButton}>
            Atualizar agora
          </button>
        </div>
      ) : null}

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <strong>{portalResumo.inscricoes}</strong>
          <span>inscrições</span>
        </div>
        <div style={styles.summaryCard}>
          <strong>{portalResumo.animaisVinculados}</strong>
          <span>animais oficiais</span>
        </div>
        <div style={styles.summaryCard}>
          <strong>{portalResumo.notificacoesNaoLidas}</strong>
          <span>avisos novos</span>
        </div>
        <div style={styles.summaryCard}>
          <strong>{portalResumo.ocorrenciasAtivas}</strong>
          <span>ocorrências ativas</span>
        </div>
        <div style={styles.summaryCard}>
          <strong>{portalResumo.documentos}</strong>
          <span>documentos</span>
        </div>
      </div>

      <div style={styles.quickActions}>
        <button type="button" onClick={() => scrollToPortalSection('portal-animais')} style={styles.secondaryButton}>
          Meus animais
        </button>
        <button type="button" onClick={() => scrollToPortalSection('portal-inscriao')} style={styles.secondaryButton}>
          Nova inscrição
        </button>
        <button type="button" onClick={() => scrollToPortalSection('portal-acompanhamentos')} style={styles.secondaryButton}>
          Acompanhar
        </button>
        <button type="button" onClick={() => scrollToPortalSection('portal-notificacoes')} style={styles.secondaryButton}>
          Notificações
        </button>
        <button type="button" onClick={() => scrollToPortalSection('portal-documentos')} style={styles.secondaryButton}>
          Documentos
        </button>
        <button type="button" onClick={() => scrollToPortalSection('portal-carteira')} style={styles.secondaryButton}>
          Carteira
        </button>
        <button type="button" onClick={() => scrollToPortalSection('portal-preferencias')} style={styles.secondaryButton}>
          Preferências
        </button>
        <button
          type="button"
          onClick={handleRefreshPortal}
          disabled={portalLoading || !isOnline}
          style={styles.primaryButton}
        >
          {portalLoading ? 'Atualizando...' : 'Atualizar dados'}
        </button>
        {installPrompt ? (
          <button type="button" onClick={handleInstallPwa} style={styles.installButton}>
            Instalar no celular
          </button>
        ) : null}
      </div>
      <p style={styles.syncMeta}>
        {lastSyncAt
          ? `Última atualização: ${new Date(lastSyncAt).toLocaleString('pt-BR')}`
          : 'Dados carregados após entrar no portal.'}
      </p>
    </section>
  );
}

export function PortalTutorAnimalsSection({
  animaisMobile,
  handleOpenDetail,
  handleLoadCarteiraDetalhada,
}) {
  return (
    <section id="portal-animais" style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>Meus animais</h2>
          <p style={styles.subtitle}>
            Animais oficiais vinculados a inscrições ou atendimento na Plataforma SIGMA.
          </p>
        </div>
      </div>
      {animaisMobile.length === 0 ? (
        <p style={styles.subtitle}>Nenhum animal oficial vinculado ao seu portal ainda.</p>
      ) : (
        <div style={styles.animalGrid}>
          {animaisMobile.map((animal) => (
            <article key={animal.id} style={styles.animalCard}>
              <strong>{animal.nome || `Animal #${animal.id}`}</strong>
              <span>{animal.especie || 'Espécie não informada'}</span>
              <span>Microchip: {animal.microchip || 'não informado'}</span>
              <span>Identificação Animal: {animal.public_id || 'não disponível'}</span>
              <span>Carteira: {animal.carteira_resumo?.registros_ativos || 0} registros ativos</span>
              <button
                type="button"
                onClick={() => handleOpenDetail('animal', animal.id)}
                style={styles.primaryButton}
              >
                Ver animal
              </button>
              <button
                type="button"
                onClick={() => handleLoadCarteiraDetalhada(animal.id)}
                style={styles.smallButton}
              >
                Carteira detalhada
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function PortalTutorDetailPanel({ detailView, onCloseDetail, children }) {
  return (
    <section id="portal-detalhe" style={styles.detailPanel}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>Detalhe do acompanhamento</h2>
          <p style={styles.subtitle}>Animal, inscrição ou ocorrência selecionada.</p>
        </div>
        {detailView ? (
          <button type="button" onClick={onCloseDetail} style={styles.secondaryButton}>
            Fechar detalhe
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function PortalTutorDocumentsSection({
  uploadError,
  handleLoadDocumentos,
  documentosTutor,
  handleDownloadDocumento,
  handleOpenDetail,
}) {
  return (
    <section id="portal-documentos" style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>Meus documentos</h2>
          <p style={styles.subtitle}>Comprovantes e anexos dos seus fluxos na Plataforma SIGMA.</p>
        </div>
        <button type="button" onClick={handleLoadDocumentos} style={styles.secondaryButton}>
          Atualizar documentos
        </button>
      </div>
      {uploadError ? <div style={styles.alertError}>{uploadError}</div> : null}
      {documentosTutor.length === 0 ? (
        <p style={styles.subtitle}>
          Nenhum documento enviado ainda. Quando houver anexos, eles aparecerao aqui por contexto.
        </p>
      ) : (
        <div style={styles.documentGrid}>
          {documentosTutor.map((documento) => (
            <article key={documento.id} style={styles.documentCard}>
              <strong>{documento.nome_original || `Documento #${documento.id}`}</strong>
              <span>Tipo: {documento.tipo || 'documento'}</span>
              <span>
                Contexto: {documento.campanha_nome || 'campanha/inscrição'}{' '}
                {documento.protocolo ? `- ${documento.protocolo}` : ''}
              </span>
              {documento.animal_nome ? <span>Animal: {documento.animal_nome}</span> : null}
              <span>
                Data:{' '}
                {documento.created_at
                  ? new Date(documento.created_at).toLocaleString('pt-BR')
                  : 'não informada'}
              </span>
              <div style={styles.cardActions}>
                <button
                  type="button"
                  onClick={() => handleDownloadDocumento(documento)}
                  style={styles.smallButton}
                >
                  Baixar
                </button>
                {documento.inscriao_id ? (
                  <button
                    type="button"
                    onClick={() => handleOpenDetail('inscriao', documento.inscriao_id)}
                    style={styles.smallButton}
                  >
                    Ver inscrição
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function PortalTutorCarteiraSection({
  selectedCarteiraAnimalId,
  setSelectedCarteiraAnimalId,
  animaisMobile,
  vaccineFilters,
  handleVaccineFilterChange,
  handleLoadCarteiraDetalhada,
  handleClearCarteira,
  carteiraLoading,
  carteiraContent,
  origemLabels,
  statusLabels,
}) {
  return (
    <section id="portal-carteira" style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>Carteira vacinal detalhada</h2>
          <p style={styles.subtitle}>
            Histórico por animal, com origem, status e comprovação quando houver.
          </p>
        </div>
      </div>
      <div style={styles.filterGrid}>
        <Select
          label="Animal"
          name="animal_id"
          value={selectedCarteiraAnimalId}
          onChange={(event) => setSelectedCarteiraAnimalId(event.target.value)}
        >
          <option value="">Selecione</option>
          {animaisMobile.map((animal) => (
            <option key={animal.id} value={animal.id}>
              {animal.nome || `Animal #${animal.id}`}
            </option>
          ))}
        </Select>
        <Input
          label="Vacina"
          name="vacina"
          value={vaccineFilters.vacina}
          onChange={handleVaccineFilterChange}
        />
        <Select
          label="Origem"
          name="origem"
          value={vaccineFilters.origem}
          onChange={handleVaccineFilterChange}
        >
          <option value="">Todas</option>
          {Object.entries(origemLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          name="status"
          value={vaccineFilters.status}
          onChange={handleVaccineFilterChange}
        >
          <option value="">Todos</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          label="Aplicação de"
          name="data_inicio"
          type="date"
          value={vaccineFilters.data_inicio}
          onChange={handleVaccineFilterChange}
        />
        <Input
          label="Aplicação até"
          name="data_fim"
          type="date"
          value={vaccineFilters.data_fim}
          onChange={handleVaccineFilterChange}
        />
      </div>
      <div style={styles.cardActions}>
        <button
          type="button"
          onClick={() => handleLoadCarteiraDetalhada()}
          disabled={carteiraLoading}
          style={styles.primaryButton}
        >
          {carteiraLoading ? 'Consultando...' : 'Consultar carteira'}
        </button>
        <button type="button" onClick={handleClearCarteira} style={styles.secondaryButton}>
          Limpar filtros
        </button>
      </div>
      {carteiraContent}
    </section>
  );
}

export function PortalTutorPreferencesSection({
  session,
  loadPreferencias,
  preferencesError,
  preferencesMessage,
  preferences,
  handlePreferenceChange,
  preferencesMeta,
  pushLoading,
  handleEnablePush,
  handleDisablePush,
  handleSendPushTeste,
  pushMessage,
  handleSavePreferences,
  preferencesLoading,
}) {
  return (
    <section id="portal-preferencias" style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>Preferências de comunicação</h2>
          <p style={styles.subtitle}>
            Escolha avisos opcionais. Comunicações operacionais essenciais permanecem ativas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadPreferencias(session)}
          style={styles.secondaryButton}
        >
          Recarregar preferências
        </button>
      </div>
      {preferencesError ? <div style={styles.alertError}>{preferencesError}</div> : null}
      {preferencesMessage ? <div style={styles.alertSuccess}>{preferencesMessage}</div> : null}
      <div style={styles.preferenceGrid}>
        {[
          ['portal', 'Avisos no portal'],
          ['email', 'E-mail quando o canal estiver operacional'],
          ['campanhas', 'Campanhas'],
          ['inscricoes', 'Inscrições e atendimentos'],
          ['ocorrencias', 'Ocorrências'],
          ['carteira_vacinal', 'Carteira vacinal'],
        ].map(([key, label]) => (
          <label key={key} style={styles.preferenceCard}>
            <input
              type="checkbox"
              name={key}
              checked={Boolean(preferences[key])}
              onChange={handlePreferenceChange}
            />
            <span>{label}</span>
          </label>
        ))}
        <label style={styles.preferenceCardDisabled}>
          <input type="checkbox" checked readOnly />
          <span>Comunicação operacional essencial</span>
        </label>
      </div>
      <div style={styles.pushBox}>
        <strong>Web Push</strong>
        <span>
          {preferencesMeta?.observacao ||
            'Base preparada para notificações futuras mediante decisão institucional.'}
        </span>
        <span>Assinaturas ativas neste usuário: {preferencesMeta?.subscriptions_ativas || 0}</span>
        <span>
          Estado do canal:{' '}
          {preferencesMeta?.enabled ? 'habilitado no ambiente' : 'desabilitado no ambiente'}
        </span>
        <div style={styles.cardActions}>
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={pushLoading || !preferencesMeta?.enabled}
            style={styles.secondaryButton}
          >
            {pushLoading ? 'Processando...' : 'Autorizar neste dispositivo'}
          </button>
          <button
            type="button"
            onClick={handleDisablePush}
            disabled={pushLoading}
            style={styles.secondaryButton}
          >
            Remover autorização
          </button>
          <button
            type="button"
            onClick={handleSendPushTeste}
            disabled={pushLoading}
            style={styles.secondaryButton}
          >
            Enviar teste
          </button>
        </div>
        {pushMessage ? <span>{pushMessage}</span> : null}
      </div>
      <button
        type="button"
        onClick={() => handleSavePreferences()}
        disabled={preferencesLoading}
        style={styles.primaryButton}
      >
        {preferencesLoading ? 'Salvando...' : 'Salvar preferências'}
      </button>
    </section>
  );
}

export function PortalTutorInscricaoSection({
  campanhas,
  form,
  handleFormChange,
  territorioOptions,
  handleTerritorioFormChange,
  healthOptions,
  terms,
  handleArrayChange,
  formError,
  formMessage,
  formLoading,
  handleSubmitInscricao,
  handleLogout,
}) {
  return (
    <form id="portal-inscriao" onSubmit={handleSubmitInscricao} style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>Nova inscrição</h2>
          <p style={styles.subtitle}>O cadastro não garante vaga. A SMAD fará a triagem técnica.</p>
        </div>
        <button type="button" onClick={handleLogout} style={styles.secondaryButton}>
          Sair
        </button>
      </div>

      <div style={styles.grid2}>
        <Select
          label="Campanha"
          name="campanha_id"
          value={form.campanha_id}
          onChange={handleFormChange}
        >
          {campanhas.map((campanha) => (
            <option key={campanha.id} value={campanha.id}>
              {campanha.nome}
            </option>
          ))}
        </Select>
        <Select
          label="Serviço desejado"
          name="servico_desejado"
          value={form.servico_desejado}
          onChange={handleFormChange}
        >
          <option value="castracao_microchipagem">Castração e microchipagem</option>
          <option value="vacinacao">Vacinação</option>
        </Select>
      </div>

      <Select
        label="Criterio de prioridade"
        name="criterio_prioridade"
        value={form.criterio_prioridade}
        onChange={handleFormChange}
      >
        <option value="">Nenhuma das opções</option>
        <option value="animal_errante">Animal errante</option>
        <option value="cadunico">Tutor inscrito no CadUnico</option>
        <option value="protetor_independente">Protetor independente</option>
        <option value="area_ambiental">Área de proteção ambiental</option>
        <option value="comunidade_tradicional">Comunidade tradicional</option>
      </Select>
      <Textarea
        label="Detalhes da prioridade/localização"
        name="prioridade_detalhes"
        value={form.prioridade_detalhes}
        onChange={handleFormChange}
      />

      <div style={styles.grid2}>
        <Input
          label="Nome do animal"
          name="animal_nome"
          value={form.animal_nome}
          onChange={handleFormChange}
          required
        />
        <Input
          label="Raça"
          name="animal_raca"
          value={form.animal_raca}
          onChange={handleFormChange}
          required
        />
        <Select
          label="Espécie"
          name="animal_especie"
          value={form.animal_especie}
          onChange={handleFormChange}
        >
          <option value="canino">Canino</option>
          <option value="felino">Felino</option>
        </Select>
        <Select
          label="Sexo"
          name="animal_sexo"
          value={form.animal_sexo}
          onChange={handleFormChange}
        >
          <option value="femea">Fêmea</option>
          <option value="macho">Macho</option>
        </Select>
        <Input
          label="Idade apróximada"
          name="idade_aproximada"
          value={form.idade_aproximada}
          onChange={handleFormChange}
          required
        />
        <Input
          label="Peso apróximado (kg)"
          name="peso_kg"
          type="number"
          value={form.peso_kg}
          onChange={handleFormChange}
          required
        />
      </div>

      <div style={styles.grid2}>
        <Select
          label="Bairro/localidade controlado"
          name="territorio_id"
          value={form.territorio_id}
          onChange={handleTerritorioFormChange}
        >
          <option value="">Sem classificação controlada</option>
          {territorioOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input label="Bairro textual / legado" name="bairro" value={form.bairro} onChange={handleFormChange} />
      </div>

      <Textarea
        label="Endereço/localização do animal"
        name="animal_endereco"
        value={form.animal_endereco}
        onChange={handleFormChange}
      />

      <div style={styles.checkboxGroup}>
        <span style={styles.label}>Condições de saúde</span>
        {healthOptions.map((option) => (
          <label key={option.value} style={styles.checkbox}>
            <input
              type="checkbox"
              checked={form.condicoes_saude.includes(option.value)}
              onChange={(event) =>
                handleArrayChange('condicoes_saude', option.value, event.target.checked)
              }
            />
            {option.label}
          </label>
        ))}
      </div>

      <div style={styles.grid2}>
        <Select
          label="Para fêmeas"
          name="condicao_femea"
          value={form.condicao_femea}
          onChange={handleFormChange}
        >
          <option value="nao_se_aplica">Não se aplica</option>
          <option value="prenha">Prenha</option>
          <option value="cio">No cio</option>
          <option value="amamentando">Amamentando</option>
        </Select>
        <Input label="Microchip" name="microchip" value={form.microchip} onChange={handleFormChange} />
      </div>

      <Textarea
        label="Localização em caso de perda"
        name="localizacao_perda"
        value={form.localizacao_perda}
        onChange={handleFormChange}
      />
      <Input
        label="Carteira de vacinação (link ou observação)"
        name="carteira_vacinacao"
        value={form.carteira_vacinacao}
        onChange={handleFormChange}
      />

      <label style={styles.checkbox}>
        <input
          type="checkbox"
          name="cirurgia_anterior"
          checked={form.cirurgia_anterior}
          onChange={handleFormChange}
        />
        O animal ja passou por cirurgia anteriormente
      </label>
      <label style={styles.checkbox}>
        <input
          type="checkbox"
          name="agressivo"
          checked={form.agressivo}
          onChange={handleFormChange}
        />
        O animal e agressivo ou de dificil manejo
      </label>

      <div style={styles.checkboxGroup}>
        <span style={styles.label}>Declarações obrigatorias</span>
        {terms.map((term) => (
          <label key={term.value} style={styles.checkbox}>
            <input
              type="checkbox"
              checked={form.declaracoes.includes(term.value)}
              onChange={(event) =>
                handleArrayChange('declaracoes', term.value, event.target.checked)
              }
            />
            {term.label}
          </label>
        ))}
      </div>

      {formError ? <div style={styles.alertError}>{formError}</div> : null}
      {formMessage ? <div style={styles.alertSuccess}>{formMessage}</div> : null}

      <button type="submit" disabled={formLoading} style={styles.primaryButton}>
        {formLoading ? 'Enviando...' : 'Enviar inscrição'}
      </button>
    </form>
  );
}

export function PortalTutorAsideSection({
  ocorrenciaForm,
  handleSubmitOcorrencia,
  handleOcorrenciaChange,
  handleTerritorioOcorrenciaChange,
  territorioOptions,
  ocorrenciaMessage,
  ocorrencias,
  ocorrenciaTipoLabels,
  ocorrenciaStatusLabels,
  handleOpenDetail,
  notificacaoResumo,
  handleMarkTodasNotificacoesLidas,
  notificacaoLoading,
  notificacaoFiltro,
  setNotificacaoFiltro,
  loadNotificacoes,
  session,
  notificacoes,
  notificacaoMessage,
  handleMarkNotificacaoLida,
  handleOpenNotificacao,
  uploadError,
  minhasInscricoes,
  documentosPorInscricao,
  carteirasPorAnimal,
  statusLabels,
  servicoLabels,
  handleDownloadDocumento,
  onOpenPublico,
  handleLoadCarteiraDetalhada,
  handleUploadDocumento,
  uploadingId,
}) {
  return (
    <aside style={styles.section}>
      <div id="portal-ocorrencias" style={styles.asideBlock}>
        <h2 style={styles.sectionTitle}>Perda e encontro</h2>
        <form onSubmit={handleSubmitOcorrencia} style={styles.form}>
          <Select label="Tipo" name="tipo" value={ocorrenciaForm.tipo} onChange={handleOcorrenciaChange}>
            {Object.entries(ocorrenciaTipoLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Titulo"
            name="titulo"
            value={ocorrenciaForm.titulo}
            onChange={handleOcorrenciaChange}
            required
          />
          <Select
            label="Bairro/localidade controlado"
            name="territorio_id"
            value={ocorrenciaForm.territorio_id}
            onChange={handleTerritorioOcorrenciaChange}
          >
            <option value="">Sem classificação controlada</option>
            {territorioOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input
            label="Bairro textual / legado"
            name="bairro"
            value={ocorrenciaForm.bairro}
            onChange={handleOcorrenciaChange}
          />
          <Textarea
            label="Endereço de referência"
            name="endereco_referencia"
            value={ocorrenciaForm.endereco_referencia}
            onChange={handleOcorrenciaChange}
          />
          <Textarea
            label="Descrição"
            name="descricao"
            value={ocorrenciaForm.descricao}
            onChange={handleOcorrenciaChange}
          />
          <button type="submit" style={styles.primaryButton}>
            Enviar ocorrência
          </button>
        </form>
        {ocorrenciaMessage ? <div style={styles.alertSuccess}>{ocorrenciaMessage}</div> : null}
        {ocorrencias.length > 0 ? (
          <div style={styles.cards}>
            {ocorrencias.map((ocorrencia) => (
              <article key={ocorrencia.id} style={styles.followCard}>
                <strong>{ocorrencia.titulo}</strong>
                <span>{ocorrenciaTipoLabels[ocorrencia.tipo] || ocorrencia.tipo}</span>
                <span>{ocorrenciaStatusLabels[ocorrencia.status] || ocorrencia.status}</span>
                <span>{ocorrencia.territorio_nome || ocorrencia.bairro || 'Bairro não informado'}</span>
                <button
                  type="button"
                  onClick={() => handleOpenDetail('ocorrencia', ocorrencia.id)}
                  style={styles.smallButton}
                >
                  Ver ocorrência
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div id="portal-notificacoes" style={styles.asideBlock}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Notificações</h2>
            <p style={styles.subtitle}>
              {notificacaoResumo
                ? `${notificacaoResumo.nao_lidas} novas; ${notificacaoResumo.requer_acao} pedem atenção.`
                : 'Avisos do seu portal.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleMarkTodasNotificacoesLidas}
            disabled={notificacaoLoading}
            style={styles.secondaryButton}
          >
            Marcar todas lidas
          </button>
        </div>
        <div style={styles.filterGrid}>
          <Select
            label="Filtro"
            name="notificacao_status"
            value={notificacaoFiltro}
            onChange={(event) => setNotificacaoFiltro(event.target.value)}
          >
            <option value="">Todas</option>
            <option value="nao_lida">Não lidas</option>
            <option value="lida">Lidas</option>
          </Select>
          <button
            type="button"
            onClick={() => loadNotificacoes(session, notificacaoFiltro)}
            disabled={notificacaoLoading}
            style={styles.secondaryButton}
          >
            {notificacaoLoading ? 'Atualizando...' : 'Atualizar avisos'}
          </button>
        </div>
        {notificacaoMessage ? <div style={styles.alertSuccess}>{notificacaoMessage}</div> : null}
        {notificacoes.length === 0 ? (
          <p style={styles.subtitle}>Nenhuma notificação até o momento.</p>
        ) : (
          <div style={styles.cards}>
            {notificacoes.map((notificacao) => (
              <article
                key={notificacao.id}
                style={notificacao.status === 'lida' ? styles.notificationRead : styles.notificationCard}
              >
                <div style={styles.notificationHeader}>
                  <strong>{notificacao.titulo}</strong>
                  <span style={notificacao.status === 'lida' ? styles.statusPillMuted : styles.statusPill}>
                    {notificacao.status === 'lida' ? 'Lida' : 'Nova'}
                  </span>
                </div>
                <span>{notificacao.mensagem}</span>
                <span>
                  Tipo: {displayLabel(notificacao.tipo, NOTIFICATION_TYPE_LABELS, 'Operacional')} | Prioridade:{' '}
                  {displayLabel(notificacao.prioridade, COMMUNICATION_PRIORITY_LABELS, 'Normal')}
                </span>
                {notificacao.requer_acao ? <span>Este aviso pode exigir acompanhamento.</span> : null}
                <span>{new Date(notificacao.created_at).toLocaleString('pt-BR')}</span>
                {notificacao.status !== 'lida' ? (
                  <button
                    type="button"
                    onClick={() => handleMarkNotificacaoLida(notificacao.id)}
                    style={styles.smallButton}
                  >
                    Marcar como lida
                  </button>
                ) : null}
                {['campanha_inscriao', 'campanha_inscricoes', 'ocorrencia'].includes(notificacao.ref_tipo) &&
                notificacao.ref_id ? (
                  <button
                    type="button"
                    onClick={() => handleOpenNotificacao(notificacao)}
                    style={styles.smallButton}
                  >
                    Abrir acompanhamento
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <h2 id="portal-acompanhamentos" style={styles.sectionTitle}>
        Meus acompanhamentos
      </h2>
      {uploadError ? <div style={styles.alertError}>{uploadError}</div> : null}
      {minhasInscricoes.length === 0 ? (
        <p style={styles.subtitle}>Nenhuma inscrição enviada ainda.</p>
      ) : (
        <div style={styles.cards}>
          {minhasInscricoes.map((inscriao) => {
            const documentos = documentosPorInscricao[inscriao.id] || inscriao.documentos || [];
            const carteira = inscriao.animal_id ? carteirasPorAnimal[inscriao.animal_id] : null;
            const rgAnimal = carteira?.animal?.public_id;

            return (
              <article key={inscriao.id} style={styles.followCard}>
                <strong>{inscriao.animal_nome}</strong>
                <span>{inscriao.protocolo}</span>
                <span>{statusLabels[inscriao.status] || inscriao.status}</span>
                <span>{servicoLabels[inscriao.servico_desejado] || inscriao.servico_desejado}</span>
                <span>Território: {inscriao.territorio_nome || inscriao.bairro || 'não informado'}</span>
                <span>Microchip: {inscriao.microchip || 'não informado'}</span>
                <span>Documentos: {documentos.length}</span>
                {documentos.length > 0 ? (
                  <div style={styles.documentList}>
                    {documentos.map((documento) => (
                      <button
                        key={documento.id}
                        type="button"
                        onClick={() => handleDownloadDocumento(documento)}
                        style={styles.smallButton}
                      >
                        {documento.nome_original}
                      </button>
                    ))}
                  </div>
                ) : null}
                {inscriao.agendamento_data ? (
                  <span>
                    Agendamento: {new Date(inscriao.agendamento_data).toLocaleString('pt-BR')}
                  </span>
                ) : null}
                {inscriao.animal_id ? (
                  <span>Cadastro oficial vinculado: animal #{inscriao.animal_id}</span>
                ) : null}
                <div style={styles.cardActions}>
                  <button
                    type="button"
                    onClick={() => handleOpenDetail('inscriao', inscriao.id)}
                    style={styles.smallButton}
                  >
                    Ver inscrição
                  </button>
                  {inscriao.animal_id ? (
                    <button
                      type="button"
                      onClick={() => handleOpenDetail('animal', inscriao.animal_id)}
                      style={styles.smallButton}
                    >
                      Ver animal
                    </button>
                  ) : null}
                </div>
                {rgAnimal ? (
                  <div style={styles.rgBox}>
                    <strong>Identificação Animal</strong>
                    <span>{rgAnimal}</span>
                    <span>
                      {carteira.animal?.perfil_publico_ativo
                        ? 'Perfil público ativo'
                        : 'Perfil público restrito'}
                    </span>
                    <button type="button" onClick={onOpenPublico} style={styles.smallButton}>
                      Consultar painel público
                    </button>
                  </div>
                ) : null}
                {carteira ? (
                  <div style={styles.vaccineBox}>
                    <strong>Carteira vacinal</strong>
                    <span>{carteira.resumo?.registros_ativos || 0} registros ativos</span>
                    <span>{carteira.resumo?.observacao}</span>
                    {carteira.registros?.slice(0, 3).map((registro) => (
                      <span key={registro.id}>
                        {registro.vacina_nome_popular || registro.vacina_nome}: {registro.status_registro}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleLoadCarteiraDetalhada(inscriao.animal_id)}
                      style={styles.smallButton}
                    >
                      Ver carteira detalhada
                    </button>
                  </div>
                ) : null}
                <label style={styles.uploadLabel} className="sigba-mobile-upload">
                  {uploadingId === inscriao.id ? 'Enviando...' : 'Anexar documento'}
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    onChange={(event) => handleUploadDocumento(inscriao.id, event)}
                    style={styles.fileInput}
                    disabled={uploadingId === inscriao.id}
                  />
                </label>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}
