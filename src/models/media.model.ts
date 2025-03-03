import sequelize from "../config/database";
import { DataTypes } from "sequelize";

const Media = sequelize.define(
  "Media",
  {
    media_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tweet_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "tweets",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    media_base_64: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    media_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    tableName: "media",
  }
);

export default Media;