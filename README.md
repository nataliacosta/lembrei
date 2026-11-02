# Lembrei!

App para cadastrar e acompanhar "frentes" (projetos/assuntos) e os itens dentro delas — tarefas,
acompanhamentos, urgências, consultas, status e acontecimentos — com lembretes manuais, tags livres
e compartilhamento por frente. Também acompanha **contratos**: fornecedor, vencimento, aditivos e
cancelamentos, com alertas de vencimento e pendências de TI no painel geral.

Stack: React + Vite, Firebase Auth (Google) e Cloud Firestore.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com os dados do seu projeto Firebase (veja abaixo)
npm run dev
```

Sem o `.env` preenchido, o app mostra uma tela avisando que falta configurar — não quebra.

## Configurando o Firebase (tudo pela interface do console.firebase.google.com)

1. Criar o projeto no [Firebase Console](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → ativar **Google**.
3. **Firestore Database** → criar banco (modo produção, escolher a região).
4. **Configurações do projeto** → Geral → "Seus apps" → adicionar um app Web → copiar o objeto de
   configuração para o `.env` (prefixo `VITE_`, ver `.env.example`).
5. **Firestore → Regras**: colar o conteúdo de `firestore.rules`.
6. (Opcional, evita índice quebrado) **Firestore → Índices**: os índices compostos necessários estão
   em `firestore.indexes.json` — também são criados automaticamente via `firebase deploy` ou por um
   link de erro que o próprio Firestore mostra na primeira consulta que precisar deles.

## Modelo de dados (Firestore)

```
usuarios/{uid}
  nome, email, avatarUrl, criadoEm

frentes/{frenteId}
  nome, descricao, cor, donoId
  membros: { uid: "proprietario" | "editor" | "visualizador" }
  membrosUids: [uid, ...]            // cópia das chaves de "membros", pra poder consultar
  convitesPendentes: [{email, papel}]
  convitesPendentesEmails: [email]   // idem, pra array-contains
  criadoEm, atualizadoEm, arquivada

frentes/{frenteId}/itens/{itemId}
  tipo: tarefa | acompanhamento | urgencia | consulta | status | acontecimento
  titulo, descricao
  status, prazo                      // só usados se o tipo fizer sentido com eles
  responsavelId, responsavelNome
  camposCustom: [{label, valor}]     // campos variáveis
  tags: [string]
  concluido, concluidoEm
  lembrete: { ativo, proximaVerificacao, mensagem, recorrente, status } | null
  criadoPor, frenteId, membrosUids, ordem, criadoEm, atualizadoEm

contratos/{contratoId}
  titulo, numero, fornecedor, escopo, vencimento
  status: ativo | aditivo | cancelamento | cancelado   // calculado, não editável direto
  donoId, membros, membrosUids, convitesPendentes, convitesPendentesEmails
  criadoEm, atualizadoEm

contratos/{contratoId}/aditivos/{aditivoId}
  dataSolicitacao, pendenteEm: "TI" | "Governança"
  tipo: ["Prazo" | "Custo" | "Escopo", ...]   // um ou mais
  numeroRQS, motivo
  finalizado, finalizadoEm
  criadoPor, contratoId, membrosUids, criadoEm, atualizadoEm

contratos/{contratoId}/cancelamentos/{cancelamentoId}
  dataSolicitacao, motivo, finalizado, finalizadoEm
  criadoPor, contratoId, criadoEm, atualizadoEm
```

### Como funciona o compartilhamento sem backend

Convidar por e-mail só grava `{email, papel}` em `convitesPendentes` na frente/contrato (não existe
busca de uid por e-mail sem uma Cloud Function). Quando a pessoa convidada faz login pela primeira
vez com aquele e-mail, o próprio app resolve o convite automaticamente
(`resgatarConvitesPendentes`/`resgatarConvitesPendentesContratos`) e libera o acesso — ver
`firestore.rules`, funções `aceitandoConvite`/`aceitandoConviteContrato`.

### Status do contrato e alertas de vencimento

O `status` do contrato é todo derivado por código (nunca editado direto na tela): criar um aditivo
põe o contrato em "aditivo em andamento"; finalizar o aditivo ativo devolve pra "ativo"; criar um
cancelamento põe em "cancelamento em andamento"; finalizar o cancelamento leva a "cancelado" — ver
`src/lib/contratos.js` (`criarAditivo`, `finalizarAditivo`, `criarCancelamento`,
`finalizarCancelamento`, todos em batch junto com a mudança de status).

O alerta de vencimento (`src/lib/datas.js`, `alertaVencimento`) segue a regra: vencido = alerta
máximo; sem aditivo ativo, alerta a partir de 3 meses antes; com aditivo ativo, a partir de 1 mês
antes. Contratos cancelados não geram alerta.

## Build e deploy

```bash
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

(`firebase.json` já aponta o Hosting pra pasta `dist/`.)
