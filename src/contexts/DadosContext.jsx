import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { watchFrentes, watchItensAbertosDoUsuario } from "../lib/firestore";
import { buscarAditivosPendentesTI, watchContratos } from "../lib/contratos";
import { itemAtrasado } from "../lib/agenda";

// Dados que várias partes da tela usam ao mesmo tempo (painel, menu lateral,
// busca, barra do celular): carregados uma vez só e mantidos em tempo real.
const DadosContext = createContext(null);

export function DadosProvider({ children }) {
  const { user } = useAuth();
  const [frentes, setFrentes] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [itensAbertos, setItensAbertos] = useState([]);
  const [carregandoItens, setCarregandoItens] = useState(true);
  const [erroItens, setErroItens] = useState("");
  const [erroContratos, setErroContratos] = useState("");
  const [aditivosTI, setAditivosTI] = useState([]);

  useEffect(() => {
    if (!user) return;
    return watchFrentes(user.uid, setFrentes);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchContratos(user.uid, setContratos, (e) => setErroContratos(e.message || String(e)));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchItensAbertosDoUsuario(
      user.uid,
      (itens) => {
        setItensAbertos(itens);
        setErroItens("");
        setCarregandoItens(false);
      },
      (e) => {
        setErroItens(e.message || String(e));
        setCarregandoItens(false);
      }
    );
  }, [user]);

  // Aditivos pendentes em TI: uma consulta pontual, refeita quando a lista de
  // contratos muda (um aditivo criado ou finalizado altera o contrato).
  const chaveContratos = contratos.map((c) => `${c.id}:${c.status}:${c.aditivoAtivoPendenteEm || ""}`).join("|");
  useEffect(() => {
    if (!user) return;
    buscarAditivosPendentesTI(user.uid)
      .then(setAditivosTI)
      .catch((e) => console.error("Erro ao buscar aditivos pendentes em TI:", e));
  }, [user, chaveContratos]);

  const valor = useMemo(() => {
    const mapaFrentes = Object.fromEntries(frentes.map((f) => [f.id, f]));
    const mapaContratos = Object.fromEntries(contratos.map((c) => [c.id, c]));
    const contagemPorFrente = {};
    for (const item of itensAbertos) {
      const c = (contagemPorFrente[item.frenteId] ||= { abertos: 0, atrasados: 0 });
      c.abertos++;
      if (itemAtrasado(item)) c.atrasados++;
    }
    return {
      frentes,
      contratos,
      itensAbertos,
      carregandoItens,
      erroItens,
      erroContratos,
      aditivosTI,
      mapaFrentes,
      mapaContratos,
      contagemPorFrente,
      papelNaFrente: (frenteId) => mapaFrentes[frenteId]?.membros?.[user?.uid],
    };
  }, [frentes, contratos, itensAbertos, carregandoItens, erroItens, erroContratos, aditivosTI, user]);

  return <DadosContext.Provider value={valor}>{children}</DadosContext.Provider>;
}

export function useDados() {
  return useContext(DadosContext);
}
