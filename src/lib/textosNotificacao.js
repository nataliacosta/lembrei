// Textos das notificações (sem Firebase: usados no app e nas Cloud Functions).

// Texto principal de cada aviso: [antes, destaque, depois...] para a tela
// poder pôr em negrito o que importa.
export function partesDoTexto(n) {
  const a = n.autorNome;
  switch (n.tipo) {
    case "comentario":
      return [[a, true], [" comentou em ", false], [n.alvo, true]];
    case "mencao":
      return [[a, true], [" mencionou você em ", false], [n.alvo, true]];
    case "atribuido":
      return [[a, true], [" atribuiu a você ", false], [n.alvo, true]];
    case "aditivo":
      return [[a, true], [" criou um aditivo de ", false], [n.alvo, true], [" no contrato ", false], [n.contexto, true]];
    case "demanda_criada":
      return [[a, true], [" criou a demanda ", false], [n.alvo, true], [` na ${n.contexto}`, false]];
    case "demanda_priorizada":
      return [[a, true], [" priorizou ", false], [n.alvo, true], [` na ${n.contexto}`, false]];
    case "demanda_parada":
      return [[a, true], [" marcou ", false], [n.alvo, true], [` como parada na ${n.contexto}`, false]];
    case "demanda_retomada":
      return [[a, true], [" retomou ", false], [n.alvo, true], [` na ${n.contexto}`, false]];
    case "fila_repriorizada":
      return [[a, true], [" repriorizou sua fila", false]];
    case "convite_recebido":
      return [[a, true], [` compartilhou ${n.contexto} `, false], [n.alvo, true], [" com você", false]];
    case "convite_aceito":
      return [[a, true], [" aceitou seu convite para ", false], [n.alvo === "fila de demandas" ? "sua fila de demandas" : n.alvo, true]];
    default:
      return [[a, true], [" fez uma atualização", false]];
  }
}

// Linha de apoio: onde aconteceu (quando o texto principal ainda não diz).
export function localDe(n) {
  if (["comentario", "mencao", "atribuido"].includes(n.tipo)) return n.contexto || "";
  if (n.tipo.startsWith("demanda") || n.tipo === "fila_repriorizada") return "Demandas";
  if (n.tipo === "aditivo") return "Contratos";
  return "Compartilhamento";
}

// Versão em texto corrido (título do push).
export function textoDaNotificacao(n) {
  return partesDoTexto(n).map(([t]) => t).join("");
}
