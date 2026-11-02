# QuickNotes

QuickNotes is a note-taking app that is moving from a browser-only app to an online service for 1 million users. This project has two parts:

1. **An API client** (HTML, CSS and JavaScript) that proves the front end can talk to an API. It uses the JSONPlaceholder practice API to load, create and delete notes.
2. **Design documents** for the real backend, which the backend team will build from.

## How to run the API client

1. Download or clone this repository.
2. Open `index.html` in a web browser (double-click it, or use the Live Server extension in VS Code).
3. You need an internet connection, because the page talks to `https://jsonplaceholder.typicode.com`.
4. Click **Load notes** to load 10 notes (GET).
5. Fill in the form and click **Add note** to create a note (POST). The title is required and can be at most 100 characters.
6. Click **Delete** on a note to remove it (DELETE).

To test the error message, temporarily change `API_URL` in `api.js` to a wrong address (such as `.../postz`), click **Load notes**, then change it back.

Note: JSONPlaceholder does not really save new notes or delete old ones, so the page keeps its own copy of the list. This is explained in a comment in `api.js`.

## Files

- `index.html` - the page
- `style.css` - the styling, with different looks for loading, success and error messages
- `api.js` - the API client code

## Documents

- [API design](docs/api-design.md) - the endpoints, examples and error codes for the real QuickNotes API
- [Data model](docs/data-model.md) - the tables, relationships, SQL, index and SQL vs NoSQL choice
- [Architecture](docs/architecture.md) - requirements, load estimates, diagram, request flows and trade-offs

## What I learned

- How to use `fetch` with `async` / `await`, check `response.ok`, and wrap requests in `try` / `catch` / `finally` so errors are handled and buttons are always re-enabled.
- How GET, POST and DELETE differ, and how HTTP status codes (200, 201, 204, 400, 401, 403, 404, 500) tell the client what happened.
- Why a many-to-many relationship, like notes and tags, needs a join table, and how indexes make common queries faster.
- How to estimate load (reads and writes per second, storage per year) and use it to decide what a system needs, such as a cache and a read replica for a read-heavy app.
- How to design for scale and reliability with a CDN, load balancer, several app servers, a cache, a read replica and a queue, and how to avoid single points of failure.
- Why user text must be inserted with `textContent` and not `innerHTML`, to keep the page safe.
