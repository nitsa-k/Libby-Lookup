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
    const result = await chrome.storage.sync.get([
      "selectedLibraries",
      "showEbooks",
      "showAudiobooks",
    ]);

    selectedLibraries = result.selectedLibraries || [];

    const showEbooks = result.showEbooks !== false; 
    const showAudiobooks = result.showAudiobooks !== false; 

    document.getElementById("showEbooks").checked = showEbooks;
    document.getElementById("showAudiobooks").checked = showAudiobooks;
  } catch (error) {
    console.error("Error loading settings:", error);
    selectedLibraries = [];
  }
}

function setupEventListeners() {
  document
    .getElementById("showEbooks")
    .addEventListener("change", handleMediaTypeChange);
  document
    .getElementById("showAudiobooks")
    .addEventListener("change", handleMediaTypeChange);

  document.getElementById("saveBtn").addEventListener("click", saveSettings);
  document.getElementById("selectAllBtn").addEventListener("click", selectAll);
  document.getElementById("clearAllBtn").addEventListener("click", clearAll);
}

function handleMediaTypeChange() {
  const showEbooks = document.getElementById("showEbooks").checked;
  const showAudiobooks = document.getElementById("showAudiobooks").checked;

  if (!showEbooks && !showAudiobooks) {
    event.target.checked = true;
    showStatus("At least one media type must be selected.", "error");
    return;
  }

  chrome.storage.sync.set({
    showEbooks: showEbooks,
    showAudiobooks: showAudiobooks,
  });
}

function renderLibraries() {
  const container = document.getElementById("librariesContainer");
  container.innerHTML = "";

  allLibraries.forEach((library) => {
    const isSelected = selectedLibraries.includes(library.id);

    const libraryDiv = document.createElement("div");
    libraryDiv.className = "library-item";
    libraryDiv.innerHTML = `
      <input type="checkbox" value="${library.id}" ${
      isSelected ? "checked" : ""
    } id="lib-${library.id}">
      <label for="lib-${library.id}">${library.name}</label>
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
    const showEbooks = document.getElementById("showEbooks").checked;
    const showAudiobooks = document.getElementById("showAudiobooks").checked;

    await chrome.storage.sync.set({
      selectedLibraries,
      showEbooks,
      showAudiobooks,
    });

    showStatus("Settings saved successfully!", "success");
  } catch (error) {
    console.error("Error saving settings:", error);
    showStatus("Error saving settings. Please try again.", "error");
  }
}

function showStatus(message, type) {
  const statusElement = document.getElementById("statusMessage");
  statusElement.textContent = message;
  statusElement.className = `status-message status-${type}`;
  statusElement.style.display = "block";

  setTimeout(() => {
    statusElement.style.display = "none";
  }, 3000);
}
