import * as winston from "winston";
import * as path from "path";
import "winston-daily-rotate-file";

const fileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(__dirname, "logs", "app-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "10m",
  maxFiles: "14d",
  level: "info",
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info: winston.Logform.TransformableInfo) => {
      return `${
        info.timestamp ?? new Date().toISOString()
      } [${info.level.toUpperCase()}]: ${info.message}`;
    })
  ),
  transports: [fileTransport, new winston.transports.Console()],
});

export default logger;
