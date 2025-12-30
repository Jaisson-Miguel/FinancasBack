import Adicional from "../models/Adicional.js";

export default {
  // --- 1. CRIAR (Store) ---
  async store(req, res) {
    try {
      const { chave, valor, conteudo, grupo } = req.body;

      // Validação básica
      if (!chave) {
        return res
          .status(400)
          .json({ error: "O campo 'chave' é obrigatório." });
      }

      // Verifica se já existe (opcional, para evitar duplicidade no mesmo grupo)
      const existe = await Adicional.findOne({
        chave,
        grupo: grupo || "geral",
      });
      if (existe) {
        return res
          .status(400)
          .json({ error: "Já existe um registro com essa chave neste grupo." });
      }

      const novoAdicional = await Adicional.create({
        chave,
        valor,
        conteudo,
        grupo,
      });

      return res.status(201).json(novoAdicional);
    } catch (error) {
      console.error("Erro ao criar adicional:", error);
      return res.status(500).json({ error: "Erro interno ao salvar." });
    }
  },

  // --- 2. LISTAR TUDO (Index) ---
  // Aceita filtro por grupo na URL: /adicionais?grupo=DivisaoPrincipal
  async index(req, res) {
    try {
      const { grupo } = req.query;
      const filtro = grupo ? { grupo } : {};

      const adicionais = await Adicional.find(filtro).sort({ createdAt: -1 });

      return res.json(adicionais);
    } catch (error) {
      console.error("Erro ao listar adicionais:", error);
      return res.status(500).json({ error: "Erro interno ao listar." });
    }
  },

  // --- 3. BUSCAR POR ID (Show) ---
  async show(req, res) {
    try {
      const { id } = req.params;
      const adicional = await Adicional.findById(id);

      if (!adicional) {
        return res.status(404).json({ error: "Registro não encontrado." });
      }

      return res.json(adicional);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao buscar registro." });
    }
  },

  // --- 4. BUSCAR POR CHAVE (Auxiliar) ---
  // Útil para pegar um valor específico sem saber o ID
  // Ex: GET /adicionais/busca?chave=SaldoLadoA
  async buscarPorChave(req, res) {
    try {
      const { chave, grupo } = req.query;

      if (!chave) {
        return res.status(400).json({ error: "Informe a chave para busca." });
      }

      const filtro = { chave };
      if (grupo) filtro.grupo = grupo;

      const adicional = await Adicional.findOne(filtro);

      if (!adicional) {
        return res.status(404).json({ error: "Chave não encontrada." });
      }

      return res.json(adicional);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao buscar por chave." });
    }
  },

  // --- 5. ATUALIZAR (Update) ---
  async update(req, res) {
    try {
      const { id } = req.params;
      const { chave, valor, conteudo, grupo } = req.body;

      const atualizado = await Adicional.findByIdAndUpdate(
        id,
        { chave, valor, conteudo, grupo },
        { new: true } // Retorna o objeto já atualizado
      );

      if (!atualizado) {
        return res.status(404).json({ error: "Registro não encontrado." });
      }

      return res.json(atualizado);
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      return res.status(500).json({ error: "Erro interno ao atualizar." });
    }
  },

  // --- 6. DELETAR (Destroy) ---
  async destroy(req, res) {
    try {
      const { id } = req.params;

      const removido = await Adicional.findByIdAndDelete(id);

      if (!removido) {
        return res.status(404).json({ error: "Registro não encontrado." });
      }

      return res.json({ message: "Registro removido com sucesso." });
    } catch (error) {
      console.error("Erro ao deletar:", error);
      return res.status(500).json({ error: "Erro interno ao deletar." });
    }
  },
};
