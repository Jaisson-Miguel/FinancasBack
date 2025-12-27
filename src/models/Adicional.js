import mongoose from "mongoose";

const AdicionalSchema = new mongoose.Schema(
  {
    // A "chave" é o nome do dado (ex: "SaldoLadoA", "MetaViagem", "LembretePagamento")
    chave: {
      type: String,
      required: true,
      trim: true,
      index: true, // Cria um índice para busca rápida
    },

    // Se o objetivo for guardar um número (ex: valor separado do caixa)
    valor: {
      type: Number,
      default: 0,
    },

    // Se o objetivo for guardar texto (ex: uma anotação ou JSON stringificado)
    conteudo: {
      type: String,
      default: "",
    },

    // Opcional: Para agrupar vários dados (ex: "Configuracoes", "DivisaoPrincipal")
    grupo: {
      type: String,
      default: "geral",
    },
  },
  {
    timestamps: true, // Cria createdAt e updatedAt automaticamente
  }
);

export default mongoose.model("Adicional", AdicionalSchema);
