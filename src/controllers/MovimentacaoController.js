import Movimentacao from "../models/Movimentacao.js";
import Caixa from "../models/Caixa.js";

export default {
  // --- CRIAR (STORE) ---
  async store(req, res) {
    try {
      const { descricao, valor, tipo, caixaId, categoria } = req.body;

      // Define o valor final (positivo ou negativo)
      let valorFinal = parseFloat(valor);
      if (tipo === "saida") {
        valorFinal = -Math.abs(valorFinal);
      } else {
        valorFinal = Math.abs(valorFinal);
      }

      // 1. Cria a movimentação
      const novaMovimentacao = await Movimentacao.create({
        descricao,
        valor: valorFinal,
        tipo,
        caixaId,
        categoria,
        data: new Date(),
      });

      // 2. Atualiza o saldo da caixa específica
      const caixa = await Caixa.findById(caixaId);

      if (caixa) {
        caixa.saldo += valorFinal;
        await caixa.save();

        // 3. Se NÃO for a caixa Principal, atualiza também a Principal
        if (caixa.nome !== "Principal") {
          const caixaPrincipal = await Caixa.findOne({ nome: "Principal" });
          if (caixaPrincipal) {
            caixaPrincipal.saldo += valorFinal;
            await caixaPrincipal.save();
          }
        }
      }

      return res.json(novaMovimentacao);
    } catch (error) {
      console.error("Erro ao criar movimentação:", error);
      return res.status(500).json({ error: "Erro interno ao criar." });
    }
  },

  // --- ATUALIZAR (UPDATE) ---
  async update(req, res) {
    try {
      const { id } = req.params;
      const { descricao, categoria } = req.body;

      // Atualiza apenas campos descritivos (não altera valor/saldo por segurança)
      const movimentacaoAtualizada = await Movimentacao.findByIdAndUpdate(
        id,
        { descricao, categoria },
        { new: true }
      );

      if (!movimentacaoAtualizada) {
        return res.status(404).json({ error: "Movimentação não encontrada." });
      }

      return res.json(movimentacaoAtualizada);
    } catch (error) {
      console.error("Erro ao atualizar movimentação:", error);
      return res.status(500).json({ error: "Erro interno ao atualizar." });
    }
  },

  // --- DELETAR (DELETE) ---
  async delete(req, res) {
    try {
      const { id } = req.params;

      // 1. Busca a movimentação antes de deletar
      const movimentacao = await Movimentacao.findById(id);

      if (!movimentacao) {
        return res.status(404).json({ error: "Movimentação não encontrada." });
      }

      const valorParaReverter = movimentacao.valor;
      const caixaOrigemId = movimentacao.caixaId;

      // 2. Busca a caixa de origem e reverte saldo
      const caixaOrigem = await Caixa.findById(caixaOrigemId);

      if (caixaOrigem) {
        caixaOrigem.saldo -= valorParaReverter;
        await caixaOrigem.save();

        // 3. Reverte no Principal (se necessário)
        if (caixaOrigem.nome !== "Principal") {
          const caixaPrincipal = await Caixa.findOne({ nome: "Principal" });
          if (caixaPrincipal) {
            caixaPrincipal.saldo -= valorParaReverter;
            await caixaPrincipal.save();
          }
        }
      }

      // 4. Deleta o registro
      await Movimentacao.findByIdAndDelete(id);

      return res.json({
        message: "Movimentação deletada e saldos atualizados.",
      });
    } catch (error) {
      console.error("Erro ao deletar movimentação:", error);
      return res.status(500).json({ error: "Erro interno ao deletar." });
    }
  },
};
