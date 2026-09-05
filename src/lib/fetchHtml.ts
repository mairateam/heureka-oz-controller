import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const STATUS_MARKER = "<<<HTTP_STATUS:";

/**
 * Heureka je za Cloudflare, ktery odmita požadavky z Node.js runtime
 * (`fetch` dostane 403 s hlavickou cf-mitigated: challenge) bez ohledu
 * na hlavicky. Systemovy curl projde, takze ho pouzivame jako transport.
 *
 * Hlasime se pravdivym User-Agentem s kontaktem, at je z logu Heureky poznat,
 * kdo data stahuje; default jde prepsat promennou SCRAPER_USER_AGENT.
 */
export const DEFAULT_USER_AGENT =
  "MAIRA-HeurekaMonitor/1.0 (+https://mairateam.com; kontakt: ondrej.wicherek@mairateam.com)";

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface FetchResult {
  status: number;
  body: string;
}

/**
 * Na Vercelu curl neni. Widget endpointy za Cloudflare nejsou, takze tam
 * staci bezny fetch; profil obchodu odtud stejne neprojde (403), at uz
 * requestem posle kdokoli.
 */
let curlChybi = false;

async function pressFetch(
  url: string,
  headers: Record<string, string>,
): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: { "User-Agent": process.env.SCRAPER_USER_AGENT || DEFAULT_USER_AGENT, ...headers },
    redirect: "follow",
    cache: "no-store",
  });
  return { status: response.status, body: await response.text() };
}

export async function fetchHtml(
  url: string,
  headers: Record<string, string> = {},
): Promise<FetchResult> {
  if (curlChybi) return pressFetch(url, headers);

  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--compressed",
    "--max-time",
    "30",
    "--user-agent",
    process.env.SCRAPER_USER_AGENT || DEFAULT_USER_AGENT,
    "--write-out",
    `
${STATUS_MARKER}%{http_code}>>>`,
  ];

  for (const [name, value] of Object.entries(headers)) {
    args.push("--header", `${name}: ${value}`);
  }
  args.push(url);

  let stdout: string;
  try {
    // execFile bez shellu — URL se nikdy neinterpretuje shellem.
    ({ stdout } = await run("curl", args, { maxBuffer: 32 * 1024 * 1024 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/.test(message)) {
      curlChybi = true;
      return pressFetch(url, headers);
    }
    throw new FetchError(`Stazeni stranky selhalo: ${message}`);
  }

  const markerAt = stdout.lastIndexOf(STATUS_MARKER);
  if (markerAt === -1) {
    throw new FetchError("Odpoved z Heureky se nepodarilo precist.");
  }

  const status = Number.parseInt(stdout.slice(markerAt + STATUS_MARKER.length), 10);
  // Pred markerem je jeste newline, ktery jsme si sami pridali.
  return { status, body: stdout.slice(0, Math.max(0, markerAt - 1)) };
}
