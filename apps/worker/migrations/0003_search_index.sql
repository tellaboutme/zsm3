CREATE VIRTUAL TABLE search_documents USING fts5(
  doc_id UNINDEXED, kind UNINDEXED, href UNINDEXED,
  title, body,
  title_raw UNINDEXED, body_raw UNINDEXED, published_on UNINDEXED,
  tokenize = 'unicode61'
);
