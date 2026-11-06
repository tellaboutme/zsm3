import workerUrl from "./photo-worker.ts?worker&url";
import { PHOTO_WORKER_POLICY, type PhotoReply } from "../../lib/panel/photo-worker-protocol.ts";

interface ScriptUrlPolicy {
  createScriptURL(input: string): URL;
}

declare global {
  interface Window {
    readonly trustedTypes?: {
      createPolicy(
        name: string,
        rules: { createScriptURL(input: string): string },
      ): ScriptUrlPolicy;
    };
  }
}

export interface PhotoPreparation {
  readonly done: Promise<PhotoReply | undefined>;
  readonly cancel: () => void;
}

function exactUrl(input: string): string {
  if (input !== workerUrl) {
    throw new TypeError("unexpected worker script");
  }
  return input;
}

let policy: ScriptUrlPolicy | undefined;

function startWorker(): Worker {
  policy ??= window.trustedTypes?.createPolicy(PHOTO_WORKER_POLICY, {
    createScriptURL: exactUrl,
  });
  return new Worker(policy?.createScriptURL(workerUrl) ?? workerUrl, { type: "module" });
}

function failedToStart(): PhotoPreparation {
  return {
    done: Promise.resolve({ id: 1, ok: false, failure: "unreadable" }),
    cancel: () => undefined,
  };
}

export function preparePhoto(file: File): PhotoPreparation {
  let worker: Worker;
  try {
    worker = startWorker();
  } catch {
    return failedToStart();
  }
  let finish: (answer: PhotoReply | undefined) => void = () => undefined;
  const done = new Promise<PhotoReply | undefined>((resolve) => {
    finish = resolve;
  });
  const end = (answer: PhotoReply | undefined): void => {
    worker.terminate();
    finish(answer);
  };
  worker.addEventListener("message", (event: MessageEvent<PhotoReply>) => {
    end(event.data);
  });
  worker.addEventListener("error", () => {
    end({ id: 1, ok: false, failure: "unreadable" });
  });
  worker.postMessage({ id: 1, file });
  return {
    done,
    cancel: () => {
      end(undefined);
    },
  };
}
