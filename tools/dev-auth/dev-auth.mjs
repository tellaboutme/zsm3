import { sign, createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY_DIR = join(REPO_ROOT, "apps/web/.wrangler/dev-auth");
const KEY_FILE = "es256-private.pem";
const JWKS_PATH = "/cdn-cgi/access/certs";
const HOST = "127.0.0.1";
const PORT = 8799;
const AUDIENCE = "zsm3-dev";
const EMAIL = "dev@zsm3.local";
const TTL_SECONDS = 12 * 60 * 60;

const USAGE = [
  "zsm3 local panel access bridge",
  "",
  "  node tools/dev-auth/dev-auth.mjs          serve JWKS and mint a token (default)",
  "  node tools/dev-auth/dev-auth.mjs mint     mint a token only",
  "  node tools/dev-auth/dev-auth.mjs reset    drop the stored key, serve and mint",
  "",
  `identity : ${EMAIL} (role admin, seeded locally)`,
  `audience : ${AUDIENCE}`,
  `jwks url : http://${HOST}:${String(PORT)}${JWKS_PATH}`,
  `key file : ${KEY_DIR}/${KEY_FILE}`,
].join("\n");

function loadOrCreateKey(reset) {
  const keyPath = join(KEY_DIR, KEY_FILE);
  let stored;
  if (reset) {
    rmSync(keyPath, { force: true });
  }
  try {
    stored = readFileSync(keyPath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code !== "ENOENT") {
      throw error;
    }
  }
  if (stored === undefined) {
    mkdirSync(KEY_DIR, { recursive: true });
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" });
    try {
      writeFileSync(keyPath, pem, { mode: 0o600, flag: "wx" });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") {
        return readFileSync(keyPath);
      }
      throw error;
    }
    return pem;
  }
  return stored;
}

function publicJwk(privatePem) {
  const { kty, crv, x, y } = createPublicKey(privatePem).export({ format: "jwk" });
  return { kty, crv, x, y };
}

function keyId(jwk) {
  const thumbprint = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return createHash("sha256").update(thumbprint).digest("base64url");
}

function mintToken(privatePem, kid) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid, typ: "JWT" })).toString(
    "base64url",
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      email: EMAIL,
      iss: `http://${HOST}:${String(PORT)}`,
      aud: AUDIENCE,
      iat: now,
      nbf: now,
      exp: now + TTL_SECONDS,
    }),
  ).toString("base64url");
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: privatePem,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function printMinted(privatePem, kid) {
  const token = mintToken(privatePem, kid);
  process.stdout.write(
    [
      "local access token (12 h):",
      `  ${EMAIL} @ ${AUDIENCE}`,
      "",
      "paste into the browser console on any /panel page:",
      `  sessionStorage.setItem("panel-dev-token","${token}")`,
    ].join("\n") + "\n",
  );
}

function serveJwks(privatePem, kid) {
  const jwks = JSON.stringify({ keys: [{ ...publicJwk(privatePem), kid, alg: "ES256", use: "sig" }] });
  const server = createServer((request, response) => {
    const target = new URL(request.url ?? "/", `http://${HOST}:${String(PORT)}`);
    if (target.pathname !== JWKS_PATH) {
      response.writeHead(404, { "Content-Length": "0" });
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "application/jwk-set+json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(jwks);
  });
  return new Promise((listenReady, listenFailed) => {
    server.once("error", (error) => {
      listenFailed(error);
    });
    server.listen(PORT, HOST, () => {
      listenReady(server);
    });
  });
}

function addressInUse(error) {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "EADDRINUSE"
  );
}

const COMMANDS = ["mint", "reset"];
const command = process.argv[2];
if (command === "--help" || command === "-h") {
  process.stdout.write(`${USAGE}\n`);
} else if (command !== undefined && !COMMANDS.includes(command)) {
  process.stdout.write(`${USAGE}\n`);
  process.exitCode = 64;
} else {
  const privatePem = loadOrCreateKey(command === "reset");
  const kid = keyId(publicJwk(privatePem));
  if (command !== "mint") {
    try {
      await serveJwks(privatePem, kid);
      process.stdout.write(`jwks: http://${HOST}:${String(PORT)}${JWKS_PATH} (kid ${kid})\n`);
    } catch (error) {
      if (!addressInUse(error)) {
        throw error;
      }
      process.stdout.write(`jwks: port ${String(PORT)} already serving (kid ${kid})\n`);
    }
  }
  printMinted(privatePem, kid);
}
