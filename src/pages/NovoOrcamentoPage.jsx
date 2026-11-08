import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { chaveGrupo, linhasCondensadas, novoIdLinha, ordenarVersoes, proximaVersao, versaoVigente, CAMPOS_EXTRAS } from "../lib/orcamentos";
import { baixarModelos, lerArquivoOrcamento } from "../lib/orcamentosExcel";
import { criarPlanejamento, criarVersao, lerConteudo, lerVersoes } from "../lib/orcamentosDb";

const rotulo = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-gray)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" };

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Opcao({ nome, valor, atual, onEscolher, titulo, children }) {
  return (
    <label className={`opcao-card ${atual === valor ? "on" : ""}`}>
      <input type="radio" name={nome} checked={atual === valor} onChange={() => onEscolher(valor)} />
      <span>
        <b>{titulo}</b>
        <span className="texto-ajuda" style={{ display: "block", marginTop: 2 }}>
          {children}
        </span>
      </span>
    </label>
  );
}

// Extras (ODI, tipo, classificação...) de uma versão, pela chave do grupo.
function extrasDe(versao, conteudo) {
  const extras = {};
  for (const l of linhasCondensadas(versao, conteudo)) {
    const e = {};
    for (const k of CAMPOS_EXTRAS) if (l[k] !== undefined && l[k] !== "" && l[k] !== null) e[k] = l[k];
    if (Object.keys(e).length) extras[l.chave] = e;
  }
  return extras;
}

export default function NovoOrcamentoPage() {
  const { user } = useAuth();
  const { planejamentos } = useDados();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const de = params.get("de"); // "pid:vid"
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual + (new Date().getMonth() >= 6 ? 1 : 0));
  const [versao, setVersao] = useState("");
  const [versaoTocada, setVersaoTocada] = useState(false);
  const [dataCriacao, setDataCriacao] = useState(hojeIso());
  const [observacao, setObservacao] = useState("");
  const [situacao, setSituacao] = useState("planejamento");
  const [visao, setVisao] = useState("completa");
  const [comeco, setComeco] = useState(de ? "copiar" : "branco");
  const [origem, setOrigem] = useState(de || "");
  const [todas, setTodas] = useState([]); // [{ pid, ano, ...versao }]
  const [arquivo, setArquivo] = useState(null);
  const [lidas, setLidas] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef(null);

  // Todas as versões que eu vejo (para copiar e para sugerir o número da próxima).
  const chavePlan = planejamentos.map((p) => p.id).join(",");
  useEffect(() => {
    let vivo = true;
    Promise.all(planejamentos.map(async (p) => (await lerVersoes(p.id)).map((v) => ({ ...v, pid: p.id, ano: p.ano }))))
      .then((l) => vivo && setTodas(l.flat()))
      .catch((e) => console.error(e));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavePlan]);

  // Ao abrir com "?de=", começa no mesmo ano e na mesma visão da versão de origem.
  useEffect(() => {
    if (!de) return;
    const v = todas.find((x) => `${x.pid}:${x.id}` === de);
    if (v) {
      setAno(v.ano);
      setVisao(v.visao);
    }
  }, [de, todas]);

  const planDoAno = planejamentos.find((p) => p.ano === Number(ano) && ["proprietario", "editor"].includes(p.membros?.[user.uid]));
  const versoesDoAno = useMemo(() => todas.filter((v) => planDoAno && v.pid === planDoAno.id), [todas, planDoAno]);
  useEffect(() => {
    if (!versaoTocada) setVersao(proximaVersao(versoesDoAno));
  }, [versoesDoAno, versaoTocada]);

  const origens = ordenarVersoes(todas).sort((a, b) => b.ano - a.ano);
  const origemEscolhida = todas.find((v) => `${v.pid}:${v.id}` === origem);
  const incompativel = comeco === "copiar" && origemEscolhida && origemEscolhida.visao === "condensada" && visao === "completa";

  async function escolherArquivo(f) {
    if (!f) return;
    setErro("");
    setArquivo(f);
    setLidas(null);
    try {
      const r = await lerArquivoOrcamento(f, visao);
      if (r.faltando.length) setErro(`Não encontrei a(s) coluna(s): ${r.faltando.join(", ")}. Use o modelo (aba “${visao === "condensada" ? "Condensada" : "Completa"}”).`);
      else setLidas(r.linhas);
    } catch (e) {
      console.error(e);
      setErro("Não deu pra ler o arquivo. Ele precisa ser um Excel (.xlsx).");
    }
  }

  // Ao trocar de visão com um arquivo escolhido, lê de novo na aba certa.
  useEffect(() => {
    if (arquivo && comeco === "planilha") escolherArquivo(arquivo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao]);

  async function criar(e) {
    e.preventDefault();
    setErro("");
    if (!versao.trim()) return setErro("Dê um nome para a versão (ex.: v1).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataCriacao)) return setErro("Escolha a data de criação.");
    if (comeco === "copiar" && !origemEscolhida) return setErro("Escolha a versão de onde copiar.");
    if (incompativel) return setErro("Uma versão condensada não tem os recursos para virar completa. Escolha a visão condensada ou outra versão.");
    if (comeco === "planilha" && !lidas) return setErro("Escolha a planilha preenchida.");
    setSalvando(true);
    try {
      let conteudo = { completa: [], condensada: [], extras: {} };
      if (comeco === "copiar") {
        const c = await lerConteudo(origemEscolhida.pid, origemEscolhida.id);
        if (origemEscolhida.visao === visao) conteudo = { completa: c.completa || [], condensada: c.condensada || [], extras: c.extras || {} };
        else
          conteudo.condensada = linhasCondensadas(origemEscolhida, c).map((l) => {
            const { chave, qtdRecursos, anual, ...resto } = l;
            void chave;
            void qtdRecursos;
            void anual;
            return { ...resto, id: novoIdLinha() };
          });
      } else if (comeco === "planilha") {
        // Aproveita os campos da condensada da última versão do mesmo ano.
        let extrasAnteriores = {};
        const base = versaoVigente(versoesDoAno) || ordenarVersoes(versoesDoAno)[0];
        if (base) extrasAnteriores = extrasDe(base, await lerConteudo(base.pid, base.id));
        if (visao === "completa") conteudo = { completa: lidas, condensada: [], extras: extrasAnteriores };
        else
          conteudo.condensada = lidas.map((l) => {
            const ant = extrasAnteriores[chaveGrupo(l)] || {};
            const vazios = Object.fromEntries(Object.entries(ant).filter(([k]) => l[k] === "" || l[k] == null));
            return { ...l, ...vazios };
          });
      }
      const pid = planDoAno?.id || (await criarPlanejamento(ano, user));
      const vid = await criarVersao(pid, { ano: Number(ano), versao: versao.trim(), dataCriacao, observacao: observacao.trim(), situacao, visao }, conteudo, user);
      navigate(`/orcamentos/${pid}/${vid}`, { replace: true });
    } catch (err) {
      console.error(err);
      setErro("Não deu pra criar o orçamento. Tente de novo.");
      setSalvando(false);
    }
  }

  const anos = [];
  for (let a = anoAtual - 2; a <= anoAtual + 2; a++) anos.push(a);

  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 80, maxWidth: 1180 }}>
      <Link to="/orcamentos" style={{ fontSize: 13, fontWeight: 600 }}>
        ← Orçamentos
      </Link>
      <h1 style={{ margin: "14px 0 0", fontSize: 26, fontWeight: 700 }}>Novo orçamento</h1>
      <form className="lista-card" style={{ marginTop: 18, padding: "22px 24px", maxWidth: 880 }} onSubmit={criar}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <label style={{ flex: "0 1 140px", margin: 0 }}>
            <span style={rotulo}>Ano</span>
            <select value={ano} onChange={(e) => (setAno(Number(e.target.value)), setVersaoTocada(false))}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: "0 1 160px", margin: 0 }}>
            <span style={rotulo}>Versão</span>
            <input value={versao} onChange={(e) => (setVersao(e.target.value), setVersaoTocada(true))} maxLength={40} />
          </label>
          <label style={{ flex: "0 1 190px", margin: 0 }}>
            <span style={rotulo}>Data de criação</span>
            <input type="date" value={dataCriacao} onChange={(e) => setDataCriacao(e.target.value)} />
          </label>
          <label style={{ flex: "1 1 220px", margin: 0 }}>
            <span style={rotulo}>Observação (opcional)</span>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: revisão após corte de 10%" maxLength={200} />
          </label>
        </div>
        <div className="texto-ajuda">A data vem com hoje, mas dá para mudar.</div>

        <span style={{ ...rotulo, marginTop: 20 }}>Situação</span>
        <div className="opcoes-linha">
          <Opcao nome="situacao" valor="planejamento" atual={situacao} onEscolher={setSituacao} titulo="Planejamento">
            Uma versão de trabalho; não conta no painel.
          </Opcao>
          <Opcao nome="situacao" valor="efetivada" atual={situacao} onEscolher={setSituacao} titulo="Efetivada">
            Orçamento aprovado. A última efetivada do ano é a que conta no painel.
          </Opcao>
        </div>

        <span style={{ ...rotulo, marginTop: 20 }}>Visão em que você vai cadastrar</span>
        <div className="opcoes-linha">
          <Opcao nome="visao" valor="completa" atual={visao} onEscolher={setVisao} titulo="Completa">
            Um recurso por linha. A condensada é montada sozinha (agrupando por Projeto + Fornecedor + Linha).
          </Opcao>
          <Opcao nome="visao" valor="condensada" atual={visao} onEscolher={setVisao} titulo="Condensada">
            Já direto por Projeto + Fornecedor + Linha.
          </Opcao>
        </div>

        <span style={{ ...rotulo, marginTop: 20 }}>Como começar</span>
        <div className="opcoes-linha">
          <Opcao nome="comeco" valor="branco" atual={comeco} onEscolher={setComeco} titulo="Em branco">
            Você adiciona as linhas no app.
          </Opcao>
          <Opcao nome="comeco" valor="copiar" atual={comeco} onEscolher={setComeco} titulo="Copiar de outra versão">
            Começa igual a uma versão anterior.
          </Opcao>
          <Opcao nome="comeco" valor="planilha" atual={comeco} onEscolher={setComeco} titulo="Subir planilha">
            Preencha o modelo e suba aqui.
          </Opcao>
        </div>

        {comeco === "copiar" && (
          <label style={{ display: "block", marginTop: 12, maxWidth: 420 }}>
            <span style={rotulo}>Copiar de</span>
            <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
              <option value="">Escolher versão…</option>
              {origens.map((v) => (
                <option key={`${v.pid}:${v.id}`} value={`${v.pid}:${v.id}`}>
                  {v.ano} · {v.versao} ({v.situacao === "efetivada" ? "efetivada" : "planejamento"}, {v.visao})
                </option>
              ))}
            </select>
            {incompativel && <div className="texto-ajuda texto-alerta">Uma versão condensada não tem os recursos; para copiar dela, escolha a visão condensada.</div>}
            {origemEscolhida?.visao === "completa" && visao === "condensada" && <div className="texto-ajuda">A cópia leva a condensada dessa versão (já agrupada).</div>}
          </label>
        )}
        {comeco === "planilha" && (
          <div className="area-arquivo" style={{ marginTop: 12 }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{arquivo ? arquivo.name : `Planilha preenchida (aba “${visao === "condensada" ? "Condensada" : "Completa"}” do modelo)`}</div>
              <div style={{ fontSize: 13, color: "var(--color-gray)" }}>
                {lidas ? `${lidas.length} ${lidas.length === 1 ? "linha lida" : "linhas lidas"}` : "Apague a linha de exemplo do modelo antes de subir."}{" "}
                <button type="button" className="link-botao" onClick={() => baixarModelos().catch((e) => console.error(e))}>
                  Baixar modelo
                </button>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: "none" }}
              onChange={(e) => {
                escolherArquivo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button type="button" className={arquivo ? "btn btn-ghost btn-sm" : "btn btn-primary"} onClick={() => inputRef.current?.click()}>
              {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
            </button>
          </div>
        )}
        <div className="texto-ajuda">
          Ao copiar ou subir uma completa, os campos que você já preencheu na condensada (ODI, tipo, classificação, diretoria…) são aproveitados quando o Projeto + Fornecedor + Linha for o mesmo.
        </div>

        {erro && (
          <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 12 }}>
            {erro}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 22, borderTop: "1px solid var(--color-border)", paddingTop: 16 }}>
          <Link to="/orcamentos" className="btn btn-ghost">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Criando..." : "Criar orçamento"}
          </button>
        </div>
      </form>
    </div>
  );
}
