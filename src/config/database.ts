import { Sequelize } from "sequelize";
import path from "path";

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.resolve(__dirname, "../..data/database.sqlite"),
//   logging: false, // Disable logging in production
});

export default sequelize;