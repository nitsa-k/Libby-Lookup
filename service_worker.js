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
        library
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

async function checkLibraryAvailability(title, author, library) {
  try {
    const searchResults = await searchThunderAPI(title, author, library);

    if (!searchResults || searchResults.length === 0) {
      return {
        status: "success",
        availability: "Not found",
        availabilityStatus: "unavailable",
      };
    }

    const bestMatch = searchResults[0];
    const availability = parseThunderAvailability(bestMatch);

    return {
      status: "success",
      availability: availability.text,
      availabilityStatus: availability.status,
    };
  } catch (error) {
    console.error(`Error checking availability at ${library.name}:`, error);
    return {
      status: "error",
      message: error.message,
    };
  }
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
      // TODO: Add relevance scoring for results later
      return data.items.filter((item) => item.title && item.firstCreatorName);
    }
  }

  return [];
}

function parseThunderAvailability(item) {
  if (
    item.isAvailable === true ||
    (item.availableCopies && item.availableCopies > 0)
  ) {
    return {
      status: "available",
      text: "Available now",
    };
  }

  if (item.holdsCount > 0) {
    const estimatedWait = estimateWaitTime(
      item.estimatedWaitDays,
      item.holdsCount
    );
    return {
      status: "wait",
      text: estimatedWait,
    };
  }

  if (item.ownedCopies > 0) {
    return {
      status: "unknown",
      text: "Check availability",
    };
  }

  return {
    status: "unavailable",
    text: "Not available",
  };
}

function estimateWaitTime(estimatedWaitDays, holdsCount) {
  if (estimatedWaitDays && estimatedWaitDays > 0) {
    if (estimatedWaitDays < 7) {
      return `${estimatedWaitDays} day${estimatedWaitDays > 1 ? "s" : ""} wait`;
    } else if (estimatedWaitDays < 30) {
      const weeks = Math.ceil(estimatedWaitDays / 7);
      return `${weeks} week${weeks > 1 ? "s" : ""} wait`;
    } else {
      const months = Math.ceil(estimatedWaitDays / 30);
      return `${months} month${months > 1 ? "s" : ""} wait`;
    }
  }

  if (holdsCount > 0) {
    return `${holdsCount} hold${
      holdsCount > 1 ? "s" : ""
    } - check availability`;
  }

  return "Several weeks wait";
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.set({
      selectedLibraries: ["bpl"],
    });
  }
});
