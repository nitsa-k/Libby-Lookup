(function () {
  "use strict";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    setTimeout(processBooksOnShelf, 1000);
  }

  async function processBooksOnShelf() {
    const result = await chrome.storage.sync.get(["selectedLibraries"]);
    const selectedLibraries = result.selectedLibraries || [];

    if (selectedLibraries.length === 0) {
      return;
    }

    const books = extractBooksFromShelf();
    if (books.length === 0) {
      return;
    }

    addLibraryColumn();

    const batchSize = 3;
    for (let i = 0; i < books.length; i += batchSize) {
      const batch = books.slice(i, i + batchSize);
      await processBatch(batch, selectedLibraries);

      if (i + batchSize < books.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  function extractBooksFromShelf() {
    const books = [];

    const bookRowSelectors = [
      "tr.bookalike.review",
      "tr.review",
      ".bookalike",
      ".stacked-book-cover-row",
      ".elementList .element",
    ];

    let bookRows = [];
    for (const selector of bookRowSelectors) {
      bookRows = document.querySelectorAll(selector);
      if (bookRows.length > 0) break;
    }

    bookRows.forEach((row, index) => {
      const bookInfo = extractBookInfoFromRow(row);
      if (bookInfo.title && bookInfo.author) {
        books.push({
          ...bookInfo,
          cleanTitle: cleanBookTitle(bookInfo.title),
          row: row,
          index: index,
        });
      }
    });

    return books;
  }

  function extractBookInfoFromRow(row) {
    const titleSelectors = [
      ".title a",
      ".field.title a",
      ".title .value a",
      "td.title a",
      ".gr-book-title-link",
    ];

    const authorSelectors = [
      ".author a",
      ".field.author a",
      ".author .value a",
      "td.author a",
      ".gr-book-author-link",
    ];

    let title = "";
    let author = "";

    for (const selector of titleSelectors) {
      const element = row.querySelector(selector);
      if (element) {
        title = element.textContent.trim();
        break;
      }
    }

    for (const selector of authorSelectors) {
      const element = row.querySelector(selector);
      if (element) {
        author = element.textContent.trim();
        break;
      }
    }

    return { title, author };
  }

  function cleanBookTitle(title) {
    if (!title) return title;

    let cleaned = title.replace(
      /\s*\([^)]*(?:series|#\d+|book\s+\d+|vol\.?\s*\d+)[^)]*\)\s*$/i,
      ""
    );
    cleaned = cleaned.replace(
      /\s*\[[^\]]*(?:series|#\d+|book\s+\d+|vol\.?\s*\d+)[^\]]*\]\s*$/i,
      ""
    );
    cleaned = cleaned.replace(
      /\s*[,:\-–—]\s*(?:book\s+\d+|#\d+|vol\.?\s*\d+)\s*$/i,
      ""
    );
    cleaned = cleaned.replace(
      /:\s*(?:book\s+\d+|#\d+|vol\.?\s*\d+|a\s+\w+\s+(?:novel|story|tale))\s*$/i,
      ""
    );
    cleaned = cleaned.replace(
      /\s*\((?:kindle\s+edition|paperback|hardcover|mass\s+market|large\s+print)\)\s*$/i,
      ""
    );
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    cleaned = cleaned.replace(/[,:\-–—]+\s*$/, "").trim();

    return cleaned || title;
  }

  function addLibraryColumn() {
    const headerSelectors = ["thead tr", ".tableHeader", "tr.header"];

    let headerRow = null;
    for (const selector of headerSelectors) {
      headerRow = document.querySelector(selector);
      if (headerRow) break;
    }

    if (headerRow) {
      const th = document.createElement("th");
      th.textContent = "library availability";
      th.className = "libby-lookup-header-cell";
      headerRow.appendChild(th);
    }
  }

  async function processBatch(books, selectedLibraries) {
    const promises = books.map((book) => processBook(book, selectedLibraries));
    await Promise.all(promises);
  }

  async function processBook(book, selectedLibraries) {
    const placeholderCell = createPlaceholderCell();
    book.row.appendChild(placeholderCell);

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "checkAvailability",
            data: {
              title: book.cleanTitle,
              originalTitle: book.title,
              author: book.author,
              libraries: selectedLibraries,
            },
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (response.error) {
        updateCellWithError(placeholderCell, response.error);
      } else {
        updateCellWithResults(placeholderCell, response.results);
      }
    } catch (error) {
      updateCellWithError(placeholderCell, error.message);
    }
  }

  function createPlaceholderCell() {
    const cell = document.createElement("td");
    cell.className = "libby-lookup-cell";
    cell.innerHTML = ``;
    return cell;
  }

  function updateCellWithResults(cell, results) {
    cell.className = "libby-lookup-cell";

    const available = results.filter(
      (r) => r.status === "success" && r.availabilityStatus === "available"
    );
    const waitlist = results.filter(
      (r) => r.status === "success" && r.availabilityStatus === "wait"
    );
    const unavailable = results.filter(
      (r) => r.status === "success" && r.availabilityStatus === "unavailable"
    );
    const unknown = results.filter(
      (r) => r.status === "success" && r.availabilityStatus === "unknown"
    );
    const errors = results.filter((r) => r.status === "error");

    let emoji = "❌";
    let title = "Not available at any library";
    let clickHandler = null;

    if (available.length > 0) {
      emoji = "✅";
      title = `Available now at ${available.length} ${
        available.length === 1 ? "library" : "libraries"
      }`;
      clickHandler = () => showAvailabilityPopup(available, "Available Now");
    } else if (waitlist.length > 0) {
      emoji = "⏳";
      title = `On waitlist at ${waitlist.length} ${
        waitlist.length === 1 ? "library" : "libraries"
      }`;
      clickHandler = () => showAvailabilityPopup(waitlist, "Waitlist");
    } else if (unknown.length > 0) {
      emoji = "❓";
      title = `Check ${unknown.length} ${
        unknown.length === 1 ? "library" : "libraries"
      }`;
      clickHandler = () => showAvailabilityPopup(unknown, "Check Availability");
    } else if (unavailable.length > 0) {
      emoji = "❌";
      title = `Not available at ${unavailable.length} ${
        unavailable.length === 1 ? "library" : "libraries"
      }`;
      clickHandler = () => showAvailabilityPopup(unavailable, "Not Available");
    } else if (errors.length > 0) {
      emoji = "⚠️";
      title = `Error checking ${errors.length} ${
        errors.length === 1 ? "library" : "libraries"
      }`;
      clickHandler = () => showAvailabilityPopup(errors, "Errors");
    }

    const emojiElement = document.createElement("span");
    emojiElement.className = "libby-lookup-emoji";
    emojiElement.textContent = emoji;
    emojiElement.title = title;
    emojiElement.style.cursor = clickHandler ? "pointer" : "default";
    emojiElement.style.fontSize = "16px";

    if (clickHandler) {
      emojiElement.addEventListener("click", clickHandler);
    }

    cell.appendChild(emojiElement);
  }

  function showAvailabilityPopup(results, title) {
    const existing = document.querySelector(".libby-lookup-popup");
    if (existing) {
      existing.remove();
    }

    const popup = document.createElement("div");
    popup.className = "libby-lookup-popup";

    const sortedResults = [...results].sort((a, b) => {
      const statusOrder = {
        available: 1,
        wait: 2,
        unknown: 3,
        unavailable: 4,
        error: 5,
      };
      const aOrder =
        statusOrder[a.availabilityStatus] || statusOrder[a.status] || 6;
      const bOrder =
        statusOrder[b.availabilityStatus] || statusOrder[b.status] || 6;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      if (a.availabilityStatus === "wait" && b.availabilityStatus === "wait") {
        const aWait = extractWaitTime(a.availability);
        const bWait = extractWaitTime(b.availability);
        return aWait - bWait;
      }

      return 0;
    });

    const popupContent = `
      <div class="libby-lookup-popup-content">
        <div class="libby-lookup-popup-header">
          <h4>${title}</h4>
        </div>
        <div class="libby-lookup-popup-body">
          ${sortedResults
            .map(
              (result) => `
            <div class="libby-lookup-popup-item">
              <div class="libby-lookup-popup-item-info">
                <strong>${result.library}</strong>
                ${
                  result.status === "error"
                    ? `<div class="libby-lookup-popup-error">Error: ${result.message}</div>`
                    : ""
                }
                ${
                  result.mediaTypes && result.mediaTypes.length > 0
                    ? `
                  <div class="libby-lookup-popup-media-types">
                    ${result.mediaTypes
                      .map(
                        (mt) => `
                      <div class="libby-lookup-popup-media-type">
                        <span class="libby-lookup-media-icon">${mt.icon}</span>
                        <span class="libby-lookup-media-name">${mt.typeName}:</span>
                        <a href="${mt.bookUrl}" target="_blank" class="libby-lookup-popup-media-status ${mt.status}">
                          ${mt.text}
                        </a>
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                `
                    : `
                  <div class="libby-lookup-popup-status ${
                    result.availabilityStatus || "unknown"
                  }">
                    ${result.availability || "Check availability"}
                  </div>
                `
                }
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    popup.innerHTML = popupContent;
    document.body.appendChild(popup);

    const rect = event.target.getBoundingClientRect();
    popup.style.position = "absolute";
    popup.style.left = rect.left + window.scrollX + "px";
    popup.style.top = rect.bottom + window.scrollY + 5 + "px";
    popup.style.background = "white";
    popup.style.border = "1px solid #ccc";
    popup.style.borderRadius = "8px";
    popup.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
    popup.style.zIndex = "10000";
    popup.style.maxWidth = "320px";
    popup.style.maxHeight = "300px";
    popup.style.overflow = "auto";

    setTimeout(() => {
      document.addEventListener("click", function closePopup(e) {
        if (!popup.contains(e.target)) {
          popup.remove();
          document.removeEventListener("click", closePopup);
        }
      });
    }, 100);
  }

  function extractWaitTime(availabilityText) {
    if (!availabilityText) return 999;

    const weekMatch = availabilityText.match(/(\d+)\s*week/i);
    if (weekMatch) return parseInt(weekMatch[1]) * 7;

    const dayMatch = availabilityText.match(/(\d+)\s*day/i);
    if (dayMatch) return parseInt(dayMatch[1]);

    const hourMatch = availabilityText.match(/(\d+)\s*hour/i);
    if (hourMatch) return parseInt(hourMatch[1]) / 24;

    return 999; // Default high number for unknown wait times
  }

  function updateCellWithError(cell, error) {
    cell.className = "libby-lookup-cell error";
    cell.innerHTML = `<div class="libby-lookup-shelf-error" title="${error}">⚠️</div>`;
  }
})();
