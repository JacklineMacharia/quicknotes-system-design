# QuickNotes Architecture

## 1. Requirements

### Functional requirements

- Users can register and log in.
- Users can create, view, edit and delete their own notes.
- Users can add tags to notes and filter their notes by tag.
- Users see only their own notes.
- Notes are available from any device, not just one browser.

### Non-functional requirements

- **Availability:** the service should be up 99.9% of the time, with no single point of failure.
- **Performance:** listing notes should respond in under 300 ms for most requests.
- **Scalability:** support 1 million users, and grow by adding servers.
- **Durability:** no note is ever lost, so the data is backed up and replicated.
- **Security:** passwords are hashed, traffic uses HTTPS, and users cannot access each other's notes.

## 2. Load estimate for 1 million users

### Assumptions

- 1,000,000 registered users.
- 20% are active each day, so **200,000 daily active users**.
- Each active user loads their notes list 20 times a day (reads).
- Each active user makes 5 changes a day (writes), and 2 of those are new notes.
- An average note is about 2 KB including its tags and details.
- One day is about 100,000 seconds (a rounded estimate; the exact figure is 86,400).
- Peak traffic is 5× the average.

### Reads per second

- Reads per day: 200,000 × 20 = 4,000,000
- Average: 4,000,000 ÷ 100,000 = **40 reads per second**
- Peak: 40 × 5 = **200 reads per second**

### Writes per second

- Writes per day: 200,000 × 5 = 1,000,000
- Average: 1,000,000 ÷ 100,000 = **10 writes per second**
- Peak: 10 × 5 = **50 writes per second**

### Storage per year

- New notes per day: 200,000 × 2 = 400,000
- Storage per day: 400,000 × 2 KB = 800 MB
- Storage per year: 800 MB × 365 = about **292 GB** (roughly 300 GB, a bit more with indexes)

### Conclusion

- The system is **read-heavy** (4 reads for every write), so a cache and a read replica help most.
- 300 GB per year is small, so a single relational database is enough for the data.

## 3. Architecture diagram

```
                       +------------------+
                       |      Client      |
                       |  (web / mobile)  |
                       +--------+---------+
                                |
                       +--------v---------+
                       |       DNS        |  quicknotes.example -> CDN / LB
                       +--------+---------+
                                |
                +---------------+----------------+
                |                                |
       static files (HTML/CSS/JS)         API calls (/v1/...)
                |                                |
        +-------v--------+               +-------v--------+
        |      CDN       |               | Load Balancer  |
        +----------------+               +-------+--------+
                                                 |
                                   +-------------+-------------+
                                   |                           |
                            +------v-------+            +------v-------+
                            | App Server 1 |            | App Server 2 |   (more can be added)
                            +--+---+----+--+            +--+---+----+--+
                               |   |    |                  |   |    |
        +----------------------+   |    +------------------+   |    |
        |                          |                           |    |
  +-----v-----+     +--------------v-------------+      +------v----v-------+
  |   Cache   |     |          Database          |      |   Message Queue   |
  |  (Redis)  |     |  Primary (all writes)      |      | (background jobs) |
  +-----------+     |     | replication          |      +---------+---------+
                    |  Read Replica (reads)      |                |
                    +----------------------------+         +------v------+
                                                           |   Worker    |
                                                           | (emails,    |
                                                           |  backups)   |
                                                           +-------------+
```

## 4. Components (one sentence each)

- **Client:** The web or mobile app that users interact with, which sends requests to the API.
- **DNS:** It turns the name `quicknotes.example` into the address of our servers, so users do not need to remember an IP address and we can move servers without changing the name.
- **CDN:** It serves static files (HTML, CSS, JavaScript) from locations close to users, so pages load fast and our servers are not used for files that never change.
- **Load balancer:** It spreads requests across the app servers and stops sending traffic to a server that has failed, so no single server is overloaded.
- **App servers (two or more):** They run the QuickNotes API logic and keep no data of their own, so we can add more servers when traffic grows and lose one without downtime.
- **Cache:** It keeps recently read data, such as a user's first page of notes, in fast memory, so repeated reads do not hit the database.
- **Primary database:** It is the single source of truth that stores users, notes and tags safely and handles every write.
- **Read replica:** It is a live copy of the primary that answers read queries, so heavy reading does not slow down writes and it can take over if the primary fails.
- **Message queue:** It holds background jobs until a worker can process them, so slow tasks do not make users wait and jobs are not lost during traffic spikes.
- **Worker:** It takes jobs from the queue, such as sending welcome emails and creating backups or exports, so these tasks run outside the request path.

## 5. Request flows

### GET /notes

1. The client sends `GET /notes?page=1` with its token. DNS has already pointed it to the load balancer.
2. The **load balancer** chooses a healthy app server.
3. The app server checks the token. If it is missing or invalid, it replies `401`.
4. The app server looks in the **cache** for this user's page of notes (for example the key `notes:user7:page1`).
5. **Cache hit:** it returns the cached notes right away with `200 OK`.
6. **Cache miss:** it queries the **read replica** for the user's notes, newest first.
7. It stores the result in the cache with a short expiry (for example 60 seconds).
8. It returns `200 OK` with the JSON list to the client.

### POST /notes

1. The client sends `POST /notes` with its token and a JSON body (title, body, tags).
2. The **load balancer** chooses a healthy app server.
3. The app server checks the token (`401` if invalid) and validates the body. A missing title or one over 100 characters gets `400`.
4. The app server writes the note, and its tags, to the **primary database** in one transaction.
5. It clears (invalidates) this user's cached notes pages, so the next read is fresh.
6. If needed, it puts a background job on the **queue**, for example an activity log or backup job. A **worker** processes it later.
7. It returns `201 Created` with the new note and its `id`.
8. The primary database copies the change to the **read replica** in the background.

## 6. Trade-offs

- **Caching: speed vs fresh data.**
  - The cache makes reads much faster and protects the database, but cached data can be out of date, and we must remember to invalidate it when a note changes.
  - We use a short expiry and clear the user's cache on every write. This adds complexity but is worth it because the system is read-heavy.
- **Read replica: scale vs consistency.**
  - Replication has a small delay, so a user may create a note and not see it immediately if the next read goes to the replica.
  - We accept this for most reads and can read a user's own list from the primary right after they write.
- **SQL database: strong consistency vs easy scaling.**
  - SQL keeps data correct, but it is harder to spread writes over many servers than with some NoSQL systems.
  - At 50 writes per second at peak, one primary is enough, so we choose correctness.
- **Queue and worker: fast responses vs extra complexity.**
  - Users never wait for slow tasks, but we must run and monitor a queue and workers, and handle retries.

## 7. Avoiding single points of failure

- **DNS and CDN:** use a provider with many servers around the world, so there is no single machine to fail.
- **Load balancer:** run at least two (active and standby, or a managed cloud load balancer that is itself redundant).
- **App servers:** run two or more, in different data centres (availability zones). The load balancer removes a failed one.
- **Cache:** run a cache cluster with a replica. If it fails, the app still works by reading from the database, only slower.
- **Database:** the primary has a read replica that can be promoted if the primary fails, and we take regular backups.
- **Queue and workers:** use a replicated queue and several workers. A job that fails stays in the queue and is retried.
- **Monitoring and health checks:** detect failures quickly so failed parts are replaced automatically.

Author: Jackline N.M 😎