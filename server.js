const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const app = express();
const bodyParser = require('body-parser');
const port = 3000;

app.use(bodyParser.json({ limit: '100mb' })); // Middleware to parse JSON bodies
app.use(express.static(path.join(__dirname))); // Serve static files from the root directory

// Endpoint to get the data
app.get("/data", async (req, res) => {
  try {
    const data = await fs.readFile("data.json", "utf8");
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).send("Error reading data");
  }
});

// Endpoint to update the data
app.post("/update-data", async (req, res) => {
  try {
    await fs.writeFile("data.json", JSON.stringify(req.body, null, 2)); // Formatting the JSON for readability
    res.send("Data updated successfully");
  } catch (error) {
    res.status(500).send("Error writing data");
  }
});

// Serve index.html for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
