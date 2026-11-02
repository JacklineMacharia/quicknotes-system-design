const API_URL = 'https://jsonplaceholder.typicode.com/posts';
const MAX_TITLE_LENGTH = 100;

const loadBtn = document.getElementById('load-btn');
const statusEl = document.getElementById('status');
const form = document.getElementById('note-form');
const titleInput = document.getElementById('title-input');
const bodyInput = document.getElementById('body-input');
const submitBtn = document.getElementById('submit-btn');
const notesList = document.getElementById('notes-list');

/*
  How notes are stored on this page (important for POST and DELETE):

  JSONPlaceholder is a practice API. It ACCEPTS our POST and DELETE requests
  and replies with a success code, but it does NOT really save or delete
  anything on its server. If we re-fetched the list after creating or
  deleting a note, the new note would be missing and the deleted note would
  come back.

  So the `notes` array below is the page's own copy of the list. We still
  send every request to the API, and only after the API answers with success
  do we update this array (add the returned note, or remove the deleted one)
  and redraw the list. In a real backend we could simply reload from the
  server instead.

  Because the fake API gives EVERY new note the id 101, each note also gets a
  local `key` so we always delete the correct one from the page.
*/
let notes = [];
let nextKey = 1;

// ---------------------------------------------------------------
// Helpers: status messages and disabling buttons
// ---------------------------------------------------------------

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type || '';
}

function setBusy(isBusy) {
  document.querySelectorAll('button').forEach((button) => {
    button.disabled = isBusy;
  });
}

// ---------------------------------------------------------------
// The one reusable request function
// ---------------------------------------------------------------

async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  // Some successful replies have no body, so read the text first.
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  return { data, status: response.status };
}

// ---------------------------------------------------------------
// Drawing the list (user text is always inserted with textContent)
// ---------------------------------------------------------------

function renderNotes() {
  notesList.replaceChildren();

  if (notes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No notes to show. Load notes or add a new one.';
    notesList.appendChild(empty);
    return;
  }

  notes.forEach((note) => {
    const li = document.createElement('li');

    const title = document.createElement('h2');
    title.textContent = note.title;

    const body = document.createElement('p');
    body.textContent = note.body || '(no body)';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.key = note.key;
    deleteBtn.textContent = 'Delete';

    li.append(title, body, deleteBtn);
    notesList.appendChild(li);
  });
}

// ---------------------------------------------------------------
// GET: load 10 notes
// ---------------------------------------------------------------

async function loadNotes() {
  setBusy(true);
  setStatus('Loading notes...', 'loading');

  try {
    const { data } = await request(`${API_URL}?_limit=10`);

    notes = data.map((note) => ({ ...note, key: nextKey++ }));
    renderNotes();
    setStatus(`Loaded ${notes.length} notes from the server.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus('Sorry, we could not load your notes. Please try again.', 'error');
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------------
// POST: create a note
// ---------------------------------------------------------------

function validateTitle(title) {
  if (title === '') {
    return 'A title is required.';
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `The title must be ${MAX_TITLE_LENGTH} characters or fewer (it is ${title.length}).`;
  }
  return null;
}

async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  const problem = validateTitle(title);
  if (problem) {
    setStatus(problem, 'error');
    titleInput.focus();
    return;
  }

  setBusy(true);
  setStatus('Saving note...', 'loading');

  try {
    const { data, status } = await request(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ title, body, userId: 1 }),
    });

    // Newest note goes at the top. See the big comment above for why
    // we update our own array instead of re-fetching.
    notes.unshift({ ...data, key: nextKey++ });
    renderNotes();
    form.reset();
    setStatus(`Note created (status ${status}, id ${data.id}).`, 'success');
  } catch (error) {
    console.error(error);
    setStatus('Sorry, we could not save your note. Please try again.', 'error');
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------------
// DELETE: remove a note
// ---------------------------------------------------------------

async function deleteNote(key) {
  const note = notes.find((item) => item.key === key);
  if (!note) return;

  setBusy(true);
  setStatus('Deleting note...', 'loading');

  try {
    const { status } = await request(`${API_URL}/${note.id}`, {
      method: 'DELETE',
    });

    // The server confirmed, so remove it from our copy of the list.
    notes = notes.filter((item) => item.key !== key);
    renderNotes();
    setStatus(`Note deleted (status ${status}).`, 'success');
  } catch (error) {
    console.error(error);
    setStatus('Sorry, we could not delete that note. Please try again.', 'error');
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------------
// Wiring up the page
// ---------------------------------------------------------------

loadBtn.addEventListener('click', loadNotes);
form.addEventListener('submit', createNote);

// One listener on the list handles every Delete button, including
// buttons for notes that are added later.
notesList.addEventListener('click', (event) => {
  const button = event.target.closest('.delete-btn');
  if (button) {
    deleteNote(Number(button.dataset.key));
  }
});

renderNotes(); // shows the empty state on first load
