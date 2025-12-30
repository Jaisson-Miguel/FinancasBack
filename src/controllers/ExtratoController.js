import Movimentacao from "../models/Movimentacao.js";
import Caixa from "../models/Caixa.js"; // Importa o modelo de Caixa
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
      // 1. Agrupamento de categorias (excluindo "inicio")
      const matchQuery = {
        $and: [
          {
            $or: [{ valor: { $lt: 0 } }, { categoria: "Empréstimos" }],
          },
          { categoria: { $ne: "inicio" } },
        ],
      };

      const relatorio = await Movimentacao.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$categoria",
            total: { $sum: "$valor" },
          },
        },
        { $sort: { total: 1 } },
      ]);

      // 2. Soma das movimentações com categoria "entrada"
      const entrada = await Movimentacao.aggregate([
        {
          $match: {
            categoria: "Entrada",
          },
        },
        {
          $group: {
            _id: null,
            totalEntrada: { $sum: "$valor" },
          },
        },
      ]);

      const totalEntrada = entrada.length > 0 ? entrada[0].totalEntrada : 0;
      // 3. Retorno final
      return res.json({
        categorias: relatorio,
        totalEntrada,
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
