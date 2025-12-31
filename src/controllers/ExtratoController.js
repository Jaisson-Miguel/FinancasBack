import Movimentacao from "../models/Movimentacao.js";
import Caixa from "../models/Caixa.js";
import Adicional from "../models/Adicional.js";
import mongoose from "mongoose";

export default {
  // --- ROTA: GET /extrato ---
  async index(req, res) {
    try {
      const movimentacoes = await Movimentacao.find()
        .populate("caixaId", "nome")
        .sort({ data: -1 });

      return res.json(movimentacoes);
    } catch (error) {
      console.error("Erro ao buscar extrato geral:", error);
      return res.status(500).json({ error: "Erro interno ao buscar extrato." });
    }
  },

  // --- ROTA: GET /extrato/:caixaId ---
  async porCaixa(req, res) {
    try {
      let { caixaId } = req.params;
      // Se o parâmetro for "principal", busca o _id real
      if (caixaId === "Principal") {
        const caixaPrincipal = await Caixa.findOne({ nome: "Principal" });
        if (!caixaPrincipal) {
          return res
            .status(404)
            .json({ error: "Caixa Principal não encontrado." });
        }
        caixaId = caixaPrincipal._id;
      }

      // Valida se o caixaId é um ObjectId válido
      if (!mongoose.Types.ObjectId.isValid(caixaId)) {
        return res.status(400).json({ error: "ID de caixa inválido." });
      }

      const movimentacoes = await Movimentacao.find({ caixaId })
        .populate("caixaId", "nome")
        .sort({ data: -1 });

      return res.json(movimentacoes);
    } catch (error) {
      console.error("Erro ao buscar extrato por caixa:", error);
      return res
        .status(500)
        .json({ error: "Erro interno ao buscar extrato da caixa." });
    }
  },

  // --- ROTA: GET /extrato/categorias/:caixaId ---
  async relatorioCategorias(req, res) {
    try {
      // --- 1. Processamento de Gastos Operacionais ---
      const gastosOperacionais = await Movimentacao.aggregate([
        {
          $match: {
            valor: { $lt: 0 },
            categoria: { $nin: ["Empréstimos", "Inicio", "Entrada"] },
          },
        },
        {
          $group: {
            _id: "$categoria",
            total: { $sum: "$valor" },
          },
        },
        { $sort: { total: 1 } },
        {
          $project: {
            _id: 0,
            nome: "$_id",
            valor: "$total",
            valorAbsoluto: { $abs: "$total" },
          },
        },
      ]);
      const totalGastos = gastosOperacionais.reduce(
        (acc, item) => acc + item.valorAbsoluto,
        0
      );

      // --- 2. Processamento de Empréstimos / Caixas ---
      const listaEmprestimos = await Movimentacao.aggregate([
        {
          $match: {
            categoria: "Empréstimos",
          },
        },
        {
          $group: {
            _id: "$categoria",
            total: { $sum: "$valor" },
          },
        },
        { $sort: { total: -1 } },
        {
          $project: {
            _id: 0,
            nome: "$_id",
            valor: "$total",
            valorAbsoluto: { $abs: "$total" },
          },
        },
      ]);
      const totalEmprestimos = listaEmprestimos.reduce(
        (acc, item) => acc + item.valor,
        0
      );

      // --- 3. Processamento de Saldos Iniciais (Categoria "Inicio") ---
      const listaInicio = await Movimentacao.aggregate([
        {
          $match: {
            categoria: "Inicio",
          },
        },
        {
          $group: {
            _id: "$categoria",
            total: { $sum: "$valor" },
          },
        },
        { $sort: { total: -1 } },
        {
          $project: {
            _id: 0,
            nome: "$_id",
            valor: "$total",
            valorAbsoluto: { $abs: "$total" },
          },
        },
      ]);
      const totalInicio = listaInicio.reduce(
        (acc, item) => acc + item.valor,
        0
      );

      // --- 4. Processamento de Entradas Diretas ---
      const entradasDiretas = await Movimentacao.aggregate([
        {
          $match: {
            categoria: "Entrada",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$valor" },
          },
        },
        {
          $project: {
            _id: 0,
            nome: "Entradas Diretas",
            valor: "$total",
            valorAbsoluto: { $abs: "$total" },
          },
        },
      ]);
      const totalEntrada =
        entradasDiretas.length > 0 ? entradasDiretas[0].valor : 0;
      const listaEntradas = entradasDiretas.length > 0 ? entradasDiretas : [];

      // --- NOVO: Buscar as metas de porcentagem fixa da coleção Adicional ---
      // Buscamos todos os documentos da coleção Adicional que representam metas de porcentagem.
      // Podemos definir um 'grupo' específico para elas, por exemplo, 'metas_categorias',
      // ou simplesmente buscar todas as chaves que você sabe que são metas.
      // Por simplicidade, vamos assumir que todas as entradas em Adicional com 'valor'
      // são metas de porcentagem para categorias.
      const metasAdicionais = await Adicional.find({
        valor: { $exists: true },
      });

      // Transformar o array de documentos em um objeto para fácil acesso no frontend
      // Ex: { "Alimentação": 20, "Transporte": 10, ... }
      const metasPorcentagemFixa = metasAdicionais.reduce((acc, meta) => {
        // A chave no BD é o nome da categoria (ex: "Alimentação")
        // O valor no BD é a porcentagem (ex: 20)
        acc[meta.chave] = meta.valor;
        return acc;
      }, {});
      // -------------------------------------------------------------------

      // --- 5. Retorno Final Consolidado ---
      return res.json({
        gastos: gastosOperacionais,
        totalGastos: totalGastos,
        emprestimos: listaEmprestimos,
        totalEmprestimos: totalEmprestimos,
        inicio: listaInicio,
        totalInicio: totalInicio,
        entradas: listaEntradas,
        totalEntrada: totalEntrada,
        metasPorcentagemFixa: metasPorcentagemFixa, // Adiciona as metas ao retorno
      });
    } catch (error) {
      console.error("Erro no relatório de categorias:", error);
      return res.status(500).json({ error: "Erro ao gerar relatório." });
    }
  },

  // --- ROTA: GET /extrato/resumo ---
  async resumo(req, res) {
    try {
      const dados = await Movimentacao.aggregate([
        {
          $group: {
            _id: null,
            totalEntradas: {
              $sum: {
                $cond: [{ $gt: ["$valor", 0] }, "$valor", 0],
              },
            },
            totalSaidas: {
              $sum: {
                $cond: [{ $lt: ["$valor", 0] }, "$valor", 0],
              },
            },
            saldoFinal: { $sum: "$valor" },
          },
        },
      ]);

      if (dados.length > 0) {
        return res.json(dados[0]);
      } else {
        return res.json({ totalEntradas: 0, totalSaidas: 0, saldoFinal: 0 });
      }
    } catch (error) {
      console.error("Erro ao calcular resumo:", error);
      return res.status(500).json({ error: "Erro interno no resumo." });
    }
  },
};
