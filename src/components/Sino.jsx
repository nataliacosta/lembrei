import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDados } from "../contexts/DadosContext";
import { marcarLidas } from "../lib/notificacoes";
import { IconeSino } from "./Icones";
import NotificacaoLinha from "./NotificacaoLinha";

function Badge({ total }) {
  if (!total) return null;
  return <span className="sino-badge">{total > 99 ? "99+" : total}</span>;
}

function rotulo(total) {
  return total ? `Notificações: ${total} não ${total === 1 ? "lida" : "lidas"}` : "Notificações";
}

// Desktop: botão com contador que abre a lista. Celular: link para a página.
export default function Sino() {
  const { notificacoes, naoLidas } = useDados();
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState("naoLidas");
  const caixaRef = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e) {
      if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false);
    }
    function esc(e) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const lista = (aba === "naoLidas" ? notificacoes.filter((n) => !n.lida) : notificacoes).slice(0, 8);

  return (
    <>
      <div className="so-desktop sino-caixa" ref={caixaRef}>
        <button
          type="button"
          className={`sino-botao${aberto ? " aberto" : ""}`}
          aria-label={rotulo(naoLidas)}
          aria-expanded={aberto}
          onClick={() => {
            setAberto((a) => !a);
            setAba(naoLidas ? "naoLidas" : "todas");
          }}
        >
          <IconeSino size={20} />
          <Badge total={naoLidas} />
        </button>
        {aberto && (
          <div className="sino-painel" role="dialog" aria-label="Notificações">
            <div className="sino-topo">
              <span style={{ fontSize: 15, fontWeight: 700 }}>Notificações</span>
              {naoLidas > 0 && (
                <button type="button" className="link-botao" onClick={() => marcarLidas(notificacoes.filter((n) => !n.lida).map((n) => n.id))}>
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="sino-abas">
              <button type="button" className={`pill-botao${aba === "naoLidas" ? " ativo" : ""}`} aria-pressed={aba === "naoLidas"} onClick={() => setAba("naoLidas")}>
                Não lidas · {naoLidas}
              </button>
              <button type="button" className={`pill-botao${aba === "todas" ? " ativo" : ""}`} aria-pressed={aba === "todas"} onClick={() => setAba("todas")}>
                Todas
              </button>
            </div>
            <div className="sino-lista">
              {lista.length === 0 ? (
                <div className="notif-vazio">{aba === "naoLidas" ? "Nada novo por aqui. 🎉" : "Você ainda não tem notificações."}</div>
              ) : (
                lista.map((n) => <NotificacaoLinha key={n.id} n={n} compacta onAbrir={() => setAberto(false)} />)
              )}
            </div>
            <Link to="/notificacoes" className="sino-rodape" onClick={() => setAberto(false)}>
              Ver todas as notificações
            </Link>
          </div>
        )}
      </div>
      <Link to="/notificacoes" className="so-mobile sino-movel" aria-label={rotulo(naoLidas)}>
        <span className="sino-movel-icone">
          <IconeSino size={22} />
          <Badge total={naoLidas} />
        </span>
      </Link>
    </>
  );
}
