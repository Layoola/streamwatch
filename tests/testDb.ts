import sequelize from "../src/config/database";
import { Tweet, Media, Action } from "../src/models";

const testDb = async () => {
  try {
    console.log(".... Testing database connection ....");
    await sequelize.sync({ force: true });

    //tweet creation test
    const tweet = await Tweet.create({
      tweet_text: "Hello, World!",
      author: "John Doe",
    });

    console.log("✅ Tweet Created:", tweet.toJSON());

    //media creation test
    const media = await Media.create({
      tweet_id: tweet.id, //some tweet id
      file_path: "/path/to/file",
      media_type: "image",
    });
    console.log("✅ Media Created:", media.toJSON());

    //add action test
    const action = await Action.create({
        action_type: "like",
        related_tweet_id: tweet.id, //some tweet id
    })
    console.log("✅ Action Recorded:", action.toJSON());
    const tweets = await Tweet.findAll({
        include: [Media, Action], // Include related models
      });
  
      console.log("🔍 Retrieved Tweets with Relations:", JSON.stringify(tweets, null, 2));
  
      console.log("🎉 Database test completed successfully!");
    } catch (error) {
      console.error("❌ Database test failed:", error);
  } finally {
    await sequelize.close().then(() => console.log("Database connection closed.")).catch(() => console.error("Failed to close database connection."));
    process.exit(0);
  }
};



testDb();