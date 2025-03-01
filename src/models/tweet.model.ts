import { DataTypes, Model } from "sequelize";

import sequelize from "../config/database";

const Tweet = sequelize.define(
  "Tweet",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tweet_text: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    author: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    likes: DataTypes.INTEGER,
    retweets: DataTypes.INTEGER,
    comments: DataTypes.INTEGER,
  },
  {
    timestamps: true,
    tableName: "tweets",
  }
);

export default Tweet;
