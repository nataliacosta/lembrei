process.env.TZ = "America/Sao_Paulo";
import { textoDoResumo } from "../src/resumo.js";
import { proximaOcorrencia } from "../../src/lib/reunioes.js";
import { categoriaDoTipo, mesclarPrefs } from "../../src/lib/prefsNotificacoes.js";
import { textoDaNotificacao } from "../../src/lib/textosNotificacao.js";
const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
const d = (n) => { const x = new Date(hoje); x.setDate(x.getDate() + n); return x; };
const ts = (x) => ({ toDate: () => x });
const u = "ana";
const base = { concluido: false, membrosUids: [u], criadoPor: u, responsavelId: u, tags: [] };
const itens = [
  { ...base, id: "a", frenteId: "f", tipo: "tarefa", titulo: "Atrasada", prazo: ts(d(-2)) },
  { ...base, id: "b", frenteId: "f", tipo: "tarefa", titulo: "Hoje 1", prazo: ts(d(0)) },
  { ...base, id: "c", frenteId: "f", tipo: "tarefa", titulo: "De outra pessoa", prazo: ts(d(0)), responsavelId: "bruno" },
  { ...base, id: "r", frenteId: "f", tipo: "reuniao", titulo: "1:1 com a gestora", prazo: null, reuniao: { frequencia: "semanal", inicio: ts(d(0)), hora: "14:00", preparos: [], feitos: {}, puladas: [] } },
];
const contratos = [{ id: "k", titulo: "Suporte", status: "ativo", medicao: { ativa: true, responsavelId: u, diaPrazo: hoje.getDate(), diasAntes: 0, feitas: {} } }];
let falhas = 0;
const conferir = (nome, obtido, esperado) => { const ok = obtido === esperado; if (!ok) falhas++; console.log(ok ? "  ✔" : "  ✘", nome, ok ? "" : `→ obtido: ${obtido} | esperado: ${esperado}`); };
const ehDiaUtil = ![0, 6].includes(hoje.getDay());
conferir("resumo", textoDoResumo(itens, contratos, u), ehDiaUtil ? "1 atrasado · 2 para hoje · reunião 14:00 (1:1 com a gestora)" : textoDoResumo(itens, contratos, u));
conferir("resumo vazio", textoDoResumo([], [], u), "Nada atrasado nem vencendo hoje. 🎉");
conferir("próxima reunião às 14:00 de hoje", proximaOcorrencia(itens[3].reuniao).toTimeString().slice(0, 5), "14:00");
conferir("categoria menção", categoriaDoTipo("mencao"), "comentarios");
conferir("categoria fila", categoriaDoTipo("fila_repriorizada"), "demandas");
conferir("prefs padrão", JSON.stringify(mesclarPrefs({ resumo: { hora: "07:30" } }).resumo), '{"ativo":true,"hora":"07:30","dias":[1,2,3,4,5]}');
conferir("título do push", textoDaNotificacao({ tipo: "mencao", autorNome: "Bruno", alvo: "Validar cronograma" }), "Bruno mencionou você em Validar cronograma");
console.log(falhas ? `${falhas} falha(s)` : "tudo ok"); process.exit(falhas ? 1 : 0);
