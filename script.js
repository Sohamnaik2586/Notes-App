// ====== Model & Storage ======
const STORAGE_KEY = "notes-app:v1";

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

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

// ====== State ======
let notes = loadNotes();               // Array<{id, title, body, createdAt, updatedAt}>
let selectedId = notes[0]?.id || null; // Select first if exists

// ====== DOM ======
const notesListEl   = document.getElementById("notesList");
const noteTitleEl   = document.getElementById("noteTitle");
const noteBodyEl    = document.getElementById("noteBody");
const metaInfoEl    = document.getElementById("metaInfo");
const searchInputEl = document.getElementById("searchInput");

const newBtn     = document.getElementById("newNoteBtn");
const saveBtn    = document.getElementById("saveNoteBtn");
const delBtn     = document.getElementById("deleteNoteBtn");
const pdfBtn     = document.getElementById("downloadPdfBtn");

// ====== Rendering ======
function renderList(filter = "") {
  const q = filter.trim().toLowerCase();
  notesListEl.innerHTML = "";
  notes
    .filter(n => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    .sort((a,b) => b.updatedAt - a.updatedAt)
    .forEach(n => {
      const li = document.createElement("li");
      li.dataset.id = n.id;
      li.className = n.id === selectedId ? "active" : "";
      li.innerHTML = `
        <div class="title">${n.title || "Untitled"}</div>
        <div class="preview">${(n.body || "").slice(0, 80).replace(/\n/g, " ")}</div>
        <div class="time">Updated: ${formatTime(n.updatedAt)}</div>
      `;
      li.addEventListener("click", () => selectNote(n.id));
      notesListEl.appendChild(li);
    });
}

function renderEditor() {
  const note = notes.find(n => n.id === selectedId);
  if (!note) {
    noteTitleEl.value = "";
    noteBodyEl.value = "";
    metaInfoEl.textContent = "No note selected";
    return;
  }
  noteTitleEl.value = note.title;
  noteBodyEl.value  = note.body;
  metaInfoEl.textContent = `Created: ${formatTime(note.createdAt)} • Updated: ${formatTime(note.updatedAt)}`;
}

// ====== Actions ======
function createNote() {
  const n = {
    id: uid(),
    title: "Untitled",
    body: "",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  notes.unshift(n);
  selectedId = n.id;
  saveNotes(notes);
  renderList(searchInputEl.value);
  renderEditor();
  noteTitleEl.focus();
}

function saveCurrentNote() {
  const idx = notes.findIndex(n => n.id === selectedId);
  if (idx === -1) return;
  const updated = {
    ...notes[idx],
    title: noteTitleEl.value.trim(),
    body: noteBodyEl.value,
    updatedAt: Date.now()
  };
  notes[idx] = updated;
  saveNotes(notes);
  renderList(searchInputEl.value);
  renderEditor();
}

function selectNote(id) {
  selectedId = id;
  renderList(searchInputEl.value);
  renderEditor();
}

function deleteCurrentNote() {
  if (!selectedId) return;
  const note = notes.find(n => n.id === selectedId);
  if (!note) return;
  if (!confirm(`Delete "${note.title || "Untitled"}"?`)) return;

  notes = notes.filter(n => n.id !== selectedId);
  saveNotes(notes);
  selectedId = notes[0]?.id || null;
  renderList(searchInputEl.value);
  renderEditor();
}

// ====== PDF Download ======
async function downloadPDF() {
  const note = notes.find(n => n.id === selectedId);
  if (!note) return alert("Select a note first.");

  // jsPDF is available from the UMD bundle
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 48;
  const width  = doc.internal.pageSize.getWidth() - margin * 2;
  const lineHeight = 18;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const title = note.title || "Untitled";
  doc.text(title, margin, margin);

  // Meta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Exported: ${formatTime(Date.now())}`, margin, margin + 16);

  // Body
  doc.setTextColor(0);
  doc.setFontSize(12);

  const body = note.body || "";
  const lines = doc.splitTextToSize(body, width);

  let cursorY = margin + 40;
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

// ====== Events ======
newBtn.addEventListener("click", createNote);
saveBtn.addEventListener("click", saveCurrentNote);
delBtn.addEventListener("click", deleteCurrentNote);
pdfBtn.addEventListener("click", downloadPDF);

searchInputEl.addEventListener("input", (e) => renderList(e.target.value));

// Optional: Ctrl/Cmd+S to save
document.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  if ((isMac && e.metaKey && e.key === "s") || (!isMac && e.ctrlKey && e.key === "s")) {
    e.preventDefault();
    saveCurrentNote();
  }
});

// Load initial UI
renderList("");
renderEditor();

// Improve UX: auto-select first note if none selected
if (!selectedId && notes.length) {
  selectedId = notes[0].id;
  renderList("");
  renderEditor();
}
