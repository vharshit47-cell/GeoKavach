import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { EmergencyInput, EmergencyReceipt, DeliveryState } from "../../shared/types/emergency";
import { RequestError } from "./request-guard";

// Store only hashes and delivery states; distress messages and coordinates are not persisted.
export class EmergencyStore {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS emergency_receipts(id TEXT PRIMARY KEY, hash TEXT NOT NULL, email TEXT NOT NULL, sms TEXT NOT NULL, created INTEGER NOT NULL)");
  }
  close() { this.db.close(); }
  async submit(input: EmergencyInput, enabled: { email: boolean; sms: boolean }, dispatch: (channel: "email" | "sms") => Promise<DeliveryState>): Promise<EmergencyReceipt> {
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    this.db.prepare("DELETE FROM emergency_receipts WHERE created < ?").run(Date.now() - 7 * 86400000);
    // Claim before external calls. A concurrent request or crash must never send a duplicate SMS.
    const result = this.db.prepare("INSERT OR IGNORE INTO emergency_receipts VALUES(?,?,?,?,?)").run(input.requestId, hash, enabled.email ? "unknown" : "not-configured", enabled.sms ? "unknown" : "not-configured", Date.now());
    const read = () => this.db.prepare("SELECT * FROM emergency_receipts WHERE id=?").get(input.requestId) as { hash: string; email: DeliveryState; sms: DeliveryState };
    if (read().hash !== hash) throw new RequestError("This request reference was already used for different details.", 409);
    if (result.changes) await Promise.all((["email", "sms"] as const).filter(channel => enabled[channel]).map(async channel => {
      let state: DeliveryState = "unknown";
      try { state = await dispatch(channel); } catch { /* Ambiguous provider outcome: never retry automatically. */ }
      this.db.prepare(`UPDATE emergency_receipts SET ${channel}=? WHERE id=?`).run(state, input.requestId);
    }));
    const receipt = read();
    return { requestId: input.requestId, email: receipt.email, sms: receipt.sms };
  }
}
let store: EmergencyStore | undefined;
export function emergencyStore() {
  if (!store) { const directory = join(process.cwd(), ".local"); mkdirSync(directory, { recursive: true }); store = new EmergencyStore(join(directory, "emergency.sqlite")); }
  return store;
}
