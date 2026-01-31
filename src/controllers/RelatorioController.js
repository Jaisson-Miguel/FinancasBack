import pdf from "pdf-creator-node";
import fs from "fs";
import path from "path";
import Movimentacao from "../models/Movimentacao.js";
import Caixa from "../models/Caixa.js";
import Handlebars from "handlebars";

// Função auxiliar para formatar valores monetários (SEM SINAL - para as linhas da tabela)
const formatCurrency = (value) => {
  // Usa Math.abs para formatar o valor absoluto, pois o sinal será tratado pelo "tipo" na tabela
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(value));
};

// NOVA FUNÇÃO: Formatar valores COM SINAL (para os totais)
const formatCurrencyWithSign = (value) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value); // Aqui NÃO usamos Math.abs, para manter o negativo
};

// --- REGISTRAR HELPER 'eq' GLOBALMENTE ANTES DE TUDO ---
Handlebars.registerHelper("eq", function (v1, v2) {
  return v1 === v2;
});
// --- FIM DO REGISTRO GLOBAL DO HELPER ---

const generatePdfReport = async (req, res) => {
  try {
    // 1. Obter todas as movimentações e caixas
    const movimentacoes = await Movimentacao.find()
      .populate("caixaId")
      .sort({ data: 1 });
    const caixas = await Caixa.find();

    // O saldo total do sistema agora será a soma apenas dos caixas secundários
    const saldoTotalCaixasSecundarios = caixas.reduce((acc, caixa) => {
      if (caixa.nome !== "Principal") {
        return acc + caixa.saldo;
      }
      return acc;
    }, 0);

    // 2. Processar e agrupar os dados
    const dadosRelatorio = {
      dataGeracao: new Date().toLocaleDateString("pt-BR"),
      movimentacoesPorCaixaSecundario: [],
      movimentacoesCaixaPrincipalPorCategoria: [],
      // ALTERADO: Usa a função com sinal para o saldo total
      saldoTotalSistema: formatCurrencyWithSign(saldoTotalCaixasSecundarios),
    };

    const gruposPorCaixaSecundario = {};
    const gruposCaixaPrincipalPorCategoria = {};

    for (const mov of movimentacoes) {
      const caixaNome = mov.caixaId.nome;
      const tipoMovimentacao = mov.valor >= 0 ? "entrada" : "saida";

      if (caixaNome === "Principal") {
        // Movimentações do Caixa Principal agrupadas por categoria
        const categoria = mov.categoria;
        if (!gruposCaixaPrincipalPorCategoria[categoria]) {
          gruposCaixaPrincipalPorCategoria[categoria] = {
            nome: categoria,
            movimentacoes: [],
            totalCategoria: 0,
          };
        }
        gruposCaixaPrincipalPorCategoria[categoria].movimentacoes.push({
          data: mov.data.toLocaleDateString("pt-BR"),
          descricao: mov.descricao,
          tipo: tipoMovimentacao === "entrada" ? "Entrada" : "Saída",
          valor: formatCurrency(mov.valor), // Mantém absoluto na tabela
        });
        gruposCaixaPrincipalPorCategoria[categoria].totalCategoria += mov.valor;
      } else {
        // Movimentações de Caixas Secundários detalhadas por caixa
        if (!gruposPorCaixaSecundario[caixaNome]) {
          gruposPorCaixaSecundario[caixaNome] = {
            nome: caixaNome,
            movimentacoes: [],
            totalCaixa: 0,
          };
        }
        gruposPorCaixaSecundario[caixaNome].movimentacoes.push({
          data: mov.data.toLocaleDateString("pt-BR"),
          descricao: mov.descricao,
          categoria: mov.categoria,
          tipo: tipoMovimentacao === "entrada" ? "Entrada" : "Saída",
          valor: formatCurrency(mov.valor), // Mantém absoluto na tabela
        });
        gruposPorCaixaSecundario[caixaNome].totalCaixa += mov.valor;
      }
    }

    dadosRelatorio.movimentacoesPorCaixaSecundario = Object.values(
      gruposPorCaixaSecundario
    ).map((grupo) => ({
      ...grupo,
      // ALTERADO: Usa a função com sinal para o total da caixa
      totalCaixa: formatCurrencyWithSign(grupo.totalCaixa),
    }));

    dadosRelatorio.movimentacoesCaixaPrincipalPorCategoria = Object.values(
      gruposCaixaPrincipalPorCategoria
    ).map((grupo) => ({
      ...grupo,
      // ALTERADO: Usa a função com sinal para o total da categoria
      totalCategoria: formatCurrencyWithSign(grupo.totalCategoria),
    }));

    // 3. Carregar o template HTML
    const htmlTemplatePath = path.resolve(
      process.cwd(),
      "src",
      "views",
      "pdfTemplate.html"
    );
    const html = fs.readFileSync(htmlTemplatePath, "utf8");

    const options = {
      format: "A4",
      orientation: "portrait",
      border: "10mm",
      footer: {
        height: "10mm",
        contents: {
          first: "Página 1",
          default:
            '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>',
          last: "Última Página",
        },
      },
    };

    const document = {
      html: html,
      data: {
        report: dadosRelatorio,
      },
      path: "./output.pdf",
      type: "buffer",
    };

    // 4. Gerar o PDF
    const pdfBuffer = await pdf.create(document, options);

    // 5. Enviar o PDF como resposta
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=relatorio_financeiro.pdf"
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erro ao gerar relatório PDF:", error);
    res
      .status(500)
      .json({ message: "Erro ao gerar relatório PDF", error: error.message });
  }
};

export { generatePdfReport };
