import { DataTypes, Model } from "sequelize";

import sequelize from "../config/database";
import { ITweetAttributes } from "../utils/interfaces";



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
