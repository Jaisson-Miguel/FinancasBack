import mongoose from "mongoose";

const ContaSchema = new mongoose.Schema(
  {
    instituicao: {
      type: String,
      required: true, // Obrigatório para garantir o controle
    },
    descricao: {
      type: String,
      required: true,
    },
    observacao: {
      type: String,
      default: "",
    },
    valor: {
      type: Number,
      required: true,
    },
    dataVencimento: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pendente", "pago", "atrasado"],
      default: "pendente",
    },
    // Campos opcionais para quando for paga
    dataPagamento: {
      type: Date,
    },
    caixaPagamento: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Caixa",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Conta", ContaSchema);
