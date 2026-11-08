// Excel dos orçamentos (só no navegador; as bibliotecas carregam sob demanda).
import { COLUNAS_COMPLETA, COLUNAS_CONDENSADA, abaDaPlanilha, larguras, lerPlanilhaOrcamento, linhasCondensadas, MESES } from "./orcamentos";

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function gerar(abas, nome) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const blob = await writeXlsxFile(abas).toBlob();
  baixarBlob(blob, nome);
}

const exemploCompleta = {
  agrupamento: "Sustentação",
  tipo: "Serviço",
  item: "Dev OutSystems SR",
  pessoa: "Nome da pessoa",
  tiPaga: true,
  quemPaga: "TI",
  quemSeBeneficia: "Canais Digitais",
  valorUnitario: 23480,
  quantidade: 1,
  meses: Array(12).fill(23480),
  projeto: "Canais Digitais",
  fornecedor: "Fornecedor X",
  linha: "L-014",
};
const exemploCondensada = {
  projeto: "Canais Digitais",
  fornecedor: "Fornecedor X",
  linha: "L-014",
  odi: "18207245",
  capexAnoAnterior: 0,
  tipo: "Serviço/sustentação",
  classificacao: "Obrigatório",
  diretoria: "Digital",
  area: "Canais Digitais",
  responsavel: "TI",
  meses: Array(12).fill(42260),
};

// Um arquivo com as duas abas, cada uma com uma linha de exemplo (apague antes de subir).
export function baixarModelos() {
  return gerar(
    [
      { sheet: "Completa", data: abaDaPlanilha(COLUNAS_COMPLETA, [exemploCompleta]), columns: larguras(COLUNAS_COMPLETA) },
      { sheet: "Condensada", data: abaDaPlanilha(COLUNAS_CONDENSADA, [exemploCondensada]), columns: larguras(COLUNAS_CONDENSADA) },
    ],
    "modelo_orcamento.xlsx"
  );
}

// Aba "Condensada" sempre; aba "Completa" se a versão foi cadastrada na completa.
export function baixarOrcamento(versao, conteudo) {
  const abas = [{ sheet: "Condensada", data: abaDaPlanilha(COLUNAS_CONDENSADA, linhasCondensadas(versao, conteudo)), columns: larguras(COLUNAS_CONDENSADA) }];
  if (versao.visao === "completa") abas.push({ sheet: "Completa", data: abaDaPlanilha(COLUNAS_COMPLETA, conteudo.completa || []), columns: larguras(COLUNAS_COMPLETA) });
  return gerar(abas, `orcamento_${versao.ano}_${String(versao.versao).replace(/[^\p{L}\p{N}-]+/gu, "_")}.xlsx`);
}

// Lê a aba certa do arquivo (a que tiver as colunas da visão escolhida).
export async function lerArquivoOrcamento(arquivo, visao) {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const folhas = await readXlsxFile(arquivo);
  const preferida = folhas.find((f) => (f.sheet || "").toLowerCase().startsWith(visao === "condensada" ? "condens" : "complet"));
  const ordem = preferida ? [preferida, ...folhas.filter((f) => f !== preferida)] : folhas;
  let primeira = null;
  for (const f of ordem) {
    const r = lerPlanilhaOrcamento(f.data || [], visao);
    if (!r.faltando.length) return r;
    primeira = primeira || r;
  }
  return primeira || { linhas: [], faltando: ["(nenhuma aba)"] };
}

export { MESES };
