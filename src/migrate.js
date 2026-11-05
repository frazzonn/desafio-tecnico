import fs from "node:fs";
import pg from "pg";

const sql = fs.readFileSync("migrations/001_init.sql", "utf8");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(sql);
await client.end();

console.log("Tabelas criadas.");
