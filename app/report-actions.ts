"use server";

import { revalidatePath } from "next/cache";
import { isLoggedIn } from "@/lib/auth";
import { REPORT_SLOTS } from "@/lib/constants";
import { clearManualCount, saveManualCount } from "@/lib/db/channel";
import type { ReportSlot } from "@/lib/types";

export type EditState = { ok: boolean; message: string };

const MAX_COUNT = 2_000_000_000;

// 서버 동작은 누구든 부를 수 있는 주소이므로 입력을 먼저 검사한다 (로그인은 proxy.ts가 확인한다)
function parseTarget(formData: FormData): { date: string; slot: ReportSlot } | null {
  const date = formData.get("date");
  const slot = formData.get("slot");
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof slot !== "string" || !(REPORT_SLOTS as readonly string[]).includes(slot)) return null;
  return { date, slot: slot as ReportSlot };
}

// 관리자가 구독자 수를 고친다. 자동 수집한 원래 값은 그대로 두고 고친 값과 고친 사람 이름을 따로 남긴다.
export async function saveSubscriberCount(_prev: EditState, formData: FormData): Promise<EditState> {
  if (!(await isLoggedIn())) return { ok: false, message: "로그인이 필요합니다." };
  const target = parseTarget(formData);
  if (!target) return { ok: false, message: "잘못된 요청입니다." };

  const name = formData.get("name");
  const raw = formData.get("count");
  const by = typeof name === "string" ? name.trim() : "";
  if (by.length === 0 || by.length > 30) return { ok: false, message: "고치는 사람 이름을 30자 이내로 입력해 주세요." };
  const text = typeof raw === "string" ? raw.replace(/[,\s]/g, "") : "";
  if (!/^\d{1,10}$/.test(text)) return { ok: false, message: "구독자 수는 0 이상의 숫자로 입력해 주세요." };
  const count = Number(text);
  if (count > MAX_COUNT) return { ok: false, message: "구독자 수가 너무 큽니다." };

  try {
    await saveManualCount(target.date, target.slot, count, by, new Date());
  } catch (error) {
    console.error("구독자 수 수정 오류:", error instanceof Error ? error.message : error);
    return { ok: false, message: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  revalidatePath("/report");
  return { ok: true, message: "고친 값을 저장했습니다." };
}

// 고친 값을 지워 자동 수집한 값으로 되돌린다
export async function resetSubscriberCount(_prev: EditState, formData: FormData): Promise<EditState> {
  if (!(await isLoggedIn())) return { ok: false, message: "로그인이 필요합니다." };
  const target = parseTarget(formData);
  if (!target) return { ok: false, message: "잘못된 요청입니다." };
  try {
    await clearManualCount(target.date, target.slot);
  } catch (error) {
    console.error("구독자 수 수정 취소 오류:", error instanceof Error ? error.message : error);
    return { ok: false, message: "되돌리지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  revalidatePath("/report");
  return { ok: true, message: "자동 수집한 값으로 되돌렸습니다." };
}
