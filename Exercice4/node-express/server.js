const express = require("express");

const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
  res.send("Hello depuis Node.js Express !");
});

app.listen(PORT, () => {
  console.log(`Serveur Express sur le port ${PORT}`);
});
