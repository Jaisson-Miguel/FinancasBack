import mongoose from "mongoose";

export async function conectarMongo() {
  try {
    const uri =
      "mongodb+srv://admin:admin@cluster0.rft6qs2.mongodb.net/?appName=Cluster0";
    // se for Mongo Atlas, você cola a string aqui

    await mongoose.connect(uri);

    console.log("🟢 Conectado ao MongoDB com sucesso!");
  } catch (error) {
    console.log("🔴 Erro ao conectar no MongoDB:", error);
  }
}
