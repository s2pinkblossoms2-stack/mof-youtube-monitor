// OpenAI 호출 (서버 전용). 키가 담긴 요청 내용은 오류 메시지에 넣지 않는다.
import { requireEnv } from "../env";

// 이 서비스에서 쓰는 모델 (환경변수 OPENAI_MODEL로 바꿀 수 있다)
const DEFAULT_MODEL = "gpt-4.1-mini";

export class OpenAiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`OpenAI 오류 (상태 ${status})`);
    this.name = "OpenAiError";
    this.status = status;
  }
}

// JSON 형식을 지정해 한 번 묻고, 결과 JSON을 돌려준다.
export async function askJson(opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
        },
      }),
      cache: "no-store",
    });
  } catch {
    throw new OpenAiError(0);
  }
  if (!res.ok) throw new OpenAiError(res.status);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new OpenAiError(502);
  try {
    return JSON.parse(content);
  } catch {
    throw new OpenAiError(502);
  }
}
