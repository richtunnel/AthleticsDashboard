/**
 * Bull Board dashboard — local dev only.
 * Run: yarn bull-board
 * Opens: http://localhost:3001/queues
 */

import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { allQueues } from "../lib/queue/queues";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/queues");

createBullBoard({
  queues: Object.entries(allQueues).map(([, queue]) => new BullMQAdapter(queue)),
  serverAdapter,
});

const app = express();
app.use("/queues", serverAdapter.getRouter());

app.get("/", (_, res) => res.redirect("/queues"));

const PORT = process.env.BULL_BOARD_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Bull Board running at http://localhost:${PORT}/queues`);
});
