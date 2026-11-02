import { collection, collectionGroup, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase";

// Dados que a busca usa além do que já fica carregado na tela (itens
// concluídos, aditivos de todos os contratos e demandas das filas
// compartilhadas). Carrega quando a busca abre e guarda por um minuto.
const VALIDADE_MS = 60 * 1000;
let cache = null;

export async function carregarExtrasBusca(uid, contratos, filasCompartilhadas) {
  const chave = [uid, contratos.map((c) => c.id).join(","), filasCompartilhadas.map((f) => f.id).join(",")].join("|");
  if (cache && cache.chave === chave && Date.now() - cache.em < VALIDADE_MS) return cache.promessa;

  const promessa = (async () => {
    const lista = (snap, extra = {}) => snap.docs.map((d) => ({ id: d.id, ...d.data(), ...extra }));
    const [itensConcluidos, aditivos, demandas] = await Promise.all([
      getDocs(
        query(collectionGroup(db, "itens"), where("membrosUids", "array-contains", uid), where("concluido", "==", true), limit(500))
      )
        .then((s) => lista(s))
        .catch((e) => (console.error("Busca: itens concluídos", e), [])),
      Promise.all(
        contratos.map((c) =>
          getDocs(collection(db, "contratos", c.id, "aditivos"))
            .then((s) => lista(s, { contratoId: c.id }))
            .catch(() => [])
        )
      ).then((l) => l.flat()),
      Promise.all(
        filasCompartilhadas.map((f) =>
          getDocs(collection(db, "filas", f.id, "demandas"))
            .then((s) => lista(s, { donoId: f.id }))
            .catch(() => [])
        )
      ).then((l) => l.flat()),
    ]);
    return { itensConcluidos, aditivos, demandas };
  })();

  cache = { chave, em: Date.now(), promessa };
  return promessa;
}
