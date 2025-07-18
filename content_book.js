(function () {
  "use strict";

    if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
        setTimeout(extractBookInfoAndCheck, 1000);
  }

  function extractBookInfoAndCheck() {
    const bookInfo = extractBookInfo();
    if (bookInfo.title && bookInfo.author) {
      checkAvailabilityAndDisplay(bookInfo);
    }
  }

  function extractBookInfo() {
        const titleSelectors = [
      'h1[data-testid="bookTitle"]',
      "h1.gr-h1.gr-h1--serif",
      "h1#bookTitle",
      ".BookPageTitleSection__title h1",
      '[data-testid="bookTitle"]',
    ];

    const authorSelectors = [
      '[data-testid="name"]',
      ".BookPageMetadataSection__contributor a",
      ".authorName span",
      "a.authorName",
      '[data-testid="author"] a',
    ];

    let title = "";
    let author = "";

        for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        title = element.textContent.trim();
                break;
      }
    }

        for (const selector of authorSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        author = element.textContent.trim();
                break;
      }
    }

        return { title, author };
  }

  async function checkAvailabilityAndDisplay(bookInfo) {
        const result = await chrome.storage.sync.get(["selectedLibraries"]);
    const selectedLibraries = result.selectedLibraries || [];

    if (selectedLibraries.length === 0) {
            displayNoLibrariesMessage();
      return;
    }

        const container = createAvailabilityContainer();
    displayLoading(container);

        chrome.runtime.sendMessage(
      {
        action: "checkAvailability",
        data: {
          title: bookInfo.title,
          author: bookInfo.author,
          libraries: selectedLibraries,
        },
      },
      (response) => {
                if (response.error) {
                    displayError(container, response.error);
        } else if (response.results) {
                    displayResults(container, response.results);
        } else {
                    displayError(container, "Invalid response format");
        }
      }
    );
  }

  function createAvailabilityContainer() {
        const existing = document.querySelector(".libby-lookup-container");
    if (existing) {
      existing.remove();
    }

    const container = document.createElement("div");
    container.className = "libby-lookup-container";

        const insertionPoints = [
      ".BookPageMetadataSection",
      ".rightContainer",
      ".bookMeta",
      "#bookMeta",
      ".leftContainer",
    ];

    let inserted = false;
    for (const selector of insertionPoints) {
      const element = document.querySelector(selector);
      if (element) {
        element.appendChild(container);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      document.body.appendChild(container);
    }

    return container;
  }

  function displayLoading(container) {
    container.innerHTML = `
      <div class="libby-lookup-widget">
        <div class="libby-lookup-header">
          <span class="libby-lookup-icon-text">📚</span>
          <h3>Library Availability</h3>
        </div>
        <div class="libby-lookup-loading">
          <div class="libby-lookup-spinner"></div>
          <span>Checking availability...</span>
        </div>
      </div>
    `;
  }

  function displayResults(container, results) {
    const header = `
      <div class="libby-lookup-header">
        <span class="libby-lookup-icon-text">📚</span>
        <h3>Library Availability</h3>
      </div>
    `;

    const resultItems = results
      .map((result) => {
        if (result.status === "error") {
          return `
          <div class="libby-lookup-item libby-lookup-error">
            <strong>${result.library}</strong>
            <span class="libby-lookup-status">Error: ${result.message}</span>
          </div>
        `;
        } else {
          const isAvailable =
            result.availability && result.availabilityStatus === "available";

          let mediaTypesHtml = "";
          if (result.mediaTypes && result.mediaTypes.length > 0) {
            mediaTypesHtml = `
            <div class="libby-lookup-media-types">
              ${result.mediaTypes
                .map(
                  (mt) => `
                <div class="libby-lookup-media-type-item">
                  <span class="libby-lookup-media-icon">${mt.icon}</span>
                  <span class="libby-lookup-media-name">${mt.typeName}</span>
                  <a href="${mt.bookUrl}" target="_blank" class="libby-lookup-media-status ${mt.status}">
                    ${mt.text}
                  </a>
                </div>
              `
                )
                .join("")}
            </div>
          `;
          } else {
            mediaTypesHtml = `
            <a href="${
              result.bookUrl || result.searchUrl
            }" target="_blank" class="libby-lookup-link ${
              isAvailable ? "available" : ""
            }">
              ${result.availability || "Check availability"}
            </a>
          `;
          }

          return `
          <div class="libby-lookup-item">
            <strong>${result.library}</strong>
            ${mediaTypesHtml}
          </div>
        `;
        }
      })
      .join("");

    container.innerHTML = `
      <div class="libby-lookup-widget">
        ${header}
        <div class="libby-lookup-results">
          ${resultItems}
        </div>
      </div>
    `;
  }

  function displayError(container, error) {
    container.innerHTML = `
      <div class="libby-lookup-widget">
        <div class="libby-lookup-header">
          <span class="libby-lookup-icon-text">📚</span>
          <h3>Library Availability</h3>
        </div>
        <div class="libby-lookup-error">
          Error checking availability: ${error}
        </div>
      </div>
    `;
  }

  function displayNoLibrariesMessage() {
    const container = createAvailabilityContainer();
    container.innerHTML = `
      <div class="libby-lookup-widget">
        <div class="libby-lookup-header">
          <span class="libby-lookup-icon-text">📚</span>
          <h3>Library Availability</h3>
        </div>
        <div class="libby-lookup-no-libraries">
          <p>No libraries selected.</p>
          <button id="libby-lookup-options" class="libby-lookup-button">
            Select Libraries
          </button>
        </div>
      </div>
    `;

        document
      .getElementById("libby-lookup-options")
      .addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
      });
  }
})();
