import { useState } from "react";
import { alocacaoNoMes, chaveCentro, definirAlocacao, dividir, dividirPorHoras, formatarNumero, formatarReais, lerNumero, partesParaAlocacao, resolverCentro, rotuloMes, somarMeses } from "../lib/alocacoes";
import SeletorCentro from "./SeletorCentro";
import { salvarRecurso } from "../lib/medicoesContrato";

// Mapa por id (a chave "ODI:123" da lista única e o id antigo dos CCs/ODIs do contrato).
export function porIdDe(centros) {
  return Object.fromEntries((centros || []).map((c) => [c.id, c]));
}

// Parte pronta para gravar na alocação: com tipo e código.
export function parteComCodigo(p, centros, extra = {}) {
  const c = resolverCentro(p, porIdDe(centros));
  if (!c) return null;
  const v = { centroId: chaveCentro(c.tipo, c.codigo), tipo: c.tipo, codigo: c.codigo, ...extra };
  if (p.equipeId) v.equipeId = p.equipeId;
  if (p.equipeId && p.frenteId) v.frenteId = p.frenteId;
  return v;
}

// CC/ODI, equipe e frente de uma parte. A frente só aparece depois da equipe,
// e a lista de frentes é a da equipe escolhida. Equipe e frente são opcionais.
export function SeletoresParte({ parte, centros, equipes, onMudar, indice }) {
  const equipe = equipes.find((e) => e.id === parte.equipeId);
  return (
    <>
      <SeletorCentro
        valor={parte.centroId || (parte.codigo ? chaveCentro(parte.tipo, parte.codigo) : "")}
        opcoes={centros.filter((c) => c.origem !== "contrato")}
        porId={porIdDe(centros)}
        rotulo={`CC ou ODI ${indice + 1}`}
        onEscolher={(c) => onMudar(c)}
      />
      <select value={parte.equipeId || ""} onChange={(e) => onMudar({ equipeId: e.target.value, frenteId: "" })} aria-label={`Equipe ${indice + 1}`}>
        <option value="">Sem equipe</option>
        {equipes.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
      <select value={parte.frenteId || ""} onChange={(e) => onMudar({ frenteId: e.target.value })} aria-label={`Frente ${indice + 1}`} disabled={!equipe}>
        <option value="">{equipe ? "Sem frente" : "—"}</option>
        {(equipe?.frentes || []).map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </select>
    </>
  );
}

export function CabecalhoPartes({ classe, ultima = "%", extra = null }) {
  return (
    <div className={`linha-partes ${classe} cabecalho-partes`} aria-hidden="true">
      <span>CC / ODI</span>
      <span>Equipe</span>
      <span>Frente</span>
      <span>{ultima}</span>
      {extra}
      <span />
    </div>
  );
}

const quase = (a, b) => Math.abs(a - b) < 0.005;

// Divide uma linha da medição em partes, por % ou por horas.
export default function EditorDivisao({ linha, centros, equipes, partesIniciais, mes, permitirSalvarAlocacao, onAplicar, onCancelar }) {
  const [modo, setModo] = useState("pct");
  const [partes, setPartes] = useState(() =>
    partesIniciais?.length
      ? partesIniciais.map((p) => ({ centroId: p.centroId || "", tipo: p.tipo, codigo: p.codigo, equipeId: p.equipeId || "", frenteId: p.frenteId || "", valor: formatarNumero(p.pct, p.pct % 1 ? 2 : 0) }))
      : [{ centroId: "", equipeId: "", frenteId: "", valor: "100" }]
  );
  const [salvarAlocacao, setSalvarAlocacao] = useState(false);
  const [erro, setErro] = useState("");
  const primeiro = (linha.recurso || "").split(" ")[0];
  const num = (v) => lerNumero(v) || 0;
  const soma = Math.round(partes.reduce((s, p) => s + num(p.valor), 0) * 100) / 100;
  const alvo = modo === "pct" ? 100 : Number(linha.horas) || 0;
  const somaOk = quase(soma, alvo);

  function trocarModo(novo) {
    if (novo === modo) return;
    const h = Number(linha.horas) || 0;
    setPartes(
      partes.map((p) => {
        const v = num(p.valor);
        const convertido = novo === "horas" ? (h * v) / 100 : h ? (v / h) * 100 : 0;
        const arred = Math.round(convertido * 100) / 100;
        return { ...p, valor: formatarNumero(arred, arred % 1 ? 2 : 0) };
      })
    );
    setModo(novo);
  }

  function mudar(i, mudanca) {
    setPartes(partes.map((p, j) => (j === i ? { ...p, ...mudanca } : p)));
  }

  function valorDaParte(p) {
    const v = num(p.valor);
    if (modo === "pct") return (Number(linha.valorTotal) * v) / 100;
    return linha.horas ? (Number(linha.valorTotal) * v) / Number(linha.horas) : 0;
  }

  function calcular() {
    const centrosPorId = Object.fromEntries(centros.map((c) => [c.id, c]));
    const equipesPorId = Object.fromEntries(equipes.map((e) => [e.id, e]));
    const base = partes.map((p) => ({ centroId: p.centroId, tipo: p.tipo, codigo: p.codigo, equipeId: p.equipeId || null, frenteId: p.frenteId || null }));
    return modo === "pct"
      ? dividir(linha, base.map((b, i) => ({ ...b, pct: num(partes[i].valor) })), centrosPorId, equipesPorId)
      : dividirPorHoras(linha, base.map((b, i) => ({ ...b, horas: num(partes[i].valor) })), centrosPorId, equipesPorId);
  }

  function aplicar() {
    setErro("");
    if (partes.some((p) => !p.centroId)) return setErro("Escolha o CC/ODI de cada parte.");
    if (partes.some((p) => num(p.valor) <= 0)) return setErro(modo === "pct" ? "Cada parte precisa de um percentual maior que zero." : "Cada parte precisa de horas maiores que zero.");
    if (!somaOk) return setErro(modo === "pct" ? "A soma dos percentuais precisa dar 100%." : `A soma das horas precisa dar ${formatarNumero(alvo, alvo % 1 ? 2 : 0)} h.`);
    onAplicar({ partes: calcular(), salvarAlocacao });
  }

  const previaPct = modo === "horas" && somaOk && partes.length > 1 ? calcular().map((p) => `${formatarNumero(p.pct, p.pct % 1 ? 2 : 0)}%`).join(" / ") : "";

  return (
    <div role="group" aria-label={`Dividir a linha de ${linha.recurso}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>
          Dividir a linha de {linha.recurso}{" "}
          <span style={{ fontWeight: 400, color: "var(--color-gray)", fontSize: 13 }}>
            · {formatarNumero(linha.horas, linha.horas % 1 ? 2 : 0)} h · {formatarReais(linha.valorTotal)}
          </span>
        </div>
        <div className="chips-row" role="group" aria-label="Dividir por" style={{ alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--color-gray)" }}>Dividir por</span>
          <button type="button" className="chip" aria-pressed={modo === "pct"} onClick={() => trocarModo("pct")}>
            %
          </button>
          <button type="button" className="chip" aria-pressed={modo === "horas"} onClick={() => trocarModo("horas")}>
            Horas
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        <CabecalhoPartes classe="com-valor" ultima={modo === "pct" ? "%" : "Horas"} extra={<span style={{ textAlign: "right" }}>Valor</span>} />
        {partes.map((p, i) => (
          <div key={i} className="linha-partes com-valor">
            <SeletoresParte parte={p} centros={centros} equipes={equipes} indice={i} onMudar={(m) => mudar(i, m)} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
              <input value={p.valor} onChange={(e) => mudar(i, { valor: e.target.value })} inputMode="decimal" aria-label={`${modo === "pct" ? "Percentual" : "Horas"} ${i + 1}`} style={{ width: 72 }} />
              {modo === "pct" ? "%" : "h"}
            </label>
            <span style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{formatarReais(valorDaParte(p))}</span>
            <button type="button" className="btn btn-ghost" style={{ padding: 0, width: 40 }} aria-label={`Remover parte ${i + 1}`} onClick={() => setPartes(partes.filter((_, j) => j !== i))} disabled={partes.length === 1}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          onClick={() => setPartes([...partes, { centroId: "", equipeId: "", frenteId: "", valor: formatarNumero(Math.max(0, Math.round((alvo - soma) * 100) / 100), (alvo - soma) % 1 ? 2 : 0) }])}
          style={{ background: "none", border: "1px dashed var(--color-gray-light)", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "var(--color-primary)", minHeight: 36 }}
        >
          + Mais uma parte
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: somaOk ? "var(--color-primary-dark)" : "var(--color-orange)" }}>
          {modo === "pct" ? `Soma: ${formatarNumero(soma, soma % 1 ? 2 : 0)}%` : `${formatarNumero(soma, soma % 1 ? 2 : 0)} h de ${formatarNumero(alvo, alvo % 1 ? 2 : 0)} h`}
          {somaOk ? " ✓" : ""}
        </span>
      </div>
      {permitirSalvarAlocacao && (
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--color-gray)", marginTop: 10, fontWeight: 400 }}>
          <input type="checkbox" checked={salvarAlocacao} onChange={(e) => setSalvarAlocacao(e.target.checked)} style={{ width: "auto" }} />
          Salvar também como alocação de {primeiro} a partir de {rotuloMes(mes).toLowerCase()}
          {previaPct ? ` (fica ${previaPct})` : ""}
        </label>
      )}
      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 8 }}>
          {erro}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={aplicar}>
          Aplicar divisão
        </button>
      </div>
    </div>
  );
}

// Edita a alocação de um recurso direto na medição (o mesmo cadastro da aba
// Medições), valendo a partir do mês escolhido. Se o recurso ainda não existe,
// cria com os dados da linha.
export function EditorAlocacao({ contratoId, recurso, linha, centros, equipes, mes, onSalvo, onCancelar }) {
  const [desde, setDesde] = useState(mes);
  const [partes, setPartes] = useState(() => {
    const a = recurso ? alocacaoNoMes(recurso, mes) : null;
    const base = a?.partes?.length ? a.partes : partesParaAlocacao(linha.partes);
    return base.length ? base.map((p) => ({ centroId: p.centroId || "", tipo: p.tipo, codigo: p.codigo, equipeId: p.equipeId || "", frenteId: p.frenteId || "", pct: formatarNumero(p.pct, p.pct % 1 ? 2 : 0) })) : [{ centroId: "", equipeId: "", frenteId: "", pct: "100" }];
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const num = (v) => lerNumero(v) || 0;
  const soma = Math.round(partes.reduce((s, p) => s + num(p.pct), 0) * 100) / 100;
  const somaOk = Math.abs(soma - 100) < 0.005;
  const nome = recurso?.nome || linha.recurso;
  const primeiro = nome.split(" ")[0];
  const meses = [];
  for (let i = -6; i <= 3; i++) meses.push(somarMeses(mes, i));
  meses.reverse();

  function mudar(i, m) {
    setPartes(partes.map((p, j) => (j === i ? { ...p, ...m } : p)));
  }

  async function salvar() {
    setErro("");
    if (partes.some((p) => !p.centroId)) return setErro("Escolha o CC/ODI de cada parte.");
    if (!somaOk) return setErro("A soma dos percentuais precisa dar 100%.");
    const validas = partes.map((p) => parteComCodigo(p, centros, { pct: num(p.pct) }));
    if (validas.some((v) => !v)) return setErro("Escolha o CC/ODI de cada parte.");
    const chaves = validas.map((p) => `${p.centroId}|${p.equipeId || ""}|${p.frenteId || ""}`);
    if (new Set(chaves).size !== chaves.length) return setErro("A mesma combinação de CC/ODI, equipe e frente aparece duas vezes.");
    setSalvando(true);
    try {
      if (recurso) {
        await salvarRecurso(contratoId, recurso.id, { ...recurso, alocacoes: definirAlocacao(recurso, desde, validas) });
      } else {
        await salvarRecurso(contratoId, null, { nome: linha.recurso, perfil: linha.perfil, valorHH: linha.valorHH, alocacoes: [{ desde, partes: validas }] });
      }
      onSalvo({ partes: validas, desde });
    } catch (e) {
      console.error(e);
      setErro("Não deu pra salvar a alocação. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div role="group" aria-label={`Alocação de ${nome}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>
          Alocação de {nome}
          {!recurso && <span style={{ fontWeight: 400, color: "var(--color-gray)", fontSize: 13 }}> · recurso novo neste contrato</span>}
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: 0 }}>
          <span style={{ color: "var(--color-gray)" }}>Vale a partir de</span>
          <select value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 180, padding: "6px 8px" }}>
            {meses.map((m) => (
              <option key={m} value={m}>
                {rotuloMes(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        <CabecalhoPartes classe="com-equipe" />
        {partes.map((p, i) => (
          <div key={i} className="linha-partes com-equipe">
            <SeletoresParte parte={p} centros={centros} equipes={equipes} indice={i} onMudar={(m) => mudar(i, m)} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
              <input value={p.pct} onChange={(e) => mudar(i, { pct: e.target.value })} inputMode="decimal" aria-label={`Percentual ${i + 1}`} style={{ width: 64 }} />%
            </label>
            <button type="button" className="btn btn-ghost" style={{ padding: 0, width: 40 }} aria-label={`Remover parte ${i + 1}`} onClick={() => setPartes(partes.filter((_, j) => j !== i))} disabled={partes.length === 1}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          onClick={() => setPartes([...partes, { centroId: "", equipeId: "", frenteId: "", pct: formatarNumero(Math.max(0, Math.round((100 - soma) * 100) / 100), (100 - soma) % 1 ? 2 : 0) }])}
          style={{ background: "none", border: "1px dashed var(--color-gray-light)", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "var(--color-primary)", minHeight: 36 }}
        >
          + Dividir com outro CC/ODI
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: somaOk ? "var(--color-primary-dark)" : "var(--color-orange)" }}>
          Soma: {formatarNumero(soma, soma % 1 ? 2 : 0)}%{somaOk ? " ✓" : ""}
        </span>
      </div>
      <div className="texto-ajuda">
        Muda o cadastro de {primeiro} a partir do mês escolhido (os meses anteriores continuam como estavam). Ao salvar, esta linha da medição é preenchida de novo com a alocação nova.
      </div>
      {erro && (
        <div className="texto-alerta" role="alert" style={{ fontSize: 13, marginTop: 8 }}>
          {erro}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar alocação"}
        </button>
      </div>
    </div>
  );
}
