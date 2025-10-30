import express, {
  NextFunction,
  Request,
  Response as ExpressResponse,
} from "express";
import { promises as fs } from "node:fs";
import path from "node:path";

const VALIDATION_URL = "https://schoolbaseapp.com/validate-name";
const USERS_PATH = path.resolve(__dirname, "../data/users.json");

const UNICODE_APOSTROPHES = /[\u2018\u2019\u02BC\u2032\u2035]/g; // ‘ ’ ʼ ′ ‵

function normalizeName(input: string): string {
    let s = input.normalize("NFC");

    // 1) Unify apostrophes
    s = s.replace(UNICODE_APOSTROPHES, "'");

    // 2) Strip diacritics (é → e, ñ → n, á → a, etc.)
    // Decompose to base + marks, then remove combining marks.
    s = s.normalize("NFKD").replace(/\p{M}+/gu, "");

    // 3) Remove any non-ASCII letters/apostrophes/spaces (validator seems strict)
    s = s.replace(/[^A-Za-z' ]+/g, " ");

    // 4) Normalize all Unicode separators to space, collapse, and trim
    s = s.replace(/\p{Separator}+/gu, " ");
    s = s.replace(/\s+/g, " ").trim();

    return s;
}

const app = express();

app.get("/health", (_req: Request, res: ExpressResponse) => {
  res.json({ status: "ok" });
});

app.get(
  "/api/validate-users",
  async (_req: Request, res: ExpressResponse, next: NextFunction) => {
    try {
      const users = await loadUsers();

      for (const name of users) {
        await validateUser(name);
      }

      res.json({ validated: users.length });
    } catch (error) {
      next(error);
    }
  },
);

app.use(
  (
    error: unknown,
    _req: Request,
    res: ExpressResponse,
    _next: NextFunction,
  ) => {
    if (res.headersSent) {
      return;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while validating user names.";

    res.status(500).json({ error: message });
  },
);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

type RemoteResponse = {
  message?: string;
  name?: string;
};

async function loadUsers(): Promise<string[]> {
  const raw = await fs.readFile(USERS_PATH, "utf8");
  return JSON.parse(raw) as string[];
}

async function validateUser(name: string): Promise<void> {
    const normalized = normalizeName(name);
    const url = `${VALIDATION_URL}?name=${encodeURIComponent(normalized)}`;

    let response: Response;

    try {
        response = await fetch(url);
    } catch (_error) {
        console.error(`${normalized} - Failed to reach validation service.`);
        process.exit(1);
    }

    const message = await extractMessage(response);

    if (response.status !== 200) {
        console.error(`${normalized} - ${message}`);
        process.exit(1);
    }

    console.log(`${normalized} - ${message}`);
}


async function extractMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as RemoteResponse;
    if (typeof payload?.message === "string") {
      return payload.message;
    }
  } catch (_error) {
    // Ignore JSON parse errors, they are handled below.
  }

  return `Received status ${response.status}`;
}

export {};
