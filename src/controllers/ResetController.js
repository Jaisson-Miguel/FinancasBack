// src/controllers/ResetController.js

import Movimentacao from "../models/Movimentacao.js";
import Caixa from "../models/Caixa.js";

const resetCaixaSecundario = async (req, res) => {
  try {
    const { id } = req.params; // Obter o ID do caixa da URL

    // 1. Buscar o caixa específico
    const caixa = await Caixa.findById(id);

    if (!caixa) {
      console.log(
        `[OPERAÇÃO DE SALDO ANTERIOR] Caixa com ID ${id} não encontrado.`
      );
      return res.status(404).json({ message: "Caixa não encontrado." });
    }

    // 2. Verificar se é caixa "Principal"
    // Usamos a memória de que o usuário identifica o caixa principal pelo nome "Principal"
    if (caixa.nome === "Principal") {
      console.log(
        `[OPERAÇÃO DE SALDO ANTERIOR] Tentativa de operar no caixa "Principal" (ID: ${id}).`
      );
      return res.status(403).json({
        message: "Não é permitido realizar esta operação no caixa 'Principal'.",
      });
    }

    // --- LÓGICA DE VERIFICAÇÃO DE CONSISTÊNCIA ---
    // 3. Somar todas as movimentações daquele caixa
    const movimentacoesDoCaixa = await Movimentacao.find({
      caixaId: caixa._id,
    });
    const somaMovimentacoes = movimentacoesDoCaixa.reduce(
      (acc, mov) => acc + mov.valor,
      0
    );

    // 4. Comparar a soma das movimentações com o saldo salvo na tabela Caixas
    const tolerancia = 0.001; // Ex: R$ 0,001 de diferença é aceitável

    console.log(
      `\n--- VERIFICAÇÃO DE SALDO PARA CAIXA: "${caixa.nome}" (ID: ${caixa._id}) ---`
    );
    console.log(`Saldo registrado no caixa: ${caixa.saldo.toFixed(2)}`);
    console.log(`Soma das movimentações: ${somaMovimentacoes.toFixed(2)}`);

    if (Math.abs(somaMovimentacoes - caixa.saldo) > tolerancia) {
      console.warn(
        `[INCONSISTÊNCIA DETECTADA] Diferença: ${(
          somaMovimentacoes - caixa.saldo
        ).toFixed(2)}`
      );
      return res.status(409).json({
        message:
          "Inconsistência de saldo detectada! A soma das movimentações não corresponde ao saldo registrado no caixa. Por favor, verifique e corrija antes de prosseguir.",
        detalhes: {
          saldoCalculado: somaMovimentacoes.toFixed(2),
          saldoRegistrado: caixa.saldo.toFixed(2),
          diferenca: (somaMovimentacoes - caixa.saldo).toFixed(2),
        },
      });
    } else {
      console.log(
        "[CONSISTENTE] Saldo do caixa e soma das movimentações são consistentes."
      );

      // Se o saldo já for zero, não faz sentido criar uma movimentação de "Saldo Anterior"
      // e nem excluir outras, pois não há o que excluir ou registrar.
      if (caixa.saldo === 0) {
        console.log(
          `Caixa "${caixa.nome}" já tem saldo zero. Nenhuma movimentação de Saldo Anterior criada e nenhuma movimentação excluída.`
        );
        return res.status(200).json({
          message: `Caixa "${caixa.nome}" já tem saldo zero. Nenhuma ação necessária.`,
          caixaAtualizado: {
            id: caixa._id,
            nome: caixa.nome,
            saldoAtual: caixa.saldo,
          },
        });
      }

      // --- LÓGICA PRINCIPAL: CRIAR MOVIMENTAÇÃO DE SALDO ANTERIOR E EXCLUIR AS DEMAIS ---

      // Guarda o saldo atual para a nova movimentação de "Saldo Anterior"
      const saldoAnteriorValue = caixa.saldo;

      // 5. Criar a nova movimentação de "Saldo Anterior"
      const novaMovimentacao = new Movimentacao({
        descricao: `Saldo Anterior - ${caixa.nome}`,
        valor: saldoAnteriorValue,
        categoria: "Saldo Anterior",
        caixaId: caixa._id,
        data: new Date(),
      });

      await novaMovimentacao.save(); // Salva a nova movimentação

      // 6. Excluir todas as outras movimentações deste caixa, exceto a recém-criada
      const resultadoExclusao = await Movimentacao.deleteMany({
        caixaId: caixa._id,
        _id: { $ne: novaMovimentacao._id }, // Exclui todas, exceto a nova movimentação
      });

      // IMPORTANTE: O saldo do caixa na tabela 'Caixa' permanece inalterado,
      // pois a movimentação de "Saldo Anterior" já reflete esse valor.
      // Não é necessário chamar caixa.save() aqui.

      console.log(
        `Movimentação de "Saldo Anterior" criada para o caixa "${
          caixa.nome
        }" com valor ${saldoAnteriorValue.toFixed(2)}.`
      );
      console.log(
        `Foram excluídas ${resultadoExclusao.deletedCount} movimentações antigas do caixa "${caixa.nome}".`
      );
      console.log(`Saldo do caixa "${caixa.nome}" permaneceu inalterado.`);

      return res.status(200).json({
        message: `Operação de "Saldo Anterior" concluída para o caixa "${caixa.nome}". Movimentação criada e ${resultadoExclusao.deletedCount} movimentações antigas excluídas. Saldo do caixa permaneceu inalterado.`,
        movimentacaoCriada: {
          id: novaMovimentacao._id,
          descricao: novaMovimentacao.descricao,
          valor: novaMovimentacao.valor,
          categoria: novaMovimentacao.categoria,
          caixa: novaMovimentacao.caixaId,
        },
        caixaAtualizado: {
          id: caixa._id,
          nome: caixa.nome,
          saldoAtual: caixa.saldo, // Retorna o saldo atual, que não foi zerado
        },
        movimentacoesExcluidasCount: resultadoExclusao.deletedCount,
      });
    }
  } catch (error) {
    console.error("Erro durante a operação de Saldo Anterior:", error);
    res.status(500).json({
      message: "Erro durante a operação de Saldo Anterior",
      error: error.message,
    });
  }
};

// Exportamos a função com um nome mais descritivo
export { resetCaixaSecundario };
