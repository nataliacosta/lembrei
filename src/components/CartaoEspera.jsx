import { useState } from "react";
import { deInputDate, formatarData, paraInputDate } from "../lib/datas";
import { descreverPassoDaEspera, diasDesde, diasEsperando } from "../lib/passos";

// Demanda parada aguardando retorno: de quem, desde quando, previsão de
// retorno, lembrete de cobrar e o botão "Retorno chegou".
export function CartaoEspera({ demanda, podeEditar, onRetorno, onMudarEspera }) {
  const e = demanda.espera;
  const dias = diasDesde(e.desde);
  const passo = descreverPassoDaEspera(demanda);
  return (
    <div className="cartao-espera">
      <div className="cartao-espera-titulo">
        ⏸ Parada · aguardando {e.de} desde {formatarData(e.desde)} ({dias === 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`})
      </div>
      {passo && <div className="dica-form">{passo}</div>}
      <div className="cartao-espera-campos">
        <label>
          Retorno previsto
          <input
            type="date"
            value={paraInputDate(e.retornoPrevisto)}
            disabled={!podeEditar}
            onChange={(ev) => onMudarEspera({ retornoPrevisto: ev.target.value ? deInputDate(ev.target.value) : null })}
          />
        </label>
        <label>
          Me lembrar de cobrar em
          <input
            type="date"
            value={paraInputDate(e.cobrarEm)}
            disabled={!podeEditar}
            onChange={(ev) => onMudarEspera({ cobrarEm: ev.target.value ? deInputDate(ev.target.value) : null })}
          />
        </label>
        {podeEditar && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onRetorno}>
            Retorno chegou
          </button>
        )}
      </div>
      <div className="dica-form">
        Enquanto isso, a próxima da fila segue.{diasEsperando(demanda) > dias ? ` Já esperou ${diasEsperando(demanda)} dias no total.` : ""}
      </div>
    </div>
  );
}

// Parar manualmente (sem passo): de quem e retorno previsto.
export function PararDemanda({ onParar }) {
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState("");
  const [retorno, setRetorno] = useState("");
  if (!aberto) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAberto(true)}>
        ⏸ Parar: aguardando retorno
      </button>
    );
  }
  return (
    <div className="cartao-espera">
      <div className="cartao-espera-campos">
        <label style={{ flex: "1 1 180px" }}>
          Aguardando quem?
          <input value={de} onChange={(e) => setDe(e.target.value)} placeholder="Ex: Fornecedor" autoFocus />
        </label>
        <label>
          Retorno previsto (opcional)
          <input type="date" value={retorno} onChange={(e) => setRetorno(e.target.value)} />
        </label>
        <button type="button" className="btn btn-primary btn-sm" disabled={!de.trim()} onClick={() => onParar({ de: de.trim(), retornoPrevisto: retorno ? deInputDate(retorno) : null })}>
          Parar
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
