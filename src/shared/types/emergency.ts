export type EmergencyInput = { requestId: string; name: string; phone: string; people: number; disaster: string; message: string; locationText: string; latitude?: number; longitude?: number; consent: true };
export type DeliveryState = "accepted" | "failed" | "unknown" | "not-configured";
export type EmergencyReceipt = { requestId: string; email: DeliveryState; sms: DeliveryState };
export type EmergencyConfig = { authority: string; email: boolean; sms: boolean };
