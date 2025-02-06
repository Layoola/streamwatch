import sequelize from "../config/database";
import { DataTypes } from "sequelize";

const Media = sequelize.define('Media', {
    media_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    tweet_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references:{
            model: 'tweets',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    file_path: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    media_type: {
        type: DataTypes.STRING,
        allowNull: false,
    }
}, {
    timestamps: true,
    tableName: 'media'
})

export default Media;