let allLibraries = [];
let selectedLibraries = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadLibraries();
  await loadSettings();
  setupEventListeners();
  renderLibraries();
}

async function loadLibraries() {
  try {
    const response = await fetch(chrome.runtime.getURL("libraries.json"));
    allLibraries = await response.json();
    allLibraries.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error loading libraries:", error);
  }
}

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(["selectedLibraries"]);
    selectedLibraries = result.selectedLibraries || [];
  } catch (error) {
    console.error("Error loading settings:", error);
    selectedLibraries = [];
  }
}

function setupEventListeners() {
  document.getElementById("saveBtn").addEventListener("click", saveSettings);
  document.getElementById("selectAllBtn").addEventListener("click", selectAll);
  document.getElementById("clearAllBtn").addEventListener("click", clearAll);
}

function renderLibraries() {
  const container = document.getElementById("librariesContainer");
  container.innerHTML = "";

  allLibraries.forEach((library) => {
    const isSelected = selectedLibraries.includes(library.id);

    const libraryDiv = document.createElement("div");
    libraryDiv.innerHTML = `
      <label>
        <input type="checkbox" value="${library.id}" ${
      isSelected ? "checked" : ""
    }>
        ${library.name}
      </label>
    `;

    const checkbox = libraryDiv.querySelector("input");
    checkbox.addEventListener("change", (e) => {
      toggleLibrary(library.id, e.target.checked);
    });

    container.appendChild(libraryDiv);
  });
}

function toggleLibrary(id, isChecked) {
  if (isChecked) {
    if (!selectedLibraries.includes(id)) {
      selectedLibraries.push(id);
    }
  } else {
    selectedLibraries = selectedLibraries.filter((s) => s !== id);
  }
}

function selectAll() {
  selectedLibraries = allLibraries.map((lib) => lib.id);
  renderLibraries();
}

function clearAll() {
  selectedLibraries = [];
  renderLibraries();
}

async function saveSettings() {
  try {
    await chrome.storage.sync.set({ selectedLibraries });
    showStatus("Settings saved successfully!");
  } catch (error) {
    console.error("Error saving settings:", error);
    showStatus("Error saving settings. Please try again.");
  }
}

function showStatus(message) {
  const statusElement = document.getElementById("statusMessage");
  statusElement.textContent = message;

  setTimeout(() => {
    statusElement.textContent = "";
  }, 3000);
}
