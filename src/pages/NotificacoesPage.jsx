import { useState } from "react";
import NotificacaoLinha from "../components/NotificacaoLinha";
import { useDados } from "../contexts/DadosContext";
import { DIAS_GUARDADAS, ehDeHoje, marcarLidas } from "../lib/notificacoes";

export default function NotificacoesPage() {
  const { notificacoes, naoLidas } = useDados();
  const [soNaoLidas, setSoNaoLidas] = useState(false);

  const lista = soNaoLidas ? notificacoes.filter((n) => !n.lida) : notificacoes;
  const hoje = lista.filter((n) => ehDeHoje(n.criadoEm));
  const anteriores = lista.filter((n) => !ehDeHoje(n.criadoEm));

  return (
    <div className="page-shell" style={{ maxWidth: 780, margin: "0 auto", paddingTop: 28, paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Notificações</h1>
        {naoLidas > 0 && (
          <button type="button" className="btn btn-outline" onClick={() => marcarLidas(notificacoes.filter((n) => !n.lida).map((n) => n.id))}>
            Marcar todas como lidas
          </button>
        )}
      </div>
      <div className="sino-abas" style={{ padding: "16px 0 4px" }}>
        <button type="button" className={`pill-botao${!soNaoLidas ? " ativo" : ""}`} aria-pressed={!soNaoLidas} onClick={() => setSoNaoLidas(false)}>
          Todas
        </button>
        <button type="button" className={`pill-botao${soNaoLidas ? " ativo" : ""}`} aria-pressed={soNaoLidas} onClick={() => setSoNaoLidas(true)}>
          Não lidas · {naoLidas}
        </button>
      </div>

      {lista.length === 0 && (
        <div className="lista-card notif-vazio" style={{ marginTop: 16 }}>
          {soNaoLidas ? "Nada novo por aqui. 🎉" : "Quando alguém comentar, mencionar você ou mexer nas suas coisas, aparece aqui."}
        </div>
      )}
      <Grupo titulo="Hoje" itens={hoje} />
      <Grupo titulo="Anteriores" itens={anteriores} />

      <p style={{ fontSize: 12, color: "var(--color-gray)", marginTop: 24 }}>
        As notificações ficam guardadas por {DIAS_GUARDADAS} dias.
      </p>
    </div>
  );
}

function Grupo({ titulo, itens }) {
  if (itens.length === 0) return null;
  return (
    <section style={{ marginTop: 20 }}>
      <h2 className="notif-grupo">{titulo}</h2>
      <div className="lista-card" style={{ padding: 0, overflow: "hidden" }}>
        {itens.map((n) => (
          <NotificacaoLinha key={n.id} n={n} />
        ))}
      </div>
    </section>
  );
}
