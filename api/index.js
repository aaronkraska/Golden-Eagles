import { createStore } from "../server/store.js";
import { createApp } from "../server/app.js";

// Legacy serverless entrypoint: Vercel supplies writable temporary storage.
// Export the Express handler without opening a listening socket.
const store = createStore(process.env.VERCEL ? "/tmp/analyses.sqlite" : undefined);
const app = createApp(store);

export default app;