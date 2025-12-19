export type Toast = {
  text: string;
  tone: "info" | "success" | "error";
};

export type SharedFile = {
  id: string;
  code: string | null;
  name: string;
  size: number;
  sizeLabel: string;
  type: string;
  url: string;
  expiresAt: string | null;
};
