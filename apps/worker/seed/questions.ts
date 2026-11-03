import type { QuestionAddressee } from "@zsm3/contracts/questions";

import { seal } from "../src/questions/sealing.ts";
import type { PiiCrypto } from "../src/security/pii-crypto.ts";
import type { AuditEntry } from "../src/storage/audit-repo.ts";
import { batchChanges, type Store } from "../src/storage/database.ts";
import { questionsRepo, type QuestionsRepo } from "../src/storage/questions-repo.ts";
import type { QuestionWrite } from "../src/storage/questions-writes.ts";

interface SeedQuestion {
  readonly id: string;
  readonly addressee: QuestionAddressee;
  readonly receivedOn: string;
  readonly question: string;
  readonly answer: string | null;
}

export const seedQuestions: readonly SeedQuestion[] = [
  {
    id: "5e1d0000-0000-4000-8000-000000000001",
    addressee: "psychologist",
    receivedOn: "2026-10-06",
    question:
      "Jak sobie radzić ze stresem, kiedy w jednym tygodniu mam kilka sprawdzianów?\n\nCzy to normalne, że przed każdym nie mogę spać?",
    answer:
      "Stres przed sprawdzianami zdarza się bardzo wielu uczniom. Pomaga rozłożenie nauki na krótsze części w kolejnych dniach i zaplanowanie przerw.\n\nJeśli przez stres często nie śpisz albo trudno Ci się skupić także poza szkołą, przyjdź na rozmowę do psychologa szkolnego. Nie musisz się wcześniej zapisywać.",
  },
  {
    id: "5e1d0000-0000-4000-8000-000000000002",
    addressee: "leadership",
    receivedOn: "2026-10-13",
    question: "Czy uczniowie mogą zgłaszać pomysły na wydarzenia w szkole?",
    answer:
      "Tak. Pomysły zbiera samorząd uczniowski, a opiekun samorządu przedstawia je dyrekcji. Możesz też opisać pomysł wychowawcy.",
  },
  {
    id: "5e1d0000-0000-4000-8000-000000000003",
    addressee: "pedagogue",
    receivedOn: "2026-10-20",
    question: "Przykładowe pytanie testowe czekające na moderację w lokalnej bazie.",
    answer: null,
  },
];

function audit(id: string, action: string): AuditEntry {
  return {
    actorEmail: null,
    action,
    entity: "questions",
    entityId: id,
    details: JSON.stringify({ fields: ["seed"] }),
  };
}

async function write(
  store: Store,
  repo: QuestionsRepo,
  id: string,
  change: { readonly version: number; readonly write: QuestionWrite; readonly action: string },
): Promise<void> {
  const batch = repo.writeBatch({
    id,
    expectedVersion: change.version,
    write: change.write,
    audit: audit(id, change.action),
  });
  batch.applied(batchChanges(await store.db.batch([...batch.statements])));
}

export async function seedQuestionBox(store: Store, crypto: PiiCrypto): Promise<number> {
  const repo = questionsRepo(store);
  let seeded = 0;
  for (const item of seedQuestions) {
    const fresh = await repo.receive({
      id: item.id,
      addressee: item.addressee,
      question: await seal(crypto, "question", item.id, item.question),
      formKey: item.id,
      receivedOn: item.receivedOn,
    });
    if (!fresh || item.answer === null) {
      seeded += fresh ? 1 : 0;
      continue;
    }
    const plaintext = JSON.stringify({ question: item.question, answer: item.answer });
    const draft = await seal(crypto, "draft", item.id, plaintext);
    await write(store, repo, item.id, {
      version: 1,
      write: { kind: "draft", draft },
      action: "questions.draft",
    });
    await write(store, repo, item.id, {
      version: 2,
      write: {
        kind: "publish",
        question: item.question,
        answer: item.answer,
        slug: repo.newSlug(),
      },
      action: "questions.publish",
    });
    seeded += 1;
  }
  return seeded;
}
