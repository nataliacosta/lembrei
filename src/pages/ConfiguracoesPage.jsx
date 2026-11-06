import { useEffect, useState } from "react";
import Avatar from "../components/Avatar";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import { FUNCIONALIDADES } from "../lib/funcionalidades";
import { TIPOS_DE_AVISO, mesclarPrefs } from "../lib/prefsNotificacoes";
import {
  ativarPush,
  desativarPush,
  ehIOS,
  enviarTeste,
  estaInstalado,
  inscricaoAtual,
  removerDispositivo,
  salvarFuncionalidades,
  salvarPrefs,
  suportaPush,
  watchDispositivos,
  watchPrefs,
} from "../lib/push";
import { formatarData } from "../lib/datas";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
const ANTECEDENCIAS = [5, 10, 15, 30, 60];

function Chave({ ligada, onChange, rotulo }) {
  return (
    <button type="button" role="switch" aria-checked={ligada} aria-label={rotulo} className={`chave ${ligada ? "ligada" : ""}`} onClick={() => onChange(!ligada)}>
      <span />
    </button>
  );
}

export default function ConfiguracoesPage() {
  const { user, signOut } = useAuth();
  const { funcionalidades } = useDados();
  const [prefs, setPrefs] = useState(() => mesclarPrefs(null));
  const [dispositivos, setDispositivos] = useState([]);
  const [atualId, setAtualId] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const suporta = suportaPush();
  const iosSemInstalar = ehIOS() && !estaInstalado();
  const bloqueado = suporta && Notification.permission === "denied";

  useEffect(() => watchPrefs(user.uid, (p) => setPrefs(mesclarPrefs(p))), [user.uid]);
  useEffect(() => watchDispositivos(user.uid, setDispositivos), [user.uid]);
  useEffect(() => {
    inscricaoAtual()
      .then((a) => setAtualId(a?.id || null))
      .catch(() => setAtualId(null));
  }, [dispositivos.length]);

  const ativoAqui = atualId && dispositivos.some((d) => d.id === atualId);
  const outros = dispositivos.filter((d) => d.id !== atualId);

  function mudar(parte, valores) {
    const novo = { ...prefs, [parte]: { ...prefs[parte], ...valores } };
    setPrefs(novo);
    salvarPrefs(user.uid, novo).catch((e) => {
      console.error("Erro ao salvar preferências:", e);
      setMensagem("Não deu pra salvar. Tente de novo.");
    });
  }

  async function executar(acao, sucesso) {
    setOcupado(true);
    setMensagem("");
    try {
      const r = await acao();
      if (sucesso) setMensagem(typeof sucesso === "function" ? sucesso(r) : sucesso);
    } catch (e) {
      console.error(e);
      setMensagem(
        e.message === "bloqueado"
          ? "As notificações estão bloqueadas para o Lembrei! nas configurações do navegador."
          : "Não deu certo. Tente de novo."
      );
    }
    setOcupado(false);
  }

  const ativar = () =>
    executar(async () => {
      const id = await ativarPush(user.uid);
      setAtualId(id);
    }, "Pronto! Os avisos vão chegar neste aparelho.");
  const desativar = () =>
    executar(async () => {
      await desativarPush(user.uid);
      setAtualId(null);
    }, "Notificações desativadas neste aparelho.");
  const teste = () => executar(enviarTeste, (n) => (n ? "Aviso de teste enviado. Deve chegar em alguns segundos." : "Nenhum aparelho ativado para receber."));

  const diasResumo = prefs.resumo.dias || [];

  return (
    <div className="page-shell" style={{ paddingTop: 24, paddingBottom: 48, maxWidth: 760 }}>
      <h1 style={{ margin: "0 0 16px", fontSize: 26, fontWeight: 700 }}>Configurações</h1>

      <div className="lista-card cfg-linha">
        <span style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <Avatar nome={user?.displayName || user?.email} url={user?.photoURL} tamanho={44} decorativo />
          <span style={{ minWidth: 0 }}>
            <span className="cfg-titulo">{user?.displayName || "—"}</span>
            <span className="cfg-detalhe" style={{ overflowWrap: "anywhere" }}>
              {user?.email}
            </span>
          </span>
        </span>
        <button type="button" onClick={signOut} className="btn btn-ghost btn-sm">
          Sair
        </button>
      </div>

      <h2 className="cfg-secao">Funcionalidades</h2>
      <div className="lista-card">
        {FUNCIONALIDADES.map((f) => (
          <div key={f.chave} className="cfg-linha">
            <span>
              <span className="cfg-titulo">{f.titulo}</span>
              <span className="cfg-detalhe">{f.detalhe}</span>
            </span>
            <Chave
              ligada={Boolean(funcionalidades[f.chave])}
              rotulo={f.titulo}
              onChange={(v) =>
                salvarFuncionalidades(user.uid, { ...funcionalidades, [f.chave]: v }).catch((e) => {
                  console.error("Erro ao salvar funcionalidades:", e);
                  setMensagem("Não deu pra salvar. Tente de novo.");
                })
              }
            />
          </div>
        ))}
      </div>
      <div className="cfg-detalhe" style={{ marginTop: 8 }}>
        Desligar só esconde do seu menu, do seu “O que fazer” e da busca. Nada é apagado e vale só para você: dá para ligar de novo quando quiser.
      </div>

      <h2 className="cfg-secao">Notificações neste aparelho</h2>
      {iosSemInstalar ? (
        <div className="lista-card cfg-aviso">
          <div className="cfg-titulo">Para receber avisos no iPhone, instale o Lembrei!</div>
          <div className="cfg-detalhe" style={{ lineHeight: 1.5, marginTop: 6 }}>
            No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Abra o Lembrei! pelo ícone e volte aqui. (Precisa do iOS 16.4 ou mais novo.)
          </div>
        </div>
      ) : !suporta ? (
        <div className="lista-card cfg-aviso">
          <div className="cfg-titulo">Este navegador não recebe notificações push</div>
          <div className="cfg-detalhe">No iPhone, atualize para o iOS 16.4 ou mais novo. No computador, use Chrome, Edge, Firefox ou Safari.</div>
        </div>
      ) : (
        <div className="lista-card">
          {ativoAqui ? (
            <div className="cfg-linha" style={{ background: "#f3fbfa", flexWrap: "wrap" }}>
              <span>
                <span className="cfg-titulo">✓ Ativadas neste aparelho</span>
                <span className="cfg-detalhe">Os avisos chegam mesmo com o Lembrei! fechado.</span>
              </span>
              <span style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={teste} disabled={ocupado}>
                  Enviar teste
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={desativar} disabled={ocupado}>
                  Desativar
                </button>
              </span>
            </div>
          ) : (
            <div className="cfg-linha" style={{ flexWrap: "wrap" }}>
              <span>
                <span className="cfg-titulo">{bloqueado ? "Notificações bloqueadas" : "Notificações desativadas neste aparelho"}</span>
                <span className="cfg-detalhe">
                  {bloqueado
                    ? "Libere as notificações para o Lembrei! nas configurações do navegador e tente de novo."
                    : "Ative para receber os avisos mesmo com o Lembrei! fechado."}
                </span>
              </span>
              <button type="button" className="btn btn-primary" onClick={ativar} disabled={ocupado || bloqueado}>
                Ativar notificações
              </button>
            </div>
          )}
          {outros.map((d) => (
            <div key={d.id} className="cfg-linha">
              <span>
                <span className="cfg-titulo">{d.nome || "Outro aparelho"}</span>
                <span className="cfg-detalhe">{d.criadoEm ? `ativado em ${formatarData(d.criadoEm)}` : "ativado"}</span>
              </span>
              <button type="button" className="link-botao" onClick={() => removerDispositivo(user.uid, d.id)}>
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
      {mensagem && (
        <div className="cfg-detalhe" role="status" style={{ marginTop: 8, fontWeight: 600, color: "var(--color-primary)" }}>
          {mensagem}
        </div>
      )}
      <div className="cfg-detalhe" style={{ marginTop: 8 }}>
        Em um aparelho novo, abra esta página nele e toque em “Ativar notificações”.
      </div>

      <h2 className="cfg-secao">O que avisar por push</h2>
      <div className="lista-card">
        {TIPOS_DE_AVISO.map((t) => (
          <div key={t.chave} className="cfg-linha">
            <span>
              <span className="cfg-titulo">{t.titulo}</span>
              {t.detalhe && <span className="cfg-detalhe">{t.detalhe}</span>}
            </span>
            <Chave ligada={Boolean(prefs.tipos[t.chave])} rotulo={t.titulo} onChange={(v) => mudar("tipos", { [t.chave]: v })} />
          </div>
        ))}
      </div>

      <h2 className="cfg-secao">Resumo diário</h2>
      <div className="lista-card">
        <div className="cfg-linha">
          <span>
            <span className="cfg-titulo">Mandar um resumo do dia</span>
            <span className="cfg-detalhe">Atrasados, o que vence hoje, reuniões, preparos e medições</span>
          </span>
          <Chave ligada={prefs.resumo.ativo} rotulo="Resumo diário" onChange={(v) => mudar("resumo", { ativo: v })} />
        </div>
        {prefs.resumo.ativo && (
          <>
            <div className="cfg-linha">
              <span className="cfg-titulo">Horário</span>
              <input
                type="time"
                className="cfg-campo"
                value={prefs.resumo.hora}
                onChange={(e) => e.target.value && mudar("resumo", { hora: e.target.value })}
                aria-label="Horário do resumo"
              />
            </div>
            <div className="cfg-linha" style={{ flexWrap: "wrap" }}>
              <span className="cfg-titulo">Dias</span>
              <span className="cfg-dias" role="group" aria-label="Dias do resumo">
                {ORDEM_DIAS.map((d) => {
                  const on = diasResumo.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      className={on ? "ativo" : ""}
                      aria-pressed={on}
                      onClick={() => mudar("resumo", { dias: on ? diasResumo.filter((x) => x !== d) : [...diasResumo, d].sort() })}
                    >
                      {DIAS[d]}
                    </button>
                  );
                })}
              </span>
            </div>
            <div className="cfg-linha" style={{ display: "block", background: "#fafbfb" }}>
              <div className="cfg-detalhe" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                Exemplo
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <b>Bom dia! Seu dia no Lembrei!</b>
                <br />2 atrasados · 3 para hoje · reunião 14:00 (1:1 com a gestora)
              </div>
            </div>
          </>
        )}
      </div>

      <h2 className="cfg-secao">Lembrete de reuniões</h2>
      <div className="lista-card">
        <div className="cfg-linha">
          <span>
            <span className="cfg-titulo">Avisar antes das reuniões</span>
            <span className="cfg-detalhe">Das reuniões em que você é responsável</span>
          </span>
          <Chave ligada={prefs.reunioes.ativo} rotulo="Lembrete de reuniões" onChange={(v) => mudar("reunioes", { ativo: v })} />
        </div>
        {prefs.reunioes.ativo && (
          <div className="cfg-linha">
            <span className="cfg-titulo">Quanto tempo antes</span>
            <select
              className="cfg-campo"
              value={prefs.reunioes.minutosAntes}
              onChange={(e) => mudar("reunioes", { minutosAntes: Number(e.target.value) })}
              aria-label="Quanto tempo antes"
            >
              {ANTECEDENCIAS.map((m) => (
                <option key={m} value={m}>
                  {m === 60 ? "1 hora" : `${m} minutos`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
