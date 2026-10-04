async function check() {
  const urls = [
    "https://mrfakename-e2-f5-tts.hf.space/info",
    "https://myshell-ai-openvoice.hf.space/info",
    "https://coqui-xtts.hf.space/info"
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log(`\n--- ${url} ---`);
      console.log(JSON.stringify(data.named_endpoints, null, 2).slice(0, 500) + '...');
    } catch (e) {
      console.log(url, e.message);
    }
  }
}
check();
