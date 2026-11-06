// Push do Lembrei! (Web Push com chave VAPID própria):
// - avisarNotificacao: a cada notificação nova no sino, manda push para os
//   aparelhos de quem recebeu (se a pessoa deixou esse tipo ligado);
// - lembretesAgendados: a cada 5 minutos, manda o resumo diário no horário
//   escolhido e avisa das reuniões X minutos antes;
// - enviarPushTeste: botão "Enviar teste" da página Configurações.
process.env.TZ = "America/Sao_Paulo";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import webpush from "web-push";
import { ehMeu } from "../../src/lib/agenda.js";
import { hhmm, hojeChave, itensAbertos, textoDoResumo } from "./resumo.js";
import { proximaOcorrencia, preparosDaOcorrencia } from "../../src/lib/reunioes.js";
import { localDe, textoDaNotificacao } from "../../src/lib/textosNotificacao.js";
import { categoriaDoTipo, mesclarPrefs } from "../../src/lib/prefsNotificacoes.js";
import { VAPID_PUBLICO } from "../../src/lib/pushChave.js";
import { linkDoItem } from "../../src/lib/itens.js";

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: "southamerica-east1", maxInstances: 5 });
const VAPID_PRIVADA = defineSecret("VAPID_PRIVADA");

function prepararWebPush() {
  webpush.setVapidDetails("https://lembrei-c3915.firebaseapp.com", VAPID_PUBLICO, VAPID_PRIVADA.value());
}

// Manda o mesmo aviso para todos os aparelhos da pessoa. Aparelhos que não
// existem mais (inscrição expirada) são removidos.
async function enviarParaUsuario(uid, aviso) {
  const snap = await db.collection("usuarios").doc(uid).collection("dispositivos").get();
  let enviados = 0;
  await Promise.all(
    snap.docs.map(async (d) => {
      const { endpoint, keys } = d.data();
      try {
        await webpush.sendNotification({ endpoint, keys }, JSON.stringify(aviso), { TTL: 12 * 3600, urgency: "normal" });
        enviados++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await d.ref.delete();
        else logger.warn("Falha ao enviar push", { uid, status: e.statusCode, corpo: e.body });
      }
    })
  );
  return enviados;
}

export const avisarNotificacao = onDocumentCreated({ document: "notificacoes/{id}", secrets: [VAPID_PRIVADA] }, async (event) => {
  const n = event.data?.data();
  if (!n?.destinatarioId) return;
  const categoria = categoriaDoTipo(n.tipo);
  const usuario = await db.collection("usuarios").doc(n.destinatarioId).get();
  const prefs = mesclarPrefs(usuario.data()?.prefsNotificacoes);
  if (categoria && !prefs.tipos[categoria]) return;
  prepararWebPush();
  const comAspas = n.tipo === "comentario" || n.tipo === "mencao";
  await enviarParaUsuario(n.destinatarioId, {
    title: textoDaNotificacao(n),
    body: n.trecho ? (comAspas ? `“${n.trecho}”` : n.trecho) : localDe(n),
    link: n.link || "/notificacoes",
    tag: `notificacao-${event.params.id}`,
  });
});

export const lembretesAgendados = onSchedule(
  { schedule: "every 5 minutes", timeZone: "America/Sao_Paulo", secrets: [VAPID_PRIVADA] },
  async () => {
    prepararWebPush();
    const agora = new Date();
    const usuarios = await db.collection("usuarios").get();
    for (const u of usuarios.docs) {
      const uid = u.id;
      try {
        const temAparelho = !(await u.ref.collection("dispositivos").limit(1).get()).empty;
        if (!temAparelho) continue;
        const dados = u.data();
        const prefs = mesclarPrefs(dados.prefsNotificacoes);
        let itens = null;

        // Resumo diário: no horário escolhido (com até 1h de folga, se uma
        // execução falhar), uma vez por dia.
        const [h, m] = String(prefs.resumo.hora || "08:00").split(":").map(Number);
        const alvo = new Date(agora);
        alvo.setHours(h || 0, m || 0, 0, 0);
        const minutosDesde = (agora - alvo) / 60000;
        if (prefs.resumo.ativo && (prefs.resumo.dias || []).includes(agora.getDay()) && minutosDesde >= 0 && minutosDesde < 60 && dados.ultimoResumo !== hojeChave(agora)) {
          itens = await itensAbertos(db, uid);
          const contratos = (await db.collection("contratos").where("membrosUids", "array-contains", uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
          await enviarParaUsuario(uid, {
            title: agora.getHours() < 12 ? "Bom dia! Seu dia no Lembrei!" : "Seu dia no Lembrei!",
            body: textoDoResumo(itens, contratos, uid),
            link: "/dashboard",
            tag: `resumo-${hojeChave(agora)}`,
          });
          await u.ref.set({ ultimoResumo: hojeChave(agora) }, { merge: true });
        }

        // Reuniões em que a pessoa é responsável, X minutos antes.
        if (prefs.reunioes.ativo) {
          const antes = Number(prefs.reunioes.minutosAntes) || 15;
          itens = itens || (await itensAbertos(db, uid));
          for (const item of itens) {
            if (item.tipo !== "reuniao" || !item.reuniao?.hora || !ehMeu(item, uid)) continue;
            const ocorrencia = proximaOcorrencia(item.reuniao);
            if (!ocorrencia) continue;
            const faltam = (ocorrencia - agora) / 60000;
            if (faltam <= 0 || faltam > antes) continue;
            const chave = `${item.id}_${hojeChave(ocorrencia)}_${hhmm(ocorrencia).replace(":", "")}`;
            const marca = u.ref.collection("pushEnviados").doc(chave);
            if ((await marca.get()).exists) continue;
            const preparos = preparosDaOcorrencia(item.reuniao, ocorrencia);
            const feitos = preparos.filter((p) => p.feito).length;
            await enviarParaUsuario(uid, {
              title: `Reunião em ${Math.max(1, Math.round(faltam))} min`,
              body: `${item.titulo} às ${hhmm(ocorrencia)}` + (preparos.length ? ` · ${feitos} de ${preparos.length} ${preparos.length === 1 ? "preparo feito" : "preparos feitos"}` : ""),
              link: linkDoItem(item.frenteId, item.id),
              tag: `reuniao-${chave}`,
            });
            await marca.set({ criadoEm: FieldValue.serverTimestamp() });
          }
        }
      } catch (e) {
        logger.error("Falha nos lembretes de " + uid, e);
      }
    }
  }
);

export const enviarPushTeste = onCall({ secrets: [VAPID_PRIVADA] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Entre na sua conta.");
  prepararWebPush();
  const enviados = await enviarParaUsuario(req.auth.uid, {
    title: "Lembrei!",
    body: "Notificações funcionando neste aparelho ✓",
    link: "/configuracoes",
    tag: "teste",
  });
  return { enviados };
});
