type AuditEvent = {
  action: string;
  status: "success" | "failure";
  ip?: string;
  code?: string;
  fileId?: string | null;
  filename?: string | null;
  message?: string;
};

export function auditLog(event: AuditEvent) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...event,
    })
  );
}
