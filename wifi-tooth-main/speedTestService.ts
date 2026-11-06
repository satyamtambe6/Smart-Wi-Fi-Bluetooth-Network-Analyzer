const DOWNLOAD_URL = "https://speed.cloudflare.com/__down";
const UPLOAD_URL = "https://speed.cloudflare.com/__up";

export async function runSpeedTest() {
  // 1. Measure ping
  const pingStart = Date.now();

  const pingResponse = await fetch(
    `${DOWNLOAD_URL}?bytes=0&cache=${Date.now()}`
  );

  if (!pingResponse.ok) {
    throw new Error("Ping test failed.");
  }

  const ping = Date.now() - pingStart;

  // 2. Measure download speed
  const downloadBytes = 5 * 1024 * 1024;
  const downloadStart = Date.now();

  const downloadResponse = await fetch(
    `${DOWNLOAD_URL}?bytes=${downloadBytes}&cache=${Date.now()}`
  );

  if (!downloadResponse.ok) {
    throw new Error("Download test failed.");
  }

  const downloadData = await downloadResponse.arrayBuffer();
  const downloadTime = (Date.now() - downloadStart) / 1000;

  const downloadMbps =
    (downloadData.byteLength * 8) / downloadTime / 1_000_000;

  // 3. Measure upload speed
  const uploadBytes = 2 * 1024 * 1024;
  const uploadData = new Uint8Array(uploadBytes);
  const uploadStart = Date.now();

  const uploadResponse = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: uploadData as any,
  });

  if (!uploadResponse.ok) {
    throw new Error("Upload test failed.");
  }

  const uploadTime = (Date.now() - uploadStart) / 1000;

  const uploadMbps =
    (uploadBytes * 8) / uploadTime / 1_000_000;

  return {
    ping,
    downloadMbps: Number(downloadMbps.toFixed(2)),
    uploadMbps: Number(uploadMbps.toFixed(2)),
  };
}
