CREATE TABLE bell_schedule (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  updated_at TEXT NOT NULL
);

INSERT INTO bell_schedule (id, data_json, updated_at) VALUES (
  1,
  '{"regular":[{"start":"07:30","end":"08:15"},{"start":"08:20","end":"09:05"},{"start":"09:10","end":"09:55"},{"start":"10:00","end":"10:45"},{"start":"10:55","end":"11:40"},{"start":"12:00","end":"12:45"},{"start":"12:55","end":"13:40"},{"start":"13:45","end":"14:30"},{"start":"14:35","end":"15:20"},{"start":"15:30","end":"16:15"},{"start":"16:20","end":"17:05"},{"start":"17:10","end":"17:55"},{"start":"18:00","end":"18:45"},{"start":"18:50","end":"19:35"}],"variants":[],"days":[]}',
  '2026-10-26T00:00:00.000Z'
);
