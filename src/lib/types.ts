export type Role = "resident" | "valet" | "manager";

export type TicketType = "now" | "scheduled" | "arrival" | "restack";

export type TicketStatus =
  | "open"
  | "claimed"
  | "staged"
  | "released"
  | "cancelled";

export type Ticket = {
  id: number;
  type: TicketType;
  unit: string;
  name: string;
  car: string;
  color: string;
  plate: string;
  stall: string;
  due: string;
  status: TicketStatus;
  note: string;
  blockedBy?: string;
  valet?: string;
  requestedAt: number;
  claimedAt?: number;
  unnestedAt?: number;
  liftedAt?: number;
  stagedAt?: number;
  releasedAt?: number;
  toStall?: string;
};

export type StallBay = "hot" | "mid" | "deep" | "permit" | "guest";

export type StallZone =
  | "guest"
  | "hot"
  | "midAisle"
  | "midWall"
  | "deep"
  | "permit";

export type Stall = {
  id: string;
  bay: StallBay;
  zone: StallZone;
  col: number;
  ev: boolean;
  ada?: boolean;
  plate: string | null;
  unit?: string;
  car?: string;
  color?: string;
  blockedBy?: string;
  blocks?: string;
  liftDeck?: "upper" | "lower";
  liftPair?: string;
};

export type RestackMove = {
  id: string;
  unit: string;
  plate: string;
  car: string;
  from: string;
  to: string;
  why: string;
};

export type Result = { ok: boolean; message: string };

export type ChatMsg = {
  id: number;
  from: string;
  body: string;
  at: number;
  kind: "chat" | "system";
};

export type KeyPing = {
  id: number;
  unit: string;
  name: string;
  email: string;
  phone: string;
  status: "sent" | "acked";
  at: number;
  by: string;
  sms: string;
  emailSubject: string;
  emailBody: string;
};

export type RidePing = {
  id: number;
  unit: string;
  ticketId: number;
  kind: "getting" | "ready";
  sms: string;
  at: number;
};

export type Contact = {
  unit: string;
  name: string;
  email: string;
  phone: string;
};

export type StaffName = "You" | "Luis" | "Ana" | "Derrick";

export type PunchKind = "in" | "out" | "break-start" | "break-end";

export type Punch = {
  who: StaffName;
  kind: PunchKind;
  at: number;
};

export type ShiftPull = {
  who: StaffName;
  plate: string;
  car: string;
  unit: string;
  stall: string;
  at: number;
  mins: number;
  nest?: boolean;
};
