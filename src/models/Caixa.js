import mongoose from "mongoose";

const CaixaSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
    },
    saldo: {
      type: Number,
      default: 0,
    },
    descricao: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Caixa", CaixaSchema);
