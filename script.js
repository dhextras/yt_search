// Placeholder for your API key - Replace with your actual key
let globalData;
let searchFinished = true;
let viewFetchFinished = true;
const API_KEY = "AIzaSyBqtOYaW90gjABWz5TXjS65zopt8L-5dGE";

function addToExisting() {
  for (let userName in globalData.selectedChannels) {
    globalData.existingChannels[userName] = "";
    delete globalData.selectedChannels[userName];

    updateConsoleLog(`Added ${userName} to existing channels..`);
  }

  updateData(globalData);
  updateSelectedChannels();
}

function excludeChannels() {
  if (searchFinished && viewFetchFinished) {
    const confirm = window.confirm("Are you sure you want to exclude channels?");

    if (confirm) {
      for (let userName in globalData.potentialChannels) {
        globalData.excludedChannels[userName] = "";
        delete globalData.potentialChannels[userName];
      }
      updateData(globalData);
      updatePotentialChannels();
    }

  
  } else {
    updateConsoleLog("Fetch job is already running pls wait.. ");
  }
}

function generateAndDownloadCSV(data, filename, column) {
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += `${column}\n`;

  for (let item of data) {
    csvContent += item + "\n";
  }

  var encodedUri = encodeURI(csvContent);
  var link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateData() {
  updateConsoleLog("generating new existing channel sheet");

  // Generate and download existing channels CSV
  const existingChannelsData = Object.keys(globalData.existingChannels).map(userName => `https://www.youtube.com/${userName}/videos`);
  generateAndDownloadCSV(existingChannelsData, "channels.csv", "links");

  updateConsoleLog("generating new keywords sheet");

  // Generate and download keywords CSV
  const keywordsData = Object.keys(globalData.keywords);
  generateAndDownloadCSV(keywordsData, "keywords.csv", "keywords");
}


function updateChannelCount() {
  let potentialCount = document.querySelectorAll("#potentialList li").length;
  let selectedCount = document.querySelectorAll("#selectedList li").length;
  document.getElementById(
    "channelNumber"
  ).textContent = `Potential: ${potentialCount}, Selected: ${selectedCount}`;
}

// Function to load keywords and initialize the page
async function initializePage() {
  await getData();
  loadKeywords(globalData.keywords);

  toggleDivs(true);
  document
    .getElementById("searchButton")
    .addEventListener("click", handleSearch);
}

// Function to get data from the server and update a global variable
async function getData() {
  try {
    const response = await fetch("/data");
    const data = await response.json();

    globalData = data;
  } catch (error) {
    updateConsoleLog("Error:  Check Console...");
    console.error("Error fetching data:", error);
  }
}

function toggleDivs(showPotential) {
  const potentialDiv = document.getElementById("potentialDiv");
  const selectedDiv = document.getElementById("selectedDiv");
  if (showPotential) {
    updatePotentialChannels();
    selectedDiv.style.display = "none";
    potentialDiv.style.display = "block";
    potentialDiv.style.display = "flex";
  } else {
    updateSelectedChannels();
    potentialDiv.style.display = "none";
    selectedDiv.style.display = "block";
    selectedDiv.style.display = "flex";
  }
  // Trigger a reflow for CSS updates
  potentialDiv.offsetHeight;
  selectedDiv.offsetHeight;
}

function generateCsv() {
  const csvContent =
    "Name,Link,Matched Video,Subscribers,12 videos Average View,Matched keywords,Description\n" +
    Object.entries(globalData.selectedChannels)
      .map(([userName, channel]) => {
        return `${channel.name},${channel.channelUrl},${channel.matchedVideo},${
          channel.subscribers
        },${channel.averageViews},${channel.keywordList.join(" | ")},${channel.description}`;
      })
      .join("\n");

  const encoder = new TextEncoder();
  const dataView = encoder.encode(csvContent);
  const blob = new Blob([dataView], { type: 'text/csv' });

  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "selected_channels.csv");

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}



function updateConsoleLog(message) {
  document.getElementById("log").textContent = message;
}

// Function to send updated data to the server
async function updateData(newData) {
  try {
    const response = await fetch("/update-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newData),
    });

    if (!response.ok) {
      updateConsoleLog("Error:  Check Console...");
      console.error("Error updating data on the server");
    }
  } catch (error) {
    updateConsoleLog("Error:  Check Console...");
    console.error("Error sending data:", error);
  }
}

function loadKeywords(keywords) {
  const select = document.getElementById("keywordSelect");
  for (const keyword in keywords) {
    let option = document.createElement("option");
    option.value = keyword;
    option.text = keyword;
    select.appendChild(option);
  }
}

async function processPotentialChannels(items, keyword) {
  for (let item of items) {
    let channelId = item.snippet.channelId;

    const channelData = await fetchChannelData(channelId);
    const channelUsername = channelData.snippet.customUrl;
    const subscribers = channelData.statistics.subscriberCount;

    if (
      !(channelUsername in globalData.existingChannels) &&
      !(channelUsername in globalData.excludedChannels) &&
      subscribers > 5000
    ) {
      const checkPotentialChannel = globalData.potentialChannels[
        channelUsername
      ]
        ? true
        : false;

      const videos = checkPotentialChannel
        ? globalData.potentialChannels[channelUsername]["videos"]
        : [];

      videos.push({
        keyword: keyword,
        publishedAt: item.snippet.publishedAt,
        videoTitle: item.snippet.title,
        videoDescription: item.snippet.description,
        videoUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      });

      let newChannelInfo = {
        channelId: channelId,
        subscribers: subscribers,
        title: channelData.snippet.title,
        description: channelData.snippet.description,
        videos: videos,
      };

      globalData.potentialChannels[channelUsername] = newChannelInfo;

      updateData(globalData);
      updatePotentialChannels();
    }
  }
  searchFinished = true;
}

async function createSelectedChannel(userName) {
  const channelData = globalData.potentialChannels[userName];
  const averageViews = await fetchAverageViews(channelData.channelId);
  let matchedVideo = "";
  let keywordList = [];

  let mostRecentVideo = null;
  for (let id in channelData.videos) {
    const video = channelData.videos[id];
    if (
      !mostRecentVideo ||
      new Date(video.publishedAt) > new Date(mostRecentVideo.publishedAt)
    ) {
      mostRecentVideo = video;
    }
  }

  if (mostRecentVideo) {
    if (!keywordList.includes(mostRecentVideo.keyword)) {
      keywordList.push(mostRecentVideo.keyword);
    }
    matchedVideo = mostRecentVideo.videoUrl;
  }

  const newChannelData = {
    name: channelData.title,
    channelUrl: `https://www.youtube.com/${userName}/videos`,
    matchedVideo,
    subscribers: Math.round(channelData.subscribers / 100) / 10,
    averageViews,
    keywordList,
    description: channelData.description.replace(/(\r\n|\n|\r)/gm, "  "),
    mostRecentVideo,
    channelId: channelData.channelId,
    publishedAt: mostRecentVideo.publishedAt,
  };

  return newChannelData;
}

async function fetchAverageViews(channelId) {
  viewFetchFinished = false;
  updateConsoleLog(`Fetching average views from id --> ${channelId}`);

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&order=date&part=snippet&type=video&maxResults=12&key=${API_KEY}`
  );

  const data = await response.json();
  let videoIdList = data.items.map((video) => video.id.videoId);
  videoIdString = `${videoIdList.join(",")}`;

  const videoResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIdString}&maxResults=12&key=${API_KEY}`
  );
  const videoData = await videoResponse.json();

  let totalViews = 0;
  for (let item in videoData.items) {
    totalViews += parseInt(videoData.items[item].statistics.viewCount);
  }

  const averageViews = Math.round(totalViews / data.items.length / 100) / 10;

  return averageViews;
}

function updateSelectedChannels() {
  const channels = globalData.selectedChannels;
  const selectedList = document.getElementById("selectedList");
  selectedList.innerHTML = "";

  for (let [userName, channel] of Object.entries(channels)) {
    let li = document.createElement("li");
    li.innerHTML = `<a title="${channel.description}" href="${channel.channelUrl}" target="_blank">${channel.name}</a><div>${channel.subscribers}k Subs,   ${channel.averageViews}k Avrg</div>`;

    li.innerHTML += `<a title="Title:   ${channel.mostRecentVideo.videoTitle}\n\nDescription:   ${channel.mostRecentVideo.videoDescription}\n\nPublished:   ${channel.publishedAt}" href="${channel.mostRecentVideo.videoUrl}" target="_blank">${channel.mostRecentVideo.keyword}</a>`;

    let removeButton = document.createElement("button");
    removeButton.textContent = "-";
    removeButton.onclick = (e) => {
      delete globalData.selectedChannels[userName];
      updateData(globalData);

      e.target.closest("li").remove();
      updateChannelCount()
      updateConsoleLog(`${channel.name} removed from selected channels`);
    };

    // Append everything to the list item
    li.appendChild(removeButton);

    // Append the list item to the selected list
    selectedList.appendChild(li);
  }

  updateChannelCount();
}

function updatePotentialChannels() {
  const channels = globalData.potentialChannels;
  const potentialList = document.getElementById("potentialList");
  potentialList.innerHTML = "";

  for (let [userName, channel] of Object.entries(channels)) {
    let li = document.createElement("li");
    li.innerHTML = `<a title="${channel.description}" href="https://www.youtube.com/${userName}/videos" target="_blank">${channel.title}</a>  <div>${channel.subscribers}</div>`;

    // Create a div to hold video details
    let videoDetailsDiv = document.createElement("div");
    videoDetailsDiv.style.display = "none"; // Start hidden

    // Populate the div with video links
    channel.videos.forEach((video) => {
      let videoLink = document.createElement("a");
      videoLink.href = video.videoUrl;
      videoLink.title = `Title:   ${video.videoTitle}\n\nDescription:   ${video.videoDescription}\n\nPublished:   ${video.publishedAt}`;
      videoLink.textContent = video.keyword;
      videoLink.target = "_blank";
      videoDetailsDiv.appendChild(videoLink);
      videoDetailsDiv.innerHTML += "<br>"; // New line for each video
    });

    // Toggle visibility function
    li.onclick = function () {
      videoDetailsDiv.style.display =
        videoDetailsDiv.style.display === "none" ? "block" : "none";
    };

    // Append video details div to the list item
    li.appendChild(videoDetailsDiv);

    // Create + and - buttons
    let addButton = document.createElement("button");
    addButton.textContent = "+";
    addButton.onclick = async (e) => {
      if (viewFetchFinished && searchFinished) {
        globalData.selectedChannels[userName] = await createSelectedChannel(
          userName
        );

        delete globalData.potentialChannels[userName];
        updateData(globalData);

        e.target.closest("li").remove();
        updateConsoleLog(`${channel.title} added to selected channels`);

        viewFetchFinished = true;
      } else {
        updateConsoleLog("Pls wait, Already a fetch job is runnnig....");
      }
    };

    let removeButton = document.createElement("button");
    removeButton.textContent = "-";
    removeButton.onclick = (e) => {
      delete globalData.potentialChannels[userName];
      updateData(globalData);

      e.target.closest("li").remove();
      updateConsoleLog(`${channel.title} removed from potential channels`);
    };

    // Append everything to the list item
    li.appendChild(addButton);
    li.appendChild(removeButton);

    // Append the list item to the potential list
    potentialList.appendChild(li);
  }

  updateChannelCount();
}

async function fetchChannelData(channelId) {
  updateConsoleLog(`Fetching channel data for ${channelId}`);
  const API_URL = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`;

  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if (data.items.length > 0) {
      updateConsoleLog(
        `Sucusfully Fetched Data for ${data.items[0].snippet.customUrl}`
      );
      return data.items[0];
    } else {
      updateConsoleLog("Error:  Check Console...");
      console.error("No channel data found for the given ID.");
      return null;
    }
  } catch (error) {
    updateConsoleLog("Error:  Check Console...");
    console.error("Error fetching channel data:", error);
  }
}

function handleSearch() {
  if (searchFinished && viewFetchFinished) {
    performSearch();
  } else {
    updateConsoleLog("Last Search was not finished Yet...");
  }
}

function performSearch() {
  const selectedKeyword = document.getElementById("keywordSelect").value;
  nextPageToken = globalData.keywords[selectedKeyword].nextPageToken;

  updateConsoleLog(`Performing Search for ${selectedKeyword}..`);
  searchFinished = false;

  // Update the API URL to include the nextPageToken if present
  const API_URL = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&q=${encodeURIComponent(
    selectedKeyword
  )}&pageToken=${nextPageToken}&key=${API_KEY}&publishedAfter=${getMonthsAgo()}&order=relevance`;

  fetch(API_URL)
    .then((response) => response.json())
    .then((data) => {
      // Update the nextPageToken in the state
      globalData.keywords[selectedKeyword].nextPageToken = data.nextPageToken;

      updateData(globalData);
      processPotentialChannels(data.items, selectedKeyword);
    })
    .catch((error) => {
      updateConsoleLog("Error:  Check Console...");
      console.error("Error:", error);
    });
}

function getMonthsAgo() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString();
}

initializePage();
