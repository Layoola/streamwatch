import { Request, Response, NextFunction } from "express";

class AppError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handling middleware
const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err.message);
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

export { AppError, errorHandler };
