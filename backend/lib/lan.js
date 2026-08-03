/** IPv4 privadas: WiFi, hotspot, red local, etc. */
const PRIVATE_IPV4 =
  /^(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

/** Origen del frontend en la misma red (localhost o IP privada + puerto). */
export function isLanOrigin(origin, frontendPort = "8080") {
  try {
    const url = new URL(origin);
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    if (port !== frontendPort) return false;
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    return PRIVATE_IPV4.test(host);
  } catch {
    return false;
  }
}
