import express from "express";
import cors from "cors";
import { conectarMongo } from "./database/conn.js";
import routes from "./src/routes.js"; // Importando as rotas

const app = express();

app.use(cors());
app.use(express.json());

// conectar banco
conectarMongo();

// Usar as rotas
app.use(routes);

app.listen(3333, () => {
  console.log("Servidor rodando na porta 3333...");
});
