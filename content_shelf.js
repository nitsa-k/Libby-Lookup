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

  function processBooksOnShelf() {
    const books = extractBooksFromShelf();
    if (books.length === 0) {
      console.log("No books found on shelf");
      return;
    }

    console.log(`Found ${books.length} books on shelf:`, books);
    // TODO: Add library column and check availability
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
})();
