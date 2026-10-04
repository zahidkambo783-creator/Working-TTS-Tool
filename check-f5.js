
import { client } from "@gradio/client";

async function run() {
  const app = await client("mrfakename/E2-F5-TTS");
  console.log(JSON.stringify(await app.view_api(), null, 2));
}
run();

