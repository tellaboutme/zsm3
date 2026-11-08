interface Window {
  turnstile?: {
    getResponse(container: HTMLElement): string;
    reset(container: HTMLElement): void;
  };
}
