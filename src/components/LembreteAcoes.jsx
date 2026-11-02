import { useRef, useState } from "react";
import { adiarLembrete, encerrarLembrete } from "../lib/firestore";
import { deInputDate, inicioDoDia, somarDias } from "../lib/datas";

// Botões rápidos para um lembrete: "Já tive retorno", "Adiar 2 dias",
// "Adiar 1 semana" e (opcional) escolher outra data.
export default function LembreteAcoes({ item, comOutraData = false, compacto = false }) {
  const [salvando, setSalvando] = useState(false);
  const dataRef = useRef(null);
  const frenteId = item.frenteId;

  async function executar(acao) {
    setSalvando(true);
    try {
      await acao();
    } catch (e) {
      console.error("Erro ao atualizar lembrete:", e);
      window.alert("Não deu pra atualizar o lembrete. Tente de novo.");
    }
    setSalvando(false);
  }

  function adiar(dias) {
    return executar(() => adiarLembrete(frenteId, item.id, somarDias(inicioDoDia(), dias)));
  }

  function jaTiveRetorno() {
    // "Se houver retorno, perguntar se ainda preciso acompanhar antes de encerrar"
    if (item.lembrete?.recorrente) {
      const continuar = window.confirm(
        "Ainda precisa acompanhar este assunto?\n\nOK: lembrar de novo daqui a 1 semana.\nCancelar: encerrar o lembrete."
      );
      if (continuar) return adiar(7);
    }
    return executar(() => encerrarLembrete(frenteId, item.id));
  }

  function outraData(e) {
    const data = deInputDate(e.target.value);
    if (data) executar(() => adiarLembrete(frenteId, item.id, data));
  }

  const classe = "btn btn-ghost btn-sm";

  function abrirCalendario() {
    const input = dataRef.current;
    if (!input) return;
    if (input.showPicker) input.showPicker();
    else input.focus();
  }

  return (
    <div className="acoes-lembrete">
      <button type="button" className={classe} disabled={salvando} onClick={jaTiveRetorno}>
        Já tive retorno
      </button>
      <button type="button" className={classe} disabled={salvando} onClick={() => adiar(2)}>
        Adiar 2 dias
      </button>
      <button type="button" className={classe} disabled={salvando} onClick={() => adiar(7)}>
        {compacto ? "1 semana" : "Adiar 1 semana"}
      </button>
      {comOutraData && (
        <span style={{ position: "relative" }}>
          <button type="button" className={classe} disabled={salvando} onClick={abrirCalendario}>
            Outra data…
          </button>
          <input
            ref={dataRef}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            onChange={outraData}
            style={{ position: "absolute", left: 0, bottom: 0, width: 1, height: 1, opacity: 0, padding: 0, border: 0 }}
          />
        </span>
      )}
    </div>
  );
}
