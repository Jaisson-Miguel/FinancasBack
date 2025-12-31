import { Router } from "express";
import CaixaController from "./controllers/CaixaController.js";
import MovimentacaoController from "./controllers/MovimentacaoController.js";
import ContaController from "./controllers/ContaController.js";
import ExtratoController from "./controllers/ExtratoController.js";
import { generatePdfReport } from "./controllers/RelatorioController.js";
import AdicionalController from "./controllers/AdicionalController.js";
import { resetCaixaSecundario } from "./controllers/ResetController.js";
import {
  VerificarIntegridadePrincipal,
  CreateResetMovimentacoes,
} from "./controllers/ResetPController.js";

const routes = Router();

// --- Rotas de Caixas ---
routes.post("/caixas", CaixaController.store);
routes.get("/caixas", CaixaController.index);
routes.get("/caixas/:id", CaixaController.show);

// --- Rotas de Movimentações (CRUD) ---
routes.post("/movimentacoes", MovimentacaoController.store);
routes.put("/movimentacoes/:id", MovimentacaoController.update);
routes.delete("/movimentacoes/:id", MovimentacaoController.delete);

// --- Rotas de Extrato (LEITURA / VISUALIZAÇÃO) ---
routes.get("/extrato", ExtratoController.index);
routes.get("/extrato/resumo", ExtratoController.resumo); // Rota do resumo do painel
routes.get("/extrato/categorias", ExtratoController.relatorioCategorias);
routes.get("/extrato/:caixaId", ExtratoController.porCaixa);

// --- Rotas de Contas a Pagar ---
routes.post("/contas", ContaController.store);
routes.get("/contas", ContaController.index);
routes.delete("/contas/:id", ContaController.delete);
routes.put("/contas/:id", ContaController.update);
routes.post("/contas/:id/pagar", ContaController.pagar);

// --- Rotas de Adicionais ---
routes.get("/adicionais", AdicionalController.index);
routes.post("/adicionais", AdicionalController.store);
routes.get("/adicionais/:id", AdicionalController.show);
routes.put("/adicionais/:id", AdicionalController.update);
routes.delete("/adicionais/:id", AdicionalController.destroy);
routes.get("/adicionais/busca", AdicionalController.buscarPorChave);

// Geração do Relatório PDF
routes.get("/relatorio-pdf", generatePdfReport);

//Reseta o Mês
routes.post("/caixas/:id/reset", resetCaixaSecundario);

// Rota para VERIFICAR a integridade do Caixa Principal
routes.get("/principal/verificar-integridade", VerificarIntegridadePrincipal); // Nova rota para a verificação

// Rota para CRIAR as movimentações de ajuste do Caixa Principal (após confirmação)
routes.post("/principal/criar-movimentacoes-ajuste", CreateResetMovimentacoes); // Nova rota para a criação

export default routes;
