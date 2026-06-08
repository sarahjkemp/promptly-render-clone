import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeScheduledTasks } from "./scheduled-tasks";
import { pendingArticleMonitor } from "./pendingArticleMonitor";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  
  // Initialize scheduled tasks for automated news fetching
  await initializeScheduledTasks();
  
  // Start monitoring for stuck pending articles
  pendingArticleMonitor.startMonitoring(30); // Check every 30 minutes to avoid overwhelming the system

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Server error:", err);
    const status = err.status || err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // Handle rate limiting errors with a more friendly message
    if (message.includes('rate limit') || (status === 429)) {
      message = "Rate limit reached. Please try again after a short wait.";
    }

    // Handle OpenAI service errors 
    if (message.includes('openai') || message.includes('OpenAI')) {
      message = "Processing service temporarily unavailable. Please try again shortly.";
    }

    res.status(status).json({ 
      message,
      type: err.type || 'error',
      code: err.code || 'server_error'
    });

    // Don't throw the error in production, just log it
    if (process.env.NODE_ENV === 'production') {
      console.error(err);
    } else {
      throw err;
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use host-provided PORT when available, with 5000 as the local fallback.
  const port = Number(process.env.PORT) || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
