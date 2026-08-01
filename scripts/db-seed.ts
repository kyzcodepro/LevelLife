import "dotenv/config";
import { db } from "@/db";
import { runSeed } from "@/db/seed";

runSeed(db)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
