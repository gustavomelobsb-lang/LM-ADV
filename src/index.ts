import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import auth from "./routes/auth";
import usuarios from "./routes/usuarios";
import teses from "./routes/teses";
import clientes from "./routes/clientes";
import casos from "./routes/casos";
import peticoes from "./routes/peticoes";
import jurimetria from "./routes/jurimetria";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

app.route("/api/auth", auth);
app.route("/api/usuarios", usuarios);
app.route("/api/teses", teses);
app.route("/api/clientes", clientes);
app.route("/api/casos", casos);
app.route("/api/peticoes", peticoes);
app.route("/api/jurimetria", jurimetria);

app.get("/api/health", (c) => c.json({ ok: true, app: c.env.APP_NAME }));

app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ erro: "Rota nao encontrada" }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
