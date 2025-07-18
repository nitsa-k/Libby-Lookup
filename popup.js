document.addEventListener("DOMContentLoaded", init);

async function init() {
  await checkStatus();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById("optionsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
}

async function checkStatus() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const isGoodreads = tab.url && tab.url.includes("goodreads.com");

    const statusContainer = document.getElementById("statusContainer");

    if (!isGoodreads) {
      statusContainer.innerHTML = `
        <div>
          Navigate to Goodreads to use this extension
        </div>
      `;
    }
  } catch (error) {
    console.error("Error checking status:", error);
    const statusContainer = document.getElementById("statusContainer");
    statusContainer.innerHTML = `
      <div>
        Error checking status
      </div>
    `;
  }
}
