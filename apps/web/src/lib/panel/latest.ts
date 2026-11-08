export type Ticket = () => boolean;

export function latestOnly(): () => Ticket {
  let latest = 0;
  return () => {
    latest += 1;
    const issued = latest;
    return () => issued === latest;
  };
}
