# QuickNotes API Design

This is the design of the real QuickNotes API that the backend team will build (not JSONPlaceholder).

## General rules

- Base URL: `https://api.quicknotes.example/v1`
- Data format: JSON (`Content-Type: application/json`)
- Authentication: after logging in, the client sends `Authorization: Bearer <token>` with every request except register and login.
- Each user can only see and change their own notes.
- Lists are paginated with the query parameters `page` (default 1) and `limit` (default 10, maximum 50).
- Resources are nouns in the plural (`/notes`, `/tags`), and the HTTP method says the action.

## Endpoints

| Method | Path | Description | Success status |
|---|---|---|---|
| POST | `/auth/register` | Create a new user account | `201 Created` |
| POST | `/auth/login` | Log in and receive a token | `200 OK` |
| GET | `/notes` | List the logged-in user's notes (supports `page`, `limit` and `tag`) | `200 OK` |
| GET | `/notes/{id}` | Get one note | `200 OK` |
| POST | `/notes` | Create a note | `201 Created` |
| PUT | `/notes/{id}` | Replace the title, body and tags of a note | `200 OK` |
| DELETE | `/notes/{id}` | Delete a note | `204 No Content` |
| GET | `/tags` | List the user's tags | `200 OK` |

### Notes on the endpoints

- `GET /notes?tag=work` returns only notes that have the tag `work`.
- `PUT /notes/{id}` replaces the whole note, so the client sends all editable fields.
- `DELETE` returns no body, which is why it uses `204`.

## Example: create a note

**Request**

```
POST /notes
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

```json
{
  "title": "Buy groceries",
  "body": "Milk, eggs, bread",
  "tags": ["home", "shopping"]
}
```

**Response: `201 Created`**

```
Location: /notes/42
```

```json
{
  "id": 42,
  "userId": 7,
  "title": "Buy groceries",
  "body": "Milk, eggs, bread",
  "tags": ["home", "shopping"],
  "createdAt": "2026-11-03T09:15:00Z",
  "updatedAt": "2026-11-03T09:15:00Z"
}
```

## Example: list notes

**Request**

```
GET /notes?page=1&limit=2
Authorization: Bearer eyJhbGciOi...
```

**Response: `200 OK`**

```json
{
  "data": [
    {
      "id": 42,
      "title": "Buy groceries",
      "body": "Milk, eggs, bread",
      "tags": ["home", "shopping"],
      "createdAt": "2026-11-03T09:15:00Z",
      "updatedAt": "2026-11-03T09:15:00Z"
    },
    {
      "id": 41,
      "title": "Project ideas",
      "body": "Build a weather dashboard",
      "tags": ["work"],
      "createdAt": "2026-11-02T16:40:00Z",
      "updatedAt": "2026-11-02T16:40:00Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 37
}
```

## Error status codes

| Status | Name | When it happens |
|---|---|---|
| `400` | Bad Request | The request is invalid, for example `POST /notes` with no title or a title longer than 100 characters. |
| `401` | Unauthorized | There is no token, or the token is missing, expired or invalid. The user is not logged in. |
| `403` | Forbidden | The user is logged in but is not allowed to do this, for example trying to read or delete another user's note. |
| `404` | Not Found | The note does not exist, for example `GET /notes/9999`. |
| `500` | Internal Server Error | An unexpected failure on the server, such as the database being unreachable. |

### Example error body

All errors use the same shape, so the client can handle them in one place.

`400 Bad Request` for `POST /notes` with an empty title:

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "The title is required and must be 100 characters or fewer.",
    "details": [
      { "field": "title", "problem": "must not be empty" }
    ]
  }
}
```

`404 Not Found` for `GET /notes/9999`:

```json
{
  "error": {
    "status": 404,
    "code": "NOTE_NOT_FOUND",
    "message": "No note with id 9999 exists."
  }
}
```
