export function fileOf(bytes: Uint8Array, name = "photo.webp"): File {
  return new File([Uint8Array.from(bytes)], name);
}

export interface PhotoParts {
  readonly small?: File | string;
  readonly large?: File | string;
  readonly alt?: string;
  readonly consent?: string;
}

export function photoForm(parts: PhotoParts): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(parts)) {
    if (typeof value === "string" || value instanceof File) {
      form.set(name, value);
    }
  }
  return form;
}
