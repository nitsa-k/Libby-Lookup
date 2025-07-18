document.addEventListener("DOMContentLoaded", init);

async function init() {
  await checkStatus();
  setupEventListeners();
}

async function checkStatus() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const isGoodreads = tab.url && tab.url.includes("goodreads.com");

    const result = await chrome.storage.sync.get(["selectedLibraries"]);
    const selectedLibraries = result.selectedLibraries || [];

    const statusContainer = document.getElementById("statusContainer");

    if (!isGoodreads) {
      statusContainer.innerHTML = `
        <div class="status status-info">
          Navigate to Goodreads to use this extension
        </div>
      `;
    } else if (selectedLibraries.length === 0) {
      statusContainer.innerHTML = `
        <div class="status status-warning">
          No libraries configured. Click "Configure Libraries" to get started.
        </div>
      `;
    } else {
      statusContainer.innerHTML = `
        <div class="status status-goodreads">
          Ready! ${selectedLibraries.length} ${
        selectedLibraries.length === 1 ? "library" : "libraries"
      } configured.
        </div>
      `;
    }
  } catch (error) {
    console.error("Error checking status:", error);
    const statusContainer = document.getElementById("statusContainer");
    statusContainer.innerHTML = `
      <div class="status status-warning">
        Error checking status
      </div>
    `;
  }
}

function setupEventListeners() {
  document.getElementById("optionsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  document.getElementById("refreshBtn").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      await chrome.tabs.reload(tab.id);
      window.close();
    } catch (error) {
      console.error("Error refreshing tab:", error);
    }
  });
}
