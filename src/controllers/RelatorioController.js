// src/controllers/RelatorioController.js
import pdf from "pdf-creator-node";
import fs from "fs";
import path from "path";
import Movimentacao from "../models/Movimentacao.js";
import Caixa from "../models/Caixa.js";
import Handlebars from "handlebars"; // <-- Importe o Handlebars aqui

// Função auxiliar para formatar valores monetários
const formatCurrency = (value) => {
  // Usa Math.abs para formatar o valor absoluto, pois o sinal será tratado pelo "tipo"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(value));
};

// --- REGISTRAR HELPER 'eq' GLOBALMENTE ANTES DE TUDO ---
// Isso garante que o helper esteja disponível para qualquer template Handlebars
Handlebars.registerHelper("eq", function (v1, v2) {
  return v1 === v2;
});
// --- FIM DO REGISTRO GLOBAL DO HELPER ---

const generatePdfReport = async (req, res) => {
  try {
    // 1. Obter todas as movimentações e caixas
    const movimentacoes = await Movimentacao.find()
      .populate("caixaId") // Popula o campo caixaId com os dados do Caixa
      .sort({ data: 1 }); // Ordenar pela data da movimentação, da mais antiga para a mais recente

    const caixas = await Caixa.find();
    // O saldo total do sistema é obtido da tabela de caixas, conforme sua memória
    const saldoTotalSistema = caixas.reduce(
      (acc, caixa) => acc + caixa.saldo,
      0
    );

    // 2. Processar e agrupar os dados
    const dadosRelatorio = {
      dataGeracao: new Date().toLocaleDateString("pt-BR"),
      movimentacoesPorCaixaSecundario: [],
      movimentacoesCaixaPrincipalPorCategoria: [],
      saldoTotalSistema: formatCurrency(saldoTotalSistema),
    };

    const gruposPorCaixaSecundario = {};
    const gruposCaixaPrincipalPorCategoria = {};

    for (const mov of movimentacoes) {
      const caixaNome = mov.caixaId.nome; // Acessa o nome do caixa populado
      const tipoMovimentacao = mov.valor >= 0 ? "entrada" : "saida"; // Determina o tipo pelo sinal do valor

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
          valor: formatCurrency(mov.valor), // Formata o valor absoluto
        });
        gruposCaixaPrincipalPorCategoria[categoria].totalCategoria += mov.valor; // Soma o valor real (positivo ou negativo)
      } else {
        // Movimentações de Caixas Secundários detalhadas por caixa
        if (!gruposPorCaixaSecundario[caixaNome]) {
          gruposPorCaixaSecundario[caixaNome] = {
            nome: caixaNome,
            movimentacoes: [],
          };
        }
        gruposPorCaixaSecundario[caixaNome].movimentacoes.push({
          data: mov.data.toLocaleDateString("pt-BR"),
          descricao: mov.descricao,
          categoria: mov.categoria,
          tipo: tipoMovimentacao === "entrada" ? "Entrada" : "Saída",
          valor: formatCurrency(mov.valor), // Formata o valor absoluto
        });
      }
    }

    dadosRelatorio.movimentacoesPorCaixaSecundario = Object.values(
      gruposPorCaixaSecundario
    );
    dadosRelatorio.movimentacoesCaixaPrincipalPorCategoria = Object.values(
      gruposCaixaPrincipalPorCategoria
    ).map((grupo) => ({
      ...grupo,
      totalCategoria: formatCurrency(grupo.totalCategoria), // Formata o total da categoria
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
      header: {
        height: "15mm",
        contents:
          '<div style="text-align: center; font-size: 12px; color: #444;">Relatório de Movimentações Financeiras</div>',
      },
      footer: {
        height: "10mm",
        contents: {
          first: "Página 1",
          default:
            '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>',
          last: "Última Página",
        },
      },
      // Remova a seção 'helpers' daqui, pois registramos globalmente
      // helpers: {
      //   eq: function (v1, v2) {
      //     return v1 === v2;
      //   },
      // },
    };

    const document = {
      html: html,
      data: {
        report: dadosRelatorio,
      },
      path: "./output.pdf", // Caminho temporário para salvar o PDF no servidor
      type: "buffer", // Retorna o PDF como um buffer
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
