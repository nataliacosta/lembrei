// Várias medições no mesmo mês (lógica pura, sem Firebase).
//
// contratos/{id}.medicao.nomes: ["Sustentação", "Projetos"] (vazio = uma só).
// medicoes/{id}: id = "AAAA-MM" para a medição única (como sempre foi) ou
// "AAAA-MM--nome" quando tem nome; campos mes, nome ("" na única) e extra
// (true na medição fora do comum, criada na hora de subir).

import { normalizarNome } from "./alocacoes.js";

export function slug(nome) {
  return (
    normalizarNome(nome)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "medicao"
  );
}

export function idDaMedicao(mes, nome) {
  return String(nome || "").trim() ? `${mes}--${slug(nome)}` : mes;
}

export function nomesDoContrato(contrato) {
  const vistos = new Set();
  return (contrato?.medicao?.nomes || [])
    .map((n) => String(n || "").trim())
    .filter((n) => n && !vistos.has(normalizarNome(n)) && vistos.add(normalizarNome(n)));
}

// Situação das medições de um mês: as previstas (pelo cadastro do contrato,
// ou uma só sem nome) com a medição salva de cada uma, e as extras.
// Uma medição antiga sem nome conta como a primeira prevista que faltar.
export function situacaoDoMes(nomes, medicoesDoMes) {
  const previstasNomes = nomes?.length ? nomes : [""];
  const restantes = [...(medicoesDoMes || [])];
  const tirar = (fn) => {
    const i = restantes.findIndex(fn);
    return i >= 0 ? restantes.splice(i, 1)[0] : null;
  };
  const previstas = previstasNomes.map((nome) => ({ nome, medicao: tirar((m) => !m.extra && normalizarNome(m.nome || "") === normalizarNome(nome)) }));
  for (const p of previstas) if (!p.medicao) p.medicao = tirar((m) => !m.extra && !String(m.nome || "").trim());
  const extras = restantes;
  const todas = [...previstas.map((p) => p.medicao).filter(Boolean), ...extras];
  const subidas = previstas.filter((p) => p.medicao).length;
  const lancadas = todas.filter((m) => m.status === "lancada").length;
  return {
    previstas,
    extras,
    total: previstas.length,
    subidas,
    lancadas,
    todasSubidas: subidas === previstas.length,
    todasLancadas: subidas === previstas.length && todas.every((m) => m.status === "lancada"),
  };
}

// Rótulo curto: "Outubro/2026 · Projetos" (sem nome na medição única).
export function nomeDaMedicaoSalva(m, rotuloMes) {
  return [rotuloMes(m.mes), String(m.nome || "").trim()].filter(Boolean).join(" · ");
}
