// ====== Constants ======
const STORAGE_KEY = "notes-app:v3-wysiwyg";
const THEME_KEY = "notes-app-theme";

// ====== Model & Storage ======
function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}
function loadTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}
function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

// ====== Utilities ======
function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}
function debounce(func, timeout = 750) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}
function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
}

// ====== State ======
const state = {
  notes: loadNotes(),
  selectedId: null,
  isSaving: false,
};

// ====== DOM Elements ======
const notesListEl = document.getElementById("notesList");
const noteTitleEl = document.getElementById("noteTitle");
const noteBodyEl = document.getElementById("noteBody");
const metaInfoEl = document.getElementById("metaInfo");
const searchInputEl = document.getElementById("searchInput");
const editorToolbar = document.querySelector(".editor-toolbar");

const newBtn = document.getElementById("newNoteBtn");
const delBtn = document.getElementById("deleteNoteBtn");
const pdfBtn = document.getElementById("downloadPdfBtn");
const themeBtn = document.getElementById("themeToggleBtn");

// ====== Rendering ======
function renderList() {
  const query = searchInputEl.value.trim().toLowerCase();
  notesListEl.innerHTML = "";
  const filteredNotes = state.notes
    .filter(n => !query || n.title.toLowerCase().includes(query) || stripHtml(n.body).toLowerCase().includes(query))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (filteredNotes.length === 0) {
    const emptyMessage = query ? "No notes match search." : "Create your first note!";
    notesListEl.innerHTML = `<li class="empty-state">${emptyMessage}</li>`;
    return;
  }

  filteredNotes.forEach(n => {
    const li = document.createElement("li");
    li.dataset.id = n.id;
    li.className = n.id === state.selectedId ? "active" : "";
    li.innerHTML = `
      <div class="title">${n.title || "Untitled"}</div>
      <div class="preview">${stripHtml(n.body || "").slice(0, 80)}</div>
      <div class="time">Updated: ${formatTime(n.updatedAt)}</div>
    `;
    li.addEventListener("click", () => selectNote(n.id));
    notesListEl.appendChild(li);
  });
}

function renderEditor() {
  const note = state.notes.find(n => n.id === state.selectedId);
  if (note) {
    noteTitleEl.value = note.title;
    noteBodyEl.innerHTML = note.body; // Use innerHTML for contenteditable
    updateMetaInfo(note);
  } else {
    noteTitleEl.value = "";
    noteBodyEl.innerHTML = "";
    metaInfoEl.textContent = "No note selected";
  }
  toggleEditorEnabledState(!!note);
}

function updateMetaInfo(note) {
  if (state.isSaving) {
    metaInfoEl.textContent = "Saving...";
  } else if (note) {
    metaInfoEl.textContent = `Created: ${formatTime(note.createdAt)} • Updated: ${formatTime(note.updatedAt)}`;
  }
}

function toggleEditorEnabledState(enabled) {
  noteTitleEl.disabled = !enabled;
  noteBodyEl.setAttribute("contenteditable", enabled);
  delBtn.disabled = !enabled;
  pdfBtn.disabled = !enabled;
  editorToolbar.style.pointerEvents = enabled ? "auto" : "none";
  editorToolbar.style.opacity = enabled ? "1" : "0.5";
}

// ====== Actions ======
function createNote() {
  const now = Date.now();
  const n = {
    id: uid(),
    title: "Untitled",
    body: "", // Stored as HTML string
    createdAt: now,
    updatedAt: now
  };
  state.notes.unshift(n);
  state.selectedId = n.id;
  saveNotes(state.notes);
  renderList();
  renderEditor();
  noteTitleEl.focus();
}

function saveCurrentNote() {
  const idx = state.notes.findIndex(n => n.id === state.selectedId);
  if (idx === -1) return;

  state.isSaving = true;
  updateMetaInfo(state.notes[idx]);

  const updatedNote = {
    ...state.notes[idx],
    title: noteTitleEl.value.trim() || "Untitled",
    body: noteBodyEl.innerHTML, // Use innerHTML to save content
    updatedAt: Date.now()
  };
  state.notes[idx] = updatedNote;
  saveNotes(state.notes);

  setTimeout(() => {
    state.isSaving = false;
    updateMetaInfo(updatedNote); // Update timestamp
    renderList(); // Update sidebar preview/order
  }, 300);
}

function selectNote(id) {
  state.selectedId = id;
  renderList();
  renderEditor();
}

function deleteCurrentNote() {
  if (!state.selectedId) return;
  const note = state.notes.find(n => n.id === state.selectedId);
  if (!note) return;
  if (!confirm(`Are you sure you want to delete "${note.title || "Untitled"}"?`)) return;

  state.notes = state.notes.filter(n => n.id !== state.selectedId);
  saveNotes(state.notes);
  state.selectedId = state.notes[0]?.id || null;
  renderList();
  renderEditor();
}

function toggleTheme() {
  const newTheme = document.body.classList.toggle("light-theme") ? "light" : "dark";
  saveTheme(newTheme);
}

async function downloadPDF() {
  const note = state.notes.find(n => n.id === state.selectedId);
  if (!note) return alert("Select a note first.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const lineHeight = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const title = note.title || "Untitled";
  doc.text(title, margin, margin);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Last updated: ${formatTime(note.updatedAt)}`, margin, margin + 16);

  doc.setTextColor(0);
  doc.setFontSize(12);
  // CRITICAL: Convert HTML body to plain text for PDF
  const body = stripHtml(note.body || "");
  const lines = doc.splitTextToSize(body, width);

  let cursorY = margin + 60;
  const pageHeight = doc.internal.pageSize.getHeight();

  lines.forEach(line => {
    if (cursorY > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
    doc.text(line, margin, cursorY);
    cursorY += lineHeight;
  });

  const safeName = title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "note";
  doc.save(`${safeName}.pdf`);
}

// ====== Event Listeners ======
const debouncedSaveNote = debounce(saveCurrentNote);
const debouncedRenderList = debounce(renderList, 300);

newBtn.addEventListener("click", createNote);
delBtn.addEventListener("click", deleteCurrentNote);
pdfBtn.addEventListener("click", downloadPDF);
themeBtn.addEventListener("click", toggleTheme);

// Toolbar button clicks
editorToolbar.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;

  const { command, value } = button.dataset;
  document.execCommand(command, false, value);
  noteBodyEl.focus(); // Keep focus in the editor
  debouncedSaveNote(); // Save after formatting
});

noteTitleEl.addEventListener("input", debouncedSaveNote);
noteBodyEl.addEventListener("input", debouncedSaveNote);
searchInputEl.addEventListener("input", debouncedRenderList);

// ====== Initialization ======
function init() {
  if (loadTheme() === "light") {
    document.body.classList.add("light-theme");
  }
  if (!state.selectedId && state.notes.length > 0) {
    state.selectedId = state.notes[0].id;
  }
  renderList();
  renderEditor();
}

init();