import dotenv from "dotenv";
import { createStore } from "./store.js";
import { createApp } from "./app.js";
dotenv.config({ path: new URL("./.env", import.meta.url), quiet: true });
const store = createStore();
const server = createApp(store).listen(
  Number(process.env.PORT) || 3001,
  process.env.HOST || "0.0.0.0",
  () =>
    console.log(
      `AI Opportunity Finder API: http://127.0.0.1:${process.env.PORT || 3001}`,
    ),
);
process.on("SIGINT", () =>
  server.close(() => {
    store.close();
    process.exit(0);
  }),
);
