const runtimeUrl = (
  process.env.INSIGHT_BOT_RUNTIME_URL ??
  "https://gestaltview-three.vercel.app"
).replace(/\/+$/, "");

async function probe(path, init, expected) {
  const response = await fetch(`${runtimeUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.text();
  const passed = expected.includes(response.status);
  console.log(`${passed ? "PASS" : "FAIL"} ${path} HTTP ${response.status}`);
  if (!passed) {
    console.log(body.slice(0, 300));
    process.exitCode = 1;
  }
}

await probe("/api/actions/health", { method: "GET" }, [200]);
await probe("/api/insight-bot/respond", { method: "GET" }, [405]);
await probe("/api/insight-bot/execute", { method: "GET" }, [405]);
