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
      console.log("Extracted book info:", bookInfo);
      // TODO: Check availability and display results
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
})();
