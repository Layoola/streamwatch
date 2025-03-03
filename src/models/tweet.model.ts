import { DataTypes, Model } from "sequelize";

import sequelize from "../config/database";

interface ITweetAttributes {
  id: string;
  tweet_text: string;
  author: string;
  likes: number;
  retweets: number;
  comments: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ITweetInstance extends Model<ITweetAttributes>, ITweetAttributes {}

const Tweet = sequelize.define<ITweetInstance>(
  "Tweet",
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
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
