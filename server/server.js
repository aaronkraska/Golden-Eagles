import dotenv from "dotenv";
import { createStore } from "./store.js";
import { createApp } from "./app.js";
// Resolve the environment file relative to this module, regardless of the launch directory.
dotenv.config({ path: new URL("./.env", import.meta.url), quiet: true });
// The long-running server shares one SQLite connection across API requests.
const store = createStore();
const server = createApp(store).listen(
  Number(process.env.PORT) || 3001,
  process.env.HOST || "0.0.0.0",
  () =>
    console.log(
      `AI Opportunity Finder API: http://127.0.0.1:${process.env.PORT || 3001}`,
    ),
);
// Stop accepting requests before closing the database on an interactive shutdown.
process.on("SIGINT", () =>
  server.close(() => {
    store.close();
    process.exit(0);
  }),
);
