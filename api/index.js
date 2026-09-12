import { createStore } from "../server/store.js";
import { createApp } from "../server/app.js";

const store = createStore(process.env.VERCEL ? "/tmp/analyses.sqlite" : undefined);
const app = createApp(store);

export default app;