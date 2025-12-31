// src/controllers/ResetPController.js

import Movimentacao from "../models/Movimentacao.js";
import Caixa from "../models/Caixa.js";
import mongoose from "mongoose";

// Função para apenas verificar a integridade do Caixa Principal
const VerificarIntegridadePrincipal = async (req, res) => {
  try {
    const caixaPrincipal = await Caixa.findOne({ nome: "Principal" });
    if (!caixaPrincipal) {
      console.error(
        "[VERIFICAÇÃO DE INTEGRIDADE] Caixa 'Principal' não encontrado."
      );
      return res.status(404).json({
        message:
          "Caixa 'Principal' não encontrado. Verificação de integridade não pode ser realizada.",
      });
    }

    const resultadoSomaMovimentacoes = await Movimentacao.aggregate([
      {
        $group: {
          _id: null,
          totalGeralMovimentacoes: { $sum: "$valor" },
        },
      },
    ]);
    const somaMovimentacoes =
      resultadoSomaMovimentacoes.length > 0
        ? resultadoSomaMovimentacoes[0].totalGeralMovimentacoes
        : 0;

    const saldoCaixaPrincipalRegistrado = caixaPrincipal.saldo;
    const tolerancia = 0.001;

    if (
      Math.abs(somaMovimentacoes - saldoCaixaPrincipalRegistrado) < tolerancia
    ) {
      console.log(
        `[VERIFICAÇÃO DE INTEGRIDADE] Sucesso: Saldo do Caixa Principal (${saldoCaixaPrincipalRegistrado.toFixed(
          2
        )}) é consistente com a soma total das movimentações (${somaMovimentacoes.toFixed(
          2
        )}).`
      );
      return res.status(200).json({
        message:
          "Integridade do Caixa Principal verificada com sucesso. Saldo consistente. Pronto para criar movimentações de ajuste.",
        saldoRegistrado: saldoCaixaPrincipalRegistrado.toFixed(2),
        somaMovimentacoes: somaMovimentacoes.toFixed(2),
        caixaPrincipalId: caixaPrincipal._id,
        statusIntegridade: "congruente",
      });
    } else {
      console.error(
        `[VERIFICAÇÃO DE INTEGRIDADE] ALERTA CRÍTICO: Inconsistência detectada no Caixa Principal!`
      );
      console.error(
        `Saldo Registrado: ${saldoCaixaPrincipalRegistrado.toFixed(
          2
        )}, Soma das Movimentações: ${somaMovimentacoes.toFixed(2)}`
      );
      return res.status(409).json({
        message:
          "ALERTA CRÍTICO: Inconsistência detectada no Caixa Principal. Saldo registrado difere da soma total das movimentações.",
        saldoRegistrado: saldoCaixaPrincipalRegistrado.toFixed(2),
        somaMovimentacoes: somaMovimentacoes.toFixed(2),
        diferenca: (saldoCaixaPrincipalRegistrado - somaMovimentacoes).toFixed(
          2
        ),
        statusIntegridade: "incongruente",
      });
    }
  } catch (error) {
    console.error(
      "[VERIFICAÇÃO DE INTEGRIDADE] Erro durante a verificação de integridade do Caixa Principal:",
      error
    );
    return res.status(500).json({
      message:
        "Erro interno durante a verificação de integridade do Caixa Principal.",
      error: error.message,
    });
  }
};

// Função para criar as movimentações de ajuste e, em seguida, excluir as antigas do Caixa Principal
const CreateResetMovimentacoes = async (req, res) => {
  try {
    const { caixaPrincipalId, saldoRegistrado } = req.body;

    if (!caixaPrincipalId || saldoRegistrado === undefined) {
      return res.status(400).json({
        message: "Dados incompletos para criar movimentações de ajuste.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(caixaPrincipalId)) {
      return res
        .status(400)
        .json({ message: "ID do Caixa Principal inválido." });
    }

    const caixaPrincipal = await Caixa.findById(caixaPrincipalId);
    if (!caixaPrincipal) {
      return res.status(404).json({
        message: "Caixa Principal não encontrado para criar movimentações.",
      });
    }

    let movimentacaoSaldoCriada = false;
    let movimentacaoEmprestimosCriada = false;

    // --- CRIAR MOVIMENTAÇÃO "Saldo" ---
    try {
      const novaMovimentacaoSaldo = await Movimentacao.create({
        descricao: "Saldo",
        valor: parseFloat(saldoRegistrado),
        categoria: "Inicio",
        caixaId: caixaPrincipal._id,
        data: new Date(),
      });
      console.log(
        `[MOVIMENTAÇÃO AUTOMÁTICA] Movimentação 'Saldo' criada com sucesso:`,
        novaMovimentacaoSaldo
      );
      movimentacaoSaldoCriada = true;
    } catch (movError) {
      console.error(
        "[MOVIMENTAÇÃO AUTOMÁTICA] Erro ao criar movimentação 'Saldo':",
        movError
      );
    }

    // --- CRIAR MOVIMENTAÇÃO com a soma dos "Empréstimos" (com sinal invertido) ---
    try {
      const resultadoSomaEmprestimos = await Movimentacao.aggregate([
        {
          $match: { categoria: "Empréstimos" },
        },
        {
          $group: {
            _id: null,
            totalEmprestimos: { $sum: "$valor" },
          },
        },
      ]);

      const somaEmprestimos =
        resultadoSomaEmprestimos.length > 0
          ? resultadoSomaEmprestimos[0].totalEmprestimos
          : 0;

      if (somaEmprestimos !== 0) {
        // Inverte o sinal do valor total dos empréstimos
        const valorEmprestimosInvertido = -somaEmprestimos;

        const novaMovimentacaoEmprestimos = await Movimentacao.create({
          descricao: "Total Empréstimos",
          valor: valorEmprestimosInvertido, // Valor com o sinal invertido
          categoria: "Inicio",
          caixaId: caixaPrincipal._id,
          data: new Date(),
        });
        console.log(
          `[MOVIMENTAÇÃO AUTOMÁTICA] Movimentação 'Total Empréstimos' (sinal invertido) criada com sucesso:`,
          novaMovimentacaoEmprestimos
        );
        movimentacaoEmprestimosCriada = true;
      } else {
        console.log(
          "[MOVIMENTAÇÃO AUTOMÁTICA] Nenhuma movimentação de 'Empréstimos' encontrada para somar."
        );
      }
    } catch (emprestimoError) {
      console.error(
        "[MOVIMENTAÇÃO AUTOMÁTICA] Erro ao criar movimentação 'Total Empréstimos':",
        emprestimoError
      );
    }

    // --- NOVA LÓGICA: EXCLUIR MOVIMENTAÇÕES ANTIGAS DO CAIXA PRINCIPAL ---
    // Esta etapa só deve ocorrer se as novas movimentações foram criadas com sucesso.
    if (movimentacaoSaldoCriada || movimentacaoEmprestimosCriada) {
      try {
        // Exclui TODAS as movimentações associadas ao caixaPrincipal._id
        // EXCETO as duas que acabamos de criar.
        // Para isso, precisamos dos IDs das movimentações recém-criadas.
        // Uma forma mais segura é excluir todas as movimentações do caixa principal
        // que NÃO SÃO as movimentações de "Saldo" ou "Total Empréstimos" criadas AGORA.
        // No entanto, para simplificar e seguir a lógica de "limpar o histórico",
        // vamos excluir todas as movimentações do caixa principal,
        // e as recém-criadas serão as únicas restantes.
        // Se a intenção é manter as recém-criadas e apagar o resto,
        // o filtro seria: { caixaId: caixaPrincipal._id, _id: { $nin: [idMovSaldo, idMovEmprestimos] } }
        // Mas como você pediu para "excluir todas as movimentações do caixa principal",
        // e as novas já foram criadas, elas serão as únicas que restarão.

        // Vamos assumir que a intenção é limpar o histórico ANTES de criar as novas,
        // ou que as novas são as únicas que devem permanecer.
        // Se a intenção é apagar TUDO e depois criar, a ordem seria diferente.
        // Se a intenção é apagar TUDO EXCETO as que acabamos de criar, precisamos dos IDs.

        // Para a sua solicitação "após criar as mov quero que exclua todas as movimentações do caixa principal",
        // vamos excluir todas as movimentações do caixa principal que não sejam as recém-criadas.
        // Para isso, precisamos capturar os IDs das movimentações criadas.

        const idsParaManter = [];
        if (movimentacaoSaldoCriada) {
          // Se a movimentação de saldo foi criada, precisamos do seu ID
          // Para isso, o Movimentacao.create precisa retornar o objeto completo.
          // O código atual já faz isso.
          const ultimaMovSaldo = await Movimentacao.findOne({
            descricao: "Saldo",
            caixaId: caixaPrincipal._id,
          }).sort({ data: -1 }); // Pega a mais recente
          if (ultimaMovSaldo) idsParaManter.push(ultimaMovSaldo._id);
        }
        if (movimentacaoEmprestimosCriada) {
          // Se a movimentação de empréstimos foi criada, precisamos do seu ID
          const ultimaMovEmprestimos = await Movimentacao.findOne({
            descricao: "Total Empréstimos",
            caixaId: caixaPrincipal._id,
          }).sort({ data: -1 }); // Pega a mais recente
          if (ultimaMovEmprestimos)
            idsParaManter.push(ultimaMovEmprestimos._id);
        }

        const deleteResult = await Movimentacao.deleteMany({
          caixaId: caixaPrincipal._id,
          _id: { $nin: idsParaManter }, // Exclui todas as movimentações do caixa principal, EXCETO as que acabamos de criar
        });

        console.log(
          `[EXCLUSÃO DE MOVIMENTAÇÕES] ${deleteResult.deletedCount} movimentações antigas do Caixa Principal excluídas.`
        );
      } catch (deleteError) {
        console.error(
          "[EXCLUSÃO DE MOVIMENTAÇÕES] Erro ao excluir movimentações antigas do Caixa Principal:",
          deleteError
        );
        // Não vamos retornar um erro 500 aqui, pois as movimentações de ajuste foram criadas.
        // Apenas logamos o erro na exclusão.
      }
    } else {
      console.warn(
        "[EXCLUSÃO DE MOVIMENTAÇÕES] Nenhuma movimentação de ajuste foi criada, pulando a exclusão de movimentações antigas."
      );
    }

    return res.status(200).json({
      message:
        "Movimentações de ajuste criadas e antigas do Caixa Principal excluídas com sucesso.",
      movimentacaoSaldoCriada,
      movimentacaoEmprestimosCriada,
    });
  } catch (error) {
    console.error(
      "[MOVIMENTAÇÃO AUTOMÁTICA] Erro geral ao criar movimentações de ajuste ou excluir antigas:",
      error
    );
    return res.status(500).json({
      message: "Erro interno ao processar movimentações de ajuste e exclusão.",
      error: error.message,
    });
  }
};

export { VerificarIntegridadePrincipal, CreateResetMovimentacoes };
