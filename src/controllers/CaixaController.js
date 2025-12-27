import Caixa from "../models/Caixa.js";

export default {
  // Cria uma nova caixa
  async store(req, res) {
    try {
      const { nome, descricao } = req.body;

      if (!nome) {
        return res.status(400).json({ error: "O nome da caixa é obrigatório" });
      }

      const caixa = await Caixa.create({
        nome,
        descricao,
        saldo: 0, // Garante que inicia com 0 se não for passado
      });

      return res.json(caixa);
    } catch (error) {
      console.error("Erro ao criar caixa:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  },

  // Lista todas as caixas
  async index(req, res) {
    try {
      const caixas = await Caixa.find();
      return res.json(caixas);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao buscar caixas" });
    }
  },

  // Busca uma caixa específica pelo ID (Necessário para o PainelPrincipal)
  async show(req, res) {
    try {
      const { id } = req.params;

      const caixa = await Caixa.findById(id);

      if (!caixa) {
        return res.status(404).json({ error: "Caixa não encontrada" });
      }

      return res.json(caixa);
    } catch (error) {
      console.error("Erro ao buscar caixa específica:", error);
      return res
        .status(500)
        .json({ error: "Erro ao buscar detalhes da caixa" });
    }
  },
};
