import { Sequelize } from "sequelize";

const path = require('path');

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.resolve(__dirname, "../..data/database.sqlite"),
  logging: false, // Disable logging in production
  // hooks: {
  //   beforeBulkSync: async (options) => {
  //     await sequelize.drop();
  //   },
  // },
});

export default sequelize;