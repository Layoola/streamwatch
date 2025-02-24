import sequelize from "./config/database";

// Function to initialize database
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");
    // await sequelize.sync({ alter: true });
    await sequelize.sync();
    console.log("Database synced successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1); 
  }
};

// Export the setup function
export default initializeDatabase;
