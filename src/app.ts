import initializeDatabase from "./setup";
import "./stream"
import { errorHandler } from "./middleware/errorHandler";
const express = require("express");
const app = express();


app.use(errorHandler);
initializeDatabase().then(() => {
  app.listen(3000, () => {
    console.log("Server running on port 3000");
  });
});