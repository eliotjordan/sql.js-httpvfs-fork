import { createDbWorker } from "sql.js-httpvfs";

const workerUrl = new URL(
  "../../dist/sqlite.worker.js",
  import.meta.url
);
const wasmUrl = new URL("../../dist/sql-wasm.wasm", import.meta.url);

async function load() {
  const worker = await createDbWorker(
    [
      {
        from: "inline",
        config: {
          serverMode: "full",
          // url: "/example.sqlite3",
          url: "https://phiresky.github.io/world-development-indicators-sqlite/split-db/config.json",
          requestChunkSize: 4096,
        },
      },
    ],
    workerUrl.toString(),
    wasmUrl.toString()
  );

  const result = await worker.db.query("select * from wdi_country");

  document.body.textContent = JSON.stringify(result);
}

load();
