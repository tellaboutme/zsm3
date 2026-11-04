export const PHOTO_WORKER_POLICY = "zsm3-photo-worker";

export type PhotoFailure = "unreadable" | "too-small" | "too-heavy";

export interface PhotoRequest {
  readonly id: number;
  readonly file: File;
}

export type PhotoReply =
  | {
      readonly id: number;
      readonly ok: true;
      readonly small: ArrayBuffer;
      readonly large: ArrayBuffer;
    }
  | { readonly id: number; readonly ok: false; readonly failure: PhotoFailure };
