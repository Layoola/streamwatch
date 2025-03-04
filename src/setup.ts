import sequelize from "./config/database";
import logger from "./logging/logger";

// Function to initialize database
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");
    await sequelize.sync({});
    // await sequelize.sync({ alter: true, force: true });
    // await sequelize.sync();
    console.log("Database synced successfully.");
  } catch (error) {
    logger.error("Database initialization failed:", error);
    process.exit(1);
  }
};

// Export the setup function
export default initializeDatabase;
