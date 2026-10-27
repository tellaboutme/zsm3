export const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

export function isFormBody(contentType: string | undefined): boolean {
  return contentType?.startsWith(FORM_CONTENT_TYPE) === true;
}
