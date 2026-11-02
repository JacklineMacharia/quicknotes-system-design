# QuickNotes Data Model

The data model for the real QuickNotes backend. The SQL below is written for PostgreSQL.

## Entities

### users

| Column | Type | Key / rules |
|---|---|---|
| `id` | BIGINT (identity) | **Primary key** |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE |
| `password_hash` | VARCHAR(255) | NOT NULL |
| `name` | VARCHAR(100) | NOT NULL |
| `created_at` | TIMESTAMP | NOT NULL, default now |

### notes

| Column | Type | Key / rules |
|---|---|---|
| `id` | BIGINT (identity) | **Primary key** |
| `user_id` | BIGINT | **Foreign key** to `users(id)`, NOT NULL |
| `title` | VARCHAR(100) | NOT NULL |
| `body` | TEXT | optional |
| `created_at` | TIMESTAMP | NOT NULL, default now |
| `updated_at` | TIMESTAMP | NOT NULL, default now |

### tags

| Column | Type | Key / rules |
|---|---|---|
| `id` | BIGINT (identity) | **Primary key** |
| `user_id` | BIGINT | **Foreign key** to `users(id)`, NOT NULL |
| `name` | VARCHAR(50) | NOT NULL, unique per user |

### note_tags

| Column | Type | Key / rules |
|---|---|---|
| `note_id` | BIGINT | **Foreign key** to `notes(id)`, part of the primary key |
| `tag_id` | BIGINT | **Foreign key** to `tags(id)`, part of the primary key |

The primary key of `note_tags` is the pair `(note_id, tag_id)`.

## Relationships

- **users to notes: one-to-many.** One user owns many notes, and each note belongs to exactly one user.
- **users to tags: one-to-many.** One user creates many tags, and each tag belongs to one user.
- **notes to tags: many-to-many.** One note can have many tags (such as `work` and `urgent`), and one tag can be on many notes.
- The `note_tags` table is the **join table** that makes the many-to-many relationship possible. It turns it into two one-to-many relationships: one note has many `note_tags` rows, and one tag has many `note_tags` rows. The primary key `(note_id, tag_id)` also stops the same tag being added to the same note twice.

## CREATE TABLE statements

```sql
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE notes (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title      VARCHAR(100) NOT NULL,
    body       TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
    id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name    VARCHAR(50) NOT NULL,
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id BIGINT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES tags (id)  ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);
```

## Example queries

**1. A user's newest notes (one page of the list endpoint)**

```sql
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 7
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
```

**2. All notes with the tag "work" for one user (uses JOIN)**

```sql
SELECT n.id, n.title, n.created_at
FROM notes n
JOIN note_tags nt ON nt.note_id = n.id
JOIN tags t       ON t.id = nt.tag_id
WHERE n.user_id = 7
  AND t.name = 'work'
ORDER BY n.created_at DESC;
```

**3. How many notes each tag has (JOIN and GROUP BY)**

```sql
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags t
LEFT JOIN note_tags nt ON nt.tag_id = t.id
WHERE t.user_id = 7
GROUP BY t.id, t.name
ORDER BY note_count DESC;
```

## Index

```sql
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at DESC);
```

- **Reason:** The most common request is "list this user's notes, newest first" (`GET /notes`). Without an index the database would scan the whole `notes` table, which gets slower as it grows to millions of rows. This index lets it jump straight to one user's notes already in the right order.
- A second useful index is `CREATE INDEX idx_note_tags_tag_id ON note_tags (tag_id);`, because the primary key only helps when searching by `note_id`, not by `tag_id`.

## SQL or NoSQL?

I would choose **SQL** (PostgreSQL) for QuickNotes. The data is clearly structured and connected: users own notes, and notes have tags through a many-to-many relationship. A relational database handles these relationships with foreign keys and joins, and it keeps the data correct, for example by making sure a note always belongs to a real user and that deleting a user also removes their notes. Queries such as "all notes with this tag" or "notes per tag" are natural in SQL. The load is also modest for a relational database: about 40 reads and 10 writes per second on average for 1 million users, which one primary database with a read replica can handle. A NoSQL document database such as MongoDB could store each note with its tags inside one document, which is simple, but it makes cross-note queries and consistency harder, and we do not need its main strength of scaling writes across many servers.
