const Sequelize = require("sequelize");
import sequelize from "../config/database";
import Tweet from "./tweet.model";
import Media from "./media.model";
import Action from "./action.model";

Tweet.hasMany(Media, {foreignKey: 'tweet_id', onDelete: 'CASCADE'});
Media.belongsTo(Tweet, {foreignKey: 'tweet_id'});

Tweet.hasMany(Action, {foreignKey: 'related_tweet_id', onDelete: 'CASCADE'});
Action.belongsTo(Tweet, {foreignKey: 'related_tweet_id'});

export { Tweet, Media, Action };