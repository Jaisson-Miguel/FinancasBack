import Conta from "../models/Conta.js";
import Movimentacao from "../models/Movimentacao.js";
import Caixa from "../models/Caixa.js";

class ContaController {
  // Criar nova conta (store)
  async store(req, res) {
    try {
      // Recebe observacao do corpo da requisição
      const {
        instituicao,
        descricao,
        observacao,
        valor,
        dataVencimento,
        status,
      } = req.body;

      if (!instituicao || !descricao || !valor || !dataVencimento) {
        return res
          .status(400)
          .json({ error: "Dados incompletos. Informe a instituição." });
      }

      const novaConta = await Conta.create({
        instituicao,
        descricao,
        observacao, // Salva no banco
        valor,
        valorRestante: valor,
        dataVencimento,
        status: status || "pendente",
        pagamentos: [],
      });

      return res.status(201).json(novaConta);
    } catch (error) {
      console.error("Erro ao criar conta:", error);
      return res.status(500).json({ error: "Erro interno do servidor." });
    }
  }

  // Listar contas (index)
  async index(req, res) {
    try {
      const { status } = req.query;
      const filtro = {};
      if (status) filtro.status = status;

      const contas = await Conta.find(filtro).sort({ dataVencimento: 1 });
      return res.json(contas);
    } catch (error) {
      console.error("Erro ao listar contas:", error);
      return res.status(500).json({ error: "Erro ao buscar contas." });
    }
  }

  // Excluir conta (delete)
  async delete(req, res) {
    try {
      const { id } = req.params;
      const contaExcluida = await Conta.findByIdAndDelete(id);

      if (!contaExcluida) {
        return res.status(404).json({ error: "Conta não encontrada." });
      }
      return res.status(200).json({ message: "Conta excluída com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      return res.status(500).json({ error: "Erro interno do servidor." });
    }
  }

  // Atualizar conta (update)
  async update(req, res) {
    try {
      const { id } = req.params;
      // Permite atualizar a observacao também
      const {
        instituicao,
        descricao,
        observacao,
        valor,
        dataVencimento,
        status,
      } = req.body;

      const contaAtualizada = await Conta.findByIdAndUpdate(
        id,
        { instituicao, descricao, observacao, valor, dataVencimento, status },
        { new: true }
      );

      if (!contaAtualizada) {
        return res.status(404).json({ error: "Conta não encontrada." });
      }
      return res.json(contaAtualizada);
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      return res.status(500).json({ error: "Erro interno." });
    }
  }

  // Método de Pagar (Mantém a lógica de múltiplos pagamentos que já fizemos)
  async pagar(req, res) {
    try {
      const { id } = req.params;
      const { pagamentos, dataPagamento } = req.body;

      const conta = await Conta.findById(id);
      if (!conta)
        return res.status(404).json({ error: "Conta não encontrada." });

      if (conta.status === "pago") {
        return res
          .status(400)
          .json({ error: "Esta conta já foi totalmente paga." });
      }

      if (
        !pagamentos ||
        !Array.isArray(pagamentos) ||
        pagamentos.length === 0
      ) {
        return res.status(400).json({ error: "Nenhum pagamento informado." });
      }

      const totalSendoPago = pagamentos.reduce(
        (acc, item) => acc + Number(item.valor),
        0
      );
      const restanteAtual =
        conta.valorRestante !== undefined ? conta.valorRestante : conta.valor;

      if (totalSendoPago > restanteAtual + 0.05) {
        return res.status(400).json({
          error: `Valor total (R$ ${totalSendoPago}) excede o restante (R$ ${restanteAtual})`,
        });
      }

      for (const pg of pagamentos) {
        const caixa = await Caixa.findById(pg.caixaId);
        if (!caixa) continue;

        const valorSaida = -Math.abs(pg.valor);

        await Movimentacao.create({
          descricao: `Pagamento Parcial: ${conta.descricao} (${conta.instituicao})`,
          valor: valorSaida,
          tipo: "saida",
          caixaId: pg.caixaId,
          data: dataPagamento || new Date(),
        });

        caixa.saldo += valorSaida;
        await caixa.save();

        const caixaPrincipal = await Caixa.findOne({ nome: "Principal" });
        if (caixaPrincipal && caixaPrincipal._id.toString() !== pg.caixaId) {
          caixaPrincipal.saldo += valorSaida;
          await caixaPrincipal.save();
        }

        if (!conta.pagamentos) conta.pagamentos = [];
        conta.pagamentos.push({
          valorPago: pg.valor,
          data: dataPagamento || new Date(),
          caixaId: pg.caixaId,
        });
      }

      if (conta.valorRestante === undefined) conta.valorRestante = conta.valor;
      conta.valorRestante -= totalSendoPago;
      if (conta.valorRestante < 0.01) conta.valorRestante = 0;

      if (conta.valorRestante === 0) {
        conta.status = "pago";
      } else {
        conta.status = "parcial";
      }

      await conta.save();

      return res.json({
        message: "Pagamentos registrados com sucesso!",
        conta,
        restante: conta.valorRestante,
      });
    } catch (error) {
      console.error("Erro ao pagar conta:", error);
      return res.status(500).json({ error: "Erro ao processar pagamento." });
    }
  }
}

export default new ContaController();
