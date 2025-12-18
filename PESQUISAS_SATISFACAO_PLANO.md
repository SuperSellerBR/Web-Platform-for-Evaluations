# Módulo “Pesquisas de Satisfação” (estilo Falaê) — Plano & Registro

Este documento é o **guia vivo** para idealização, planejamento e implementação do módulo de Pesquisas de Satisfação (CSAT/NPS) como recurso **complementar** ao Cliente Oculto.

## Como usar este documento
- Use as **checklists por fase** para acompanhar execução.
- Ao concluir algo, registre no **Registro de Progresso** com data + resumo + referência (commit/PR/link interno).
- Decisões importantes devem virar um item em **Decisões (ADR)**.

---

## 1) Visão de Produto (resumo)
### Objetivo do módulo
Capturar feedback declarado do cliente final (alto volume, rápido e contínuo) por loja/período, via QR Code e link, com dashboards e alertas de insatisfação.

### Benefícios para o cliente (empresa)
- Visibilidade rápida de problemas e tendências (NPS/CSAT).
- Comparação por loja/turno/canal.
- Base operacional para reação (alertas/casos) e melhoria contínua.

### Benefícios para a plataforma
- Novo recurso/SKU, maior retenção e expansão de uso.
- Base de dados CX para automações e IA (insights acionáveis).

### Diferença: Satisfação × Cliente Oculto
- **Satisfação**: percepção declarada, sem login (público via QR/link), alto volume, excelente para detecção rápida.
- **Cliente Oculto**: auditoria observada, amostra controlada, evidências (áudio/anexos), útil para conformidade e consistência.
- **Juntos**: permitem medir “gap” (execução vs percepção) e priorizar ações.

---

## 2) Visão Arquitetural (alto nível)
- O módulo entra como um **bounded context de CX** dentro da plataforma atual.
- Recomenda-se iniciar como **submódulo** (mesmo deploy/observabilidade) com **feature toggle por empresa**.
- A coleta do cliente final exige um **canal público** (QR/link) com segurança: token assinado + expiração + rate limit + antifraude.
- Reuso esperado: editor de formulários, papéis/empresas, padrões de dashboard, pipeline de relatórios/IA (futuro).

---

## 3) Entidades e dados (conceitual)
> Conceitual (não é schema final).

- **SurveyDefinition (Pesquisa)**: título, status, versão, perguntas (NPS/estrelas/objetivas + comentário), idioma/branding, ownership (empresa).
- **SurveyDeployment (Campanha/Distribuição)**: surveyId, empresaId, lojaId (se existir), canal (QR/link), slug/token, janela ativa, regras de alerta.
- **CustomerResponse (Resposta)**: deploymentId, submittedAt, respostas + métricas (NPS/CSAT), comentário, consentimento, metadados mínimos, sinais antifraude.
- **AlertRule (Regra)**: thresholds/keywords/janelas/destinatários.
- **AlertCase (Caso)**: severidade, status, responsável, histórico.
- **Aggregates/Rollups (Agregações)**: por dia/loja/canal, métricas e tendências.

---

## 4) Fluxos principais
1. **Criação de pesquisa** (admin/gerente): criar modelo rápido → configurar campanha → publicar → gerar QR/link.
2. **Coleta da resposta** (cliente final): QR/link → formulário mobile-first → envio → agradecimento.
3. **Alerta de insatisfação**: resposta baixa/keyword → cria caso → notifica → triagem/resolução.
4. **Visualização gerencial**: dashboard agregando por loja/período/canal + fila de alertas/casos.

---

## 5) Plano de implementação em fases (checklists)

### Fase 0 — Discovery / Alinhamento
- [ ] Definir “loja” (existe? precisa existir?) e dimensão de análise (loja/PDV/filial).
- [ ] Definir papéis e permissões (admin, empresa, gerente, vendedor) para: criar/editar, ver respostas, ver alertas.
- [ ] Definir política LGPD (anonimização, consentimento, retenção, export).
- [ ] Definir antifraude mínimo (token, expiração, rate limit, dedupe).
- [ ] Definir métricas e cortes do dashboard (NPS/CSAT, período, canal, loja).

### Fase 1 — MVP funcional
- [ ] Criar “Pesquisa curta” (NPS OU estrelas + comentário) e “Campanha” com QR/link.
- [ ] Ingestão pública segura (cliente final sem login).
- [ ] Armazenamento append-only de respostas + cálculo básico de NPS/CSAT.
- [ ] Listagem interna de respostas (por empresa/campanha).

### Fase 2 — Dashboards e segmentação
- [ ] Agregações (rollups) por período/loja/canal.
- [ ] Dashboard gerencial com filtros e comparativos.
- [ ] Export básico (CSV/relatório simples).

### Fase 3 — Alertas e operação
- [ ] Regras configuráveis (thresholds + keywords).
- [ ] Criação de casos e fila (aberto/triado/resolvido), SLA simples.
- [ ] Notificações internas (e-mail/whatsapp/etc. fica para decidir depois).

### Fase 4 — IA e relatórios
- [ ] Sumarização de comentários e temas.
- [ ] Detecção de tendência/anomalia.
- [ ] Relatórios periódicos (semanal/mensal) por empresa/loja.

### Fase 5 — Cross-analysis com Cliente Oculto
- [ ] Painel unificado CX (percepção declarada vs observada).
- [ ] Correlações (por loja/turno/pilar) e “gap analysis”.
- [ ] Recomendações combinadas (playbooks por tipo de problema).

---

## 6) Registro de Progresso
| Data | Fase | Item concluído | Evidência (commit/PR/link) | Observações |
|------|------|-----------------|----------------------------|-------------|
|      |      |                 |                            |             |

---

## 7) Decisões (ADR)
> Use este formato para decisões importantes (ex.: “respostas são anônimas?”, “retém IP?”, “token expira em quanto?”).

### ADR-001 — (título)
- **Data**:
- **Contexto**:
- **Decisão**:
- **Consequências**:

---

## 8) Questões em aberto
- [ ] (ex.) Precisamos de entidade “Loja” agora ou tratamos como “ponto de venda” via metadados?
- [ ] (ex.) Resposta anônima vs captura opcional de contato (com consentimento).
- [ ] (ex.) Qual SLA e canal de notificação para alertas críticos?

---

## 9) Riscos e cuidados
- **LGPD**: minimizar dados pessoais, consentimento explícito para contato, retenção e auditoria por empresa.
- **Viés de resposta**: incentivo/seleção; dashboards devem mostrar volume e contexto.
- **Fraude/spam**: token assinado/expirável, rate limit, dedupe, detecção de padrões.
- **UX**: formulário em 15–30s, mobile-first, acessível, tolerante a rede ruim.
- **Escalabilidade**: respostas como eventos + rollups; evitar acoplamento indevido com Cliente Oculto.

