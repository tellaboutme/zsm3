export const requestFieldLabels: Readonly<Record<string, string>> = {
  type: "Wybierz dokument.",
  firstName: "Podaj imię.",
  lastName: "Podaj nazwisko.",
  email: "Podaj prawidłowy adres e-mail.",
  className: "Wybierz klasę lub podaj rok ukończenia szkoły.",
  graduationYear: "Podaj prawidłowy rok ukończenia szkoły.",
  noticesAccepted: "Potwierdź zapoznanie się z informacjami.",
  turnstileToken: "Ukończ weryfikację. Jeśli nie działa, skontaktuj się z sekretariatem.",
};

export function requestRefusal(status: number): string {
  if (status === 429) return "Zbyt wiele prób. Spróbuj ponownie później.";
  if (status === 409) return "Osiągnięto limit otwartych wniosków dla tego adresu e-mail.";
  return "Nie udało się wysłać wniosku. Spróbuj ponownie lub skontaktuj się z sekretariatem.";
}
