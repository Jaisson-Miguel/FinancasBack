import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // Carrega as variáveis do .env

export async function conectarMongo() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    console.log("🟢 Conectado ao MongoDB com sucesso!");
  } catch (error) {
    console.log("🔴 Erro ao conectar no MongoDB:", error);
  }
}
