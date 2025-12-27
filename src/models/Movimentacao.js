import mongoose from "mongoose";

const MovimentacaoSchema = new mongoose.Schema({
  descricao: {
    type: String,
    required: true,
  },
  valor: {
    type: Number,
    required: true,
  },
  // --- NOVO CAMPO ---
  categoria: {
    type: String,
    default: "Outros", // Se não informar, salva como "Outros"
  },
  caixaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Caixa", // Relaciona com a tabela de Caixas
    required: true,
  },
  data: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Movimentacao", MovimentacaoSchema);
