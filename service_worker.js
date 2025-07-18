let librariesData = null;

chrome.runtime.onStartup.addListener(loadLibrariesData);
chrome.runtime.onInstalled.addListener(loadLibrariesData);

async function loadLibrariesData() {
  try {
    const response = await fetch(chrome.runtime.getURL("libraries.json"));
    librariesData = await response.json();
  } catch (error) {
    console.error("Failed to load libraries data:", error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkAvailability") {
    handleCheckAvailability(request.data, sendResponse);
    return true;
  }
});

async function handleCheckAvailability(data, sendResponse) {
  const { title, author, libraries } = data;

  if (!librariesData) {
    await loadLibrariesData();
  }

  const prefs = await chrome.storage.sync.get(["showEbooks", "showAudiobooks"]);
  const showEbooks = prefs.showEbooks !== false; // Default to true
  const showAudiobooks = prefs.showAudiobooks !== false; // Default to true

  const results = [];

  const libraryPromises = libraries.map(async (libraryId, index) => {
    await new Promise((resolve) => setTimeout(resolve, index * 100));

    const library = librariesData.find((lib) => lib.id === libraryId);
    if (!library) {
      return {
        library: libraryId,
        status: "error",
        message: "Library not found",
      };
    }

    try {
      const availability = await checkLibraryAvailability(
        title,
        author,
        library,
        showEbooks,
        showAudiobooks
      );
      return { library: library.name, id: library.id, ...availability };
    } catch (error) {
      console.error(`Error checking ${library.name}:`, error);
      return {
        library: library.name,
        id: library.id,
        status: "error",
        message: error.message,
      };
    }
  });

  const libraryResults = await Promise.all(libraryPromises);
  results.push(...libraryResults);

  sendResponse({ results });
}

async function checkLibraryAvailability(
  title,
  author,
  library,
  showEbooks,
  showAudiobooks
) {
  try {
    const searchResults = await searchThunderAPI(title, author, library);

    if (!searchResults || searchResults.length === 0) {
      return {
        status: "success",
        availability: "Not found",
        availabilityStatus: "unavailable",
        searchUrl: buildSearchUrl(title, author, library),
        bookUrl: buildSearchUrl(title, author, library),
        mediaTypes: [],
      };
    }

    const mediaTypes = groupByMediaType(
      searchResults,
      showEbooks,
      showAudiobooks,
      library
    );

    mediaTypes.forEach((mt) => {
      mt.bookUrl = buildLibbyBookUrl(mt.item, library);
    });

    const overallStatus = determineOverallStatus(mediaTypes);

    return {
      status: "success",
      availability: overallStatus.text,
      availabilityStatus: overallStatus.status,
      waitDetails: overallStatus.waitDetails,
      searchUrl: buildSearchUrl(title, author, library),
      bookUrl: overallStatus.bookUrl,
      mediaTypes: mediaTypes,
    };
  } catch (error) {
    console.error(`Error checking availability at ${library.name}:`, error);
    return {
      status: "error",
      message: error.message,
      searchUrl: buildSearchUrl(title, author, library),
      bookUrl: buildSearchUrl(title, author, library),
      mediaTypes: [],
    };
  }
}

function groupByMediaType(searchResults, showEbooks, showAudiobooks, library) {
  const mediaTypes = [];

  const ebookResults = searchResults.filter(
    (item) => item.type && item.type.id === "ebook"
  );
  const audiobookResults = searchResults.filter(
    (item) => item.type && item.type.id === "audiobook"
  );

  if (showEbooks && ebookResults.length > 0) {
    const bestEbook = ebookResults[0];
    const availability = parseThunderAvailability(bestEbook);
    mediaTypes.push({
      type: "ebook",
      typeName: "eBook",
      icon: "📖",
      ...availability,
      bookUrl: buildLibbyBookUrl(bestEbook, library),
      item: bestEbook,
    });
  }

  if (showAudiobooks && audiobookResults.length > 0) {
    const bestAudiobook = audiobookResults[0];
    const availability = parseThunderAvailability(bestAudiobook);
    mediaTypes.push({
      type: "audiobook",
      typeName: "Audiobook",
      icon: "🎧",
      ...availability,
      bookUrl: buildLibbyBookUrl(bestAudiobook, library),
      item: bestAudiobook,
    });
  }

  return mediaTypes;
}

function determineOverallStatus(mediaTypes) {
  if (mediaTypes.length === 0) {
    return {
      status: "unavailable",
      text: "Not available",
      waitDetails: null,
      bookUrl: null,
    };
  }

    const availableNow = mediaTypes.filter((mt) => mt.status === "available");
  if (availableNow.length > 0) {
    const best = availableNow[0];
    if (availableNow.length > 1) {
      return {
        status: "available",
        text: "Available now",
        waitDetails: null,
        bookUrl: best.bookUrl,
      };
    } else {
      return {
        status: "available",
        text: `${best.typeName} available now`,
        waitDetails: null,
        bookUrl: best.bookUrl,
      };
    }
  }

  const onWaitlist = mediaTypes.filter((mt) => mt.status === "wait");
  if (onWaitlist.length > 0) {
    const best = onWaitlist[0];
    return {
      status: "wait",
      text: `${best.typeName} - ${best.text}`,
      waitDetails: best.waitDetails,
      bookUrl: best.bookUrl,
    };
  }

  const unknown = mediaTypes.filter((mt) => mt.status === "unknown");
  if (unknown.length > 0) {
    const best = unknown[0];
    return {
      status: "unknown",
      text: `${best.typeName} - Check availability`,
      waitDetails: null,
      bookUrl: best.bookUrl,
    };
  }

  const best = mediaTypes[0];
  return {
    status: "unavailable",
    text: "Not available",
    waitDetails: null,
    bookUrl: best.bookUrl,
  };
}

async function searchThunderAPI(title, author, library) {
  const searchQuery = `${title} ${author}`.trim();
  const encodedQuery = encodeURIComponent(searchQuery);

  const thunderSearchUrl = `https://thunder.api.overdrive.com/v2/libraries/${library.id}/media?query=${encodedQuery}&limit=10`;

  const response = await fetch(thunderSearchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://libbyapp.com",
      Referer: "https://libbyapp.com/",
    },
  });

  if (response.ok) {
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const relevantResults = data.items
        .filter((item) => item.title && item.firstCreatorName)
        .map((item) => {
          const relevanceScore = calculateRelevanceScore(
            item.title,
            item.firstCreatorName,
            title,
            author
          );
          return { ...item, relevanceScore };
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      return relevantResults;
    }
  }

  return [];
}

function calculateRelevanceScore(
  foundTitle,
  foundAuthor,
  searchTitle,
  searchAuthor
) {
  const normalize = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const normalizedFoundTitle = normalize(foundTitle);
  const normalizedSearchTitle = normalize(searchTitle);
  const normalizedFoundAuthor = normalize(foundAuthor);
  const normalizedSearchAuthor = normalize(searchAuthor);

  let score = 0;

  // Title matching (weighted 70%)
  if (normalizedFoundTitle === normalizedSearchTitle) {
    score += 70;
  } else if (
    normalizedFoundTitle.includes(normalizedSearchTitle) ||
    normalizedSearchTitle.includes(normalizedFoundTitle)
  ) {
    score += 50;
  } else {
    // Word overlap for title
    const foundTitleWords = normalizedFoundTitle.split(/\s+/);
    const searchTitleWords = normalizedSearchTitle.split(/\s+/);
    const titleOverlap = foundTitleWords.filter((word) =>
      searchTitleWords.includes(word)
    ).length;
    const titleOverlapScore =
      (titleOverlap /
        Math.max(foundTitleWords.length, searchTitleWords.length)) *
      40;
    score += titleOverlapScore;
  }

  // Author matching (weighted 30%)
  if (normalizedFoundAuthor === normalizedSearchAuthor) {
    score += 30;
  } else if (
    normalizedFoundAuthor.includes(normalizedSearchAuthor) ||
    normalizedSearchAuthor.includes(normalizedFoundAuthor)
  ) {
    score += 20;
  } else {
    // Word overlap for author
    const foundAuthorWords = normalizedFoundAuthor.split(/\s+/);
    const searchAuthorWords = normalizedSearchAuthor.split(/\s+/);
    const authorOverlap = foundAuthorWords.filter((word) =>
      searchAuthorWords.includes(word)
    ).length;
    const authorOverlapScore =
      (authorOverlap /
        Math.max(foundAuthorWords.length, searchAuthorWords.length)) *
      15;
    score += authorOverlapScore;
  }

  return score;
}

function parseThunderAvailability(item) {
  if (
    item.isAvailable === true ||
    (item.availableCopies && item.availableCopies > 0)
  ) {
    return {
      status: "available",
      text: "Available now",
      waitDetails: null,
    };
  }

  if (item.holdsCount > 0) {
    const estimatedWait = estimateWaitTime(
      item.ownedCopies || 1,
      item.holdsCount,
      item.estimatedWaitDays
    );
    return {
      status: "wait",
      text: estimatedWait,
      waitDetails: `${item.ownedCopies || 1} copies, ${item.holdsCount} holds`,
    };
  }

  if (item.ownedCopies > 0) {
    return {
      status: "unknown",
      text: "Check availability",
      waitDetails: null,
    };
  }

  return {
    status: "unavailable",
    text: "Not available",
    waitDetails: null,
  };
}

function estimateWaitTime(copiesOwned, holdsCount, estimatedWaitDays) {
  if (estimatedWaitDays && estimatedWaitDays > 0) {
    if (estimatedWaitDays < 7) {
      return `${estimatedWaitDays} days wait`;
    } else if (estimatedWaitDays < 30) {
      const weeks = Math.ceil(estimatedWaitDays / 7);
      return `${weeks} week${weeks > 1 ? "s" : ""} wait`;
    } else {
      const months = Math.ceil(estimatedWaitDays / 30);
      return `${months} month${months > 1 ? "s" : ""} wait`;
    }
  }

  if (!copiesOwned || !holdsCount) return "Several weeks wait";

  const weeksPerCopy = 2; // Assume 2 weeks per lending period
  const estimatedWeeks = Math.ceil((holdsCount / copiesOwned) * weeksPerCopy);

  if (estimatedWeeks < 4) {
    return `${estimatedWeeks} week${estimatedWeeks > 1 ? "s" : ""} wait`;
  } else if (estimatedWeeks < 26) {
    const months = Math.ceil(estimatedWeeks / 4);
    return `${months} month${months > 1 ? "s" : ""} wait`;
  } else {
    return "Several months wait";
  }
}

function buildSearchUrl(title, author, library) {
  const cleanTitle = encodeURIComponent(title.replace(/[^\w\s]/gi, "").trim());
  const cleanAuthor = encodeURIComponent(
    author.replace(/[^\w\s]/gi, "").trim()
  );

  return `https://libbyapp.com/search/${library.id}/search/query-${cleanTitle}%20${cleanAuthor}/page-1`;
}

function buildLibbyBookUrl(item, library) {
  const titleEncoded = encodeURIComponent(
    item.title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
  );

  return `https://libbyapp.com/search/${library.id}/search/query-${titleEncoded}/page-1/${item.id}/request?key=${library.id}`;
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.set({
      selectedLibraries: ["bpl"],
      showEbooks: true,
      showAudiobooks: true,
    });
  }
});
