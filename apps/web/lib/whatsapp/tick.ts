import { advanceTimedOutEmergencies } from "@/lib/whatsapp/emergency";
import { remindStaleHostQuestions } from "@/lib/whatsapp/host-relay";
import { syncProvidersFromSheet } from "@/lib/whatsapp/providers-sheet";
import { runStayMessages } from "@/lib/whatsapp/stay-messages";

const SHEET_SYNC_MS = 6 * 60 * 60 * 1000;
let lastSheetSync = 0;

async function safely<T>(label: string, job: () => Promise<T>) {
  try {
    return await job();
  } catch (error) {
    console.error(`[whatsapp-tick] ${label} failed`, error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function runWhatsappTick(now = new Date()) {
  const providers =
    now.getTime() - lastSheetSync > SHEET_SYNC_MS
      ? await safely("providers sheet", async () => {
          const result = await syncProvidersFromSheet();
          lastSheetSync = now.getTime();
          return result;
        })
      : { skipped: true };
  return {
    providers,
    stay: await safely("stay messages", () => runStayMessages(now)),
    emergencies: await safely("emergencies", () => advanceTimedOutEmergencies(now)),
    hostReminders: await safely("host reminders", () => remindStaleHostQuestions(now)),
  };
}
