import initializeDatabase from "./setup";
const express = require("express");
const app = express();

initializeDatabase().then(() => {
  app.listen(3000, () => {
    console.log("Server running on port 3000");
  });
});

//hiii