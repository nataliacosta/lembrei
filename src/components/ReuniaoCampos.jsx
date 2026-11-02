import { FREQUENCIAS, descreverRecorrencia, ocorrencias, rotuloMensalPorSemana } from "../lib/reunioes";
import { deInputDate, formatarData, paraDate, paraInputDate } from "../lib/datas";

// Estado do formulário (strings, como nos inputs) <-> campo `reuniao` gravado.
export function reuniaoParaFormulario(reuniao) {
  if (!reuniao) {
    return { frequencia: "semanal", mensalModo: "dia", inicio: "", hora: "", ate: "", link: "", preparos: [] };
  }
  const mensal = reuniao.frequencia?.startsWith("mensal");
  return {
    frequencia: mensal ? "mensal" : reuniao.frequencia || "unica",
    mensalModo: reuniao.frequencia === "mensal-semana" ? "semana" : "dia",
    inicio: paraInputDate(reuniao.inicio),
    hora: reuniao.hora || "",
    ate: reuniao.ate ? paraInputDate(reuniao.ate) : "",
    link: reuniao.link || "",
    preparos: (reuniao.preparos || []).map((p) => ({ ...p, diasAntes: String(p.diasAntes ?? 1) })),
  };
}

export function formularioParaReuniao(form, { original, nomeDe }) {
  const frequencia = form.frequencia === "mensal" ? `mensal-${form.mensalModo}` : form.frequencia;
  const inicio = deInputDate(form.inicio);
  return {
    frequencia,
    inicio,
    ordinal: frequencia === "mensal-semana" && inicio ? Math.min(Math.ceil(inicio.getDate() / 7), 5) : null,
    hora: form.hora || "",
    ate: form.frequencia === "unica" ? null : deInputDate(form.ate),
    link: form.link.trim(),
    preparos: form.preparos
      .filter((p) => p.titulo.trim())
      .map((p) => ({
        id: p.id,
        titulo: p.titulo.trim(),
        diasAntes: Math.max(0, parseInt(p.diasAntes, 10) || 0),
        responsavelId: p.responsavelId || null,
        responsavelNome: p.responsavelId ? nomeDe(p.responsavelId) : null,
      })),
    // Mantém o histórico de preparos feitos e de datas puladas ao editar.
    feitos: original?.feitos || {},
    puladas: original?.puladas || [],
  };
}

function novoId() {
  return Math.random().toString(36).slice(2, 10);
}

function Rotulo({ children, cor }) {
  return (
    <span
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 700,
        color: cor || "var(--color-gray)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 8,
      }}
    >
      {children}
    </span>
  );
}

export default function ReuniaoCampos({ valor, onChange, membrosUids, nomeDe, uidAtual }) {
  const mudar = (campos) => onChange({ ...valor, ...campos });
  const previa = valor.inicio ? formularioParaReuniao(valor, { nomeDe }) : null;
  const proximas = previa ? ocorrencias(previa, { quantas: 3 }) : [];

  function mudarPreparo(i, campos) {
    mudar({ preparos: valor.preparos.map((p, j) => (j === i ? { ...p, ...campos } : p)) });
  }

  return (
    <>
      <div className="caixa-reuniao" style={{ marginTop: 20, padding: "16px 18px" }}>
        <Rotulo cor="#1f4f8f">Quando</Rotulo>
        <div className="chips-row" role="group" aria-label="Frequência">
          {FREQUENCIAS.map((f) => (
            <button key={f.key} type="button" className="chip" aria-pressed={valor.frequencia === f.key} onClick={() => mudar({ frequencia: f.key })}>
              {f.label}
            </button>
          ))}
        </div>

        {valor.frequencia === "mensal" && (
          <div className="chips-row" role="group" aria-label="Repetir todo mês por" style={{ marginTop: 10 }}>
            <button type="button" className="chip" aria-pressed={valor.mensalModo === "dia"} onClick={() => mudar({ mensalModo: "dia" })}>
              {valor.inicio ? `Todo dia ${paraDate(deInputDate(valor.inicio)).getDate()}` : "Pelo dia do mês"}
            </button>
            <button type="button" className="chip" aria-pressed={valor.mensalModo === "semana"} onClick={() => mudar({ mensalModo: "semana" })}>
              {valor.inicio ? rotuloMensalPorSemana(deInputDate(valor.inicio)) : "Pelo dia da semana"}
            </button>
          </div>
        )}

        <div className="field-row" style={{ marginTop: 14, alignItems: "flex-end" }}>
          <label style={{ margin: 0 }}>
            <Rotulo>{valor.frequencia === "unica" ? "Data" : "Primeira reunião"}</Rotulo>
            <input type="date" value={valor.inicio} onChange={(e) => mudar({ inicio: e.target.value })} required />
          </label>
          <label style={{ margin: 0, flex: "0 1 130px" }}>
            <Rotulo>Horário</Rotulo>
            <input type="time" value={valor.hora} onChange={(e) => mudar({ hora: e.target.value })} />
          </label>
          {valor.frequencia !== "unica" && (
            <label style={{ margin: 0 }}>
              <Rotulo>Repete até (opcional)</Rotulo>
              <input type="date" value={valor.ate} onChange={(e) => mudar({ ate: e.target.value })} />
            </label>
          )}
        </div>
        {previa && (
          <div style={{ fontSize: 13, color: "#1f4f8f", fontWeight: 600, marginTop: 12 }}>
            {descreverRecorrencia(previa)}
            {proximas.length > 0 ? ` · próximas: ${proximas.map((d) => formatarData(d)).join(", ")}` : " · nenhuma data futura"}
          </div>
        )}
        <label style={{ margin: "14px 0 0" }}>
          <Rotulo>Link da reunião (opcional)</Rotulo>
          <input type="url" value={valor.link} onChange={(e) => mudar({ link: e.target.value })} placeholder="https://…" />
        </label>
      </div>

      <div style={{ marginTop: 20 }}>
        <Rotulo>Preparos antes da reunião</Rotulo>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {valor.preparos.map((p, i) => (
            <div key={p.id} className="chips-row" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={p.titulo}
                onChange={(e) => mudarPreparo(i, { titulo: e.target.value })}
                placeholder="O que preparar"
                aria-label="O que preparar"
                style={{ flex: "3 1 220px" }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, fontSize: 13, fontWeight: 500, color: "var(--color-gray)" }}>
                <input
                  type="number"
                  min="0"
                  value={p.diasAntes}
                  onChange={(e) => mudarPreparo(i, { diasAntes: e.target.value })}
                  aria-label="Quantos dias antes começa"
                  style={{ width: 64 }}
                />
                {p.diasAntes === "1" ? "dia antes" : "dias antes"}
              </label>
              <select
                value={p.responsavelId || ""}
                onChange={(e) => mudarPreparo(i, { responsavelId: e.target.value })}
                aria-label="Responsável pelo preparo"
                style={{ flex: "1 1 160px" }}
              >
                <option value="">— responsável da reunião —</option>
                {membrosUids.map((uid) => (
                  <option key={uid} value={uid}>
                    {uid === uidAtual ? `Eu (${nomeDe(uid) || "você"})` : nomeDe(uid) || "..."}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "6px 12px" }}
                onClick={() => mudar({ preparos: valor.preparos.filter((_, j) => j !== i) })}
                aria-label={`Remover preparo ${p.titulo}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => mudar({ preparos: [...valor.preparos, { id: novoId(), titulo: "", diasAntes: "2", responsavelId: uidAtual }] })}
          style={{
            marginTop: 10,
            background: "none",
            border: "1px dashed var(--color-gray-light)",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-primary)",
            minHeight: 36,
          }}
        >
          + Adicionar preparo
        </button>
        <div style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 8 }}>
          Cada preparo aparece no “O que fazer” a partir dos dias de antecedência, com prazo no dia da reunião.
        </div>
      </div>
    </>
  );
}
