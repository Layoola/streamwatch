import sequelize from "../config/database";
import { DataTypes } from "sequelize";

const Action = sequelize.define('Action', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    related_tweet_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references:{
            model: 'tweets',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    action_type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    timestamps: true,
    tableName: 'actions'
})

export default Action;